;; Case Registration Contract
;; Records anonymized unusual medical cases

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u403))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-ALREADY-EXISTS (err u409))

;; Data structures
(define-map medical-cases
  { case-id: uint }
  {
    registrar: principal,
    condition-category: (string-ascii 100),
    primary-symptoms: (string-ascii 500),
    secondary-symptoms: (string-ascii 500),
    diagnostic-tests: (string-ascii 500),
    test-results: (string-ascii 1000),
    medical-history-relevant: (string-ascii 500),
    demographic-data: (string-ascii 200), ;; age range, biological sex, ethnicity (anonymized)
    geographic-region: (string-ascii 100), ;; general region, not specific location
    unusual-factors: (string-ascii 500),
    attempted-treatments: (string-ascii 500),
    current-status: (string-ascii 50), ;; "registered", "matched", "treatment-in-progress", "resolved", "unresolved"
    urgency-level: (string-ascii 20), ;; "low", "medium", "high", "critical"
    registration-date: uint,
    last-updated: uint,
    is-verified: bool
  }
)

(define-map case-updates
  { update-id: uint }
  {
    case-id: uint,
    update-type: (string-ascii 50), ;; "status-change", "new-symptoms", "new-test-results", "treatment-response"
    details: (string-ascii 1000),
    updated-by: principal,
    timestamp: uint
  }
)

(define-map authorized-registrars
  { address: principal }
  {
    is-authorized: bool,
    institution: (string-ascii 200),
    credentials: (string-ascii 200),
    verification-date: uint
  }
)

(define-map verifiers
  { address: principal }
  { is-verifier: bool }
)

(define-data-var last-case-id uint u0)
(define-data-var last-update-id uint u0)

;; Public functions
(define-public (register-case
                (condition-category (string-ascii 100))
                (primary-symptoms (string-ascii 500))
                (secondary-symptoms (string-ascii 500))
                (diagnostic-tests (string-ascii 500))
                (test-results (string-ascii 1000))
                (medical-history-relevant (string-ascii 500))
                (demographic-data (string-ascii 200))
                (geographic-region (string-ascii 100))
                (unusual-factors (string-ascii 500))
                (attempted-treatments (string-ascii 500))
                (urgency-level (string-ascii 20)))
  (match (map-get? authorized-registrars { address: tx-sender })
    registrar
      (if (get is-authorized registrar)
        (let ((new-id (+ (var-get last-case-id) u1)))
          (var-set last-case-id new-id)
          (map-set medical-cases
            { case-id: new-id }
            {
              registrar: tx-sender,
              condition-category: condition-category,
              primary-symptoms: primary-symptoms,
              secondary-symptoms: secondary-symptoms,
              diagnostic-tests: diagnostic-tests,
              test-results: test-results,
              medical-history-relevant: medical-history-relevant,
              demographic-data: demographic-data,
              geographic-region: geographic-region,
              unusual-factors: unusual-factors,
              attempted-treatments: attempted-treatments,
              current-status: "registered",
              urgency-level: urgency-level,
              registration-date: block-height,
              last-updated: block-height,
              is-verified: false
            }
          )
          (add-case-update new-id "status-change" "Case registered")
          (ok new-id)
        )
        ERR-NOT-AUTHORIZED
      )
    ERR-NOT-AUTHORIZED
  )
)

(define-public (update-case
                (case-id uint)
                (primary-symptoms (string-ascii 500))
                (secondary-symptoms (string-ascii 500))
                (diagnostic-tests (string-ascii 500))
                (test-results (string-ascii 1000))
                (unusual-factors (string-ascii 500))
                (attempted-treatments (string-ascii 500))
                (urgency-level (string-ascii 20)))
  (match (map-get? medical-cases { case-id: case-id })
    case
      (if (is-eq tx-sender (get registrar case))
        (begin
          (map-set medical-cases
            { case-id: case-id }
            (merge case {
              primary-symptoms: primary-symptoms,
              secondary-symptoms: secondary-symptoms,
              diagnostic-tests: diagnostic-tests,
              test-results: test-results,
              unusual-factors: unusual-factors,
              attempted-treatments: attempted-treatments,
              urgency-level: urgency-level,
              last-updated: block-height
            })
          )
          (add-case-update case-id "case-update" "Case details updated")
          (ok case-id)
        )
        ERR-NOT-AUTHORIZED
      )
    ERR-NOT-FOUND
  )
)

(define-public (update-case-status
                (case-id uint)
                (status (string-ascii 50))
                (details (string-ascii 1000)))
  (match (map-get? medical-cases { case-id: case-id })
    case
      (if (or (is-eq tx-sender (get registrar case))
              (is-authorized-specialist tx-sender case-id))
        (begin
          (map-set medical-cases
            { case-id: case-id }
            (merge case {
              current-status: status,
              last-updated: block-height
            })
          )
          (add-case-update case-id "status-change" details)
          (ok case-id)
        )
        ERR-NOT-AUTHORIZED
      )
    ERR-NOT-FOUND
  )
)

(define-public (authorize-registrar
                (registrar principal)
                (institution (string-ascii 200))
                (credentials (string-ascii 200)))
  (if (is-contract-admin tx-sender)
    (begin
      (map-set authorized-registrars
        { address: registrar }
        {
          is-authorized: true,
          institution: institution,
          credentials: credentials,
          verification-date: block-height
        }
      )
      (ok true)
    )
    ERR-NOT-AUTHORIZED
  )
)

(define-public (add-verifier (verifier principal))
  (if (is-contract-admin tx-sender)
    (begin
      (map-set verifiers { address: verifier } { is-verifier: true })
      (ok true)
    )
    ERR-NOT-AUTHORIZED
  )
)

(define-public (verify-case (case-id uint) (verified bool))
  (match (map-get? verifiers { address: tx-sender })
    verifier
      (if (get is-verifier verifier)
        (match (map-get? medical-cases { case-id: case-id })
          case
            (begin
              (map-set medical-cases
                { case-id: case-id }
                (merge case { is-verified: verified })
              )
              (add-case-update case-id "verification" (if verified "Case verified" "Case verification revoked"))
              (ok case-id)
            )
          ERR-NOT-FOUND
        )
        ERR-NOT-AUTHORIZED
      )
    ERR-NOT-AUTHORIZED
  )
)

;; Private functions
(define-private (add-case-update (case-id uint) (update-type (string-ascii 50)) (details (string-ascii 1000)))
  (let ((new-id (+ (var-get last-update-id) u1)))
    (var-set last-update-id new-id)
    (map-set case-updates
      { update-id: new-id }
      {
        case-id: case-id,
        update-type: update-type,
        details: details,
        updated-by: tx-sender,
        timestamp: block-height
      }
    )
    new-id
  )
)

(define-private (is-authorized-specialist (specialist principal) (case-id uint))
  ;; In a real implementation, this would check if the specialist is assigned to this case
  ;; For simplicity, we're returning false
  false
)

(define-private (is-contract-admin (address principal))
  ;; In a real implementation, this would check if the address is a contract admin
  ;; For simplicity, we're checking if it's the contract caller
  (is-eq address contract-caller)
)

;; Read-only functions
(define-read-only (get-case (case-id uint))
  (map-get? medical-cases { case-id: case-id })
)

(define-read-only (get-case-updates (case-id uint))
  ;; In a real implementation, this would return all updates for the case
  ;; For simplicity, we're returning an empty list
  (list)
)

(define-read-only (get-cases-by-condition (condition-category (string-ascii 100)))
  ;; In a real implementation, this would return all cases with the given condition
  ;; For simplicity, we're returning an empty list
  (list)
)

(define-read-only (get-cases-by-status (status (string-ascii 50)))
  ;; In a real implementation, this would return all cases with the given status
  ;; For simplicity, we're returning an empty list
  (list)
)

(define-read-only (get-cases-by-registrar (registrar principal))
  ;; In a real implementation, this would return all cases registered by the given principal
  ;; For simplicity, we're returning an empty list
  (list)
)

(define-read-only (is-registrar-authorized (address principal))
  (match (map-get? authorized-registrars { address: address })
    registrar (get is-authorized registrar)
    false
  )
)

(define-read-only (get-last-case-id)
  (var-get last-case-id)
)
