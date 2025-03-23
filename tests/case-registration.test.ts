import { describe, it, expect, beforeEach } from "vitest"

// Mock implementation for testing Clarity contracts
const mockRegistrarPrincipal = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
const mockSpecialistPrincipal = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
const mockVerifierPrincipal = "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
const mockBlockHeight = 100

// Mock state
let lastCaseId = 0
let lastUpdateId = 0
const medicalCases = new Map()
const caseUpdates = new Map()
const authorizedRegistrars = new Map()
const verifiers = new Map()

// Mock contract functions
const authorizeRegistrar = (
    registrar,
    institution,
    credentials
) => {
  authorizedRegistrars.set(registrar, {
    "is-authorized": true,
    institution,
    credentials,
    "verification-date": mockBlockHeight
  })
  return { value: true }
}

const addVerifier = (verifier) => {
  verifiers.set(verifier, { "is-verifier": true })
  return { value: true }
}

const registerCase = (
    conditionCategory,
    primarySymptoms,
    secondarySymptoms,
    diagnosticTests,
    testResults,
    medicalHistoryRelevant,
    demographicData,
    geographicRegion,
    unusualFactors,
    attemptedTreatments,
    urgencyLevel
) => {
  if (!isRegistrarAuthorized(mockRegistrarPrincipal)) {
    return { error: 403 }
  }
  
  const newId = lastCaseId + 1
  lastCaseId = newId
  
  medicalCases.set(newId, {
    registrar: mockRegistrarPrincipal,
    "condition-category": conditionCategory,
    "primary-symptoms": primarySymptoms,
    "secondary-symptoms": secondarySymptoms,
    "diagnostic-tests": diagnosticTests,
    "test-results": testResults,
    "medical-history-relevant": medicalHistoryRelevant,
    "demographic-data": demographicData,
    "geographic-region": geographicRegion,
    "unusual-factors": unusualFactors,
    "attempted-treatments": attemptedTreatments,
    "current-status": "registered",
    "urgency-level": urgencyLevel,
    "registration-date": mockBlockHeight,
    "last-updated": mockBlockHeight,
    "is-verified": false
  })
  
  // Add initial update
  addCaseUpdate(newId, "status-change", "Case registered")
  
  return { value: newId }
}

const updateCase = (
    caseId,
    primarySymptoms,
    secondarySymptoms,
    diagnosticTests,
    testResults,
    unusualFactors,
    attemptedTreatments,
    urgencyLevel
) => {
  const medicalCase = medicalCases.get(caseId)
  if (!medicalCase) return { error: 404 }
  if (medicalCase.registrar !== mockRegistrarPrincipal) return { error: 403 }
  
  medicalCases.set(caseId, {
    ...medicalCase,
    "primary-symptoms": primarySymptoms,
    "secondary-symptoms": secondarySymptoms,
    "diagnostic-tests": diagnosticTests,
    "test-results": testResults,
    "unusual-factors": unusualFactors,
    "attempted-treatments": attemptedTreatments,
    "urgency-level": urgencyLevel,
    "last-updated": mockBlockHeight
  })
  
  // Add update
  addCaseUpdate(caseId, "case-update", "Case details updated")
  
  return { value: caseId }
}

const updateCaseStatus = (
    caseId,
    status,
    details
) => {
  const medicalCase = medicalCases.get(caseId)
  if (!medicalCase) return { error: 404 }
  
  // Check if caller is registrar or authorized specialist
  if (medicalCase.registrar !== mockRegistrarPrincipal && !isAuthorizedSpecialist(mockRegistrarPrincipal, caseId)) {
    return { error: 403 }
  }
  
  medicalCases.set(caseId, {
    ...medicalCase,
    "current-status": status,
    "last-updated": mockBlockHeight
  })
  
  // Add update
  addCaseUpdate(caseId, "status-change", details)
  
  return { value: caseId }
}

const verifyCase = (
    caseId,
    verified
) => {
  if (!isVerifier(mockVerifierPrincipal)) {
    return { error: 403 }
  }
  
  const medicalCase = medicalCases.get(caseId)
  if (!medicalCase) return { error: 404 }
  
  medicalCases.set(caseId, {
    ...medicalCase,
    "is-verified": verified
  })
  
  // Add update
  addCaseUpdate(caseId, "verification", verified ? "Case verified" : "Case verification revoked")
  
  return { value: caseId }
}

const addCaseUpdate = (caseId, updateType, details) => {
  const newId = lastUpdateId + 1
  lastUpdateId = newId
  
  caseUpdates.set(newId, {
    "case-id": caseId,
    "update-type": updateType,
    details,
    "updated-by": mockRegistrarPrincipal,
    timestamp: mockBlockHeight
  })
  
  return newId
}

const isRegistrarAuthorized = (registrar) => {
  const registrarData = authorizedRegistrars.get(registrar)
  return registrarData ? registrarData["is-authorized"] : false
}

const isAuthorizedSpecialist = (specialist, caseId) => {
  // In a real implementation, this would check if the specialist is assigned to this case
  // For simplicity, we're returning false
  return false
}

const isVerifier = (address) => {
  const verifierData = verifiers.get(address)
  return verifierData ? verifierData["is-verifier"] : false
}

const getCase = (caseId) => {
  return medicalCases.get(caseId) || null
}

describe("Case Registration Contract", () => {
  beforeEach(() => {
    // Reset state before each test
    lastCaseId = 0
    lastUpdateId = 0
    medicalCases.clear()
    caseUpdates.clear()
    authorizedRegistrars.clear()
    verifiers.clear()
    
    // Set up authorized registrar
    authorizeRegistrar(
        mockRegistrarPrincipal,
        "University Medical Center",
        "Board Certified Neurologist, License #12345"
    )
    
    // Set up verifier
    addVerifier(mockVerifierPrincipal)
  })
  
  it("should register a medical case", () => {
    const result = registerCase(
        "Neurological",
        "Progressive muscle weakness in limbs, fasciculations, dysarthria",
        "Fatigue, weight loss, occasional dysphagia",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers",
        "No family history of neurodegenerative disease, no prior neurological issues",
        "Male, 45-50, Caucasian",
        "North America",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment",
        "Riluzole, physical therapy, speech therapy",
        "high"
    )
    
    expect(result.value).toBe(1)
    expect(medicalCases.size).toBe(1)
    
    const medicalCase = getCase(1)
    expect(medicalCase).not.toBeNull()
    expect(medicalCase["condition-category"]).toBe("Neurological")
    expect(medicalCase["primary-symptoms"]).toBe("Progressive muscle weakness in limbs, fasciculations, dysarthria")
    expect(medicalCase["current-status"]).toBe("registered")
    expect(medicalCase["urgency-level"]).toBe("high")
    expect(medicalCase["is-verified"]).toBe(false)
  })
  
  it("should update a medical case", () => {
    // First register a case
    registerCase(
        "Neurological",
        "Progressive muscle weakness in limbs, fasciculations, dysarthria",
        "Fatigue, weight loss, occasional dysphagia",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers",
        "No family history of neurodegenerative disease, no prior neurological issues",
        "Male, 45-50, Caucasian",
        "North America",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment",
        "Riluzole, physical therapy, speech therapy",
        "high"
    )
    
    // Then update it
    const updateResult = updateCase(
        1,
        "Progressive muscle weakness in limbs, fasciculations, dysarthria, now with bulbar symptoms",
        "Fatigue, weight loss, dysphagia, occasional shortness of breath",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers, pulmonary function tests",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers, reduced vital capacity on PFTs",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment, now with respiratory involvement",
        "Riluzole, physical therapy, speech therapy, non-invasive ventilation at night",
        "critical"
    )
    
    expect(updateResult.value).toBe(1)
    
    const medicalCase = getCase(1)
    expect(medicalCase["primary-symptoms"]).toBe("Progressive muscle weakness in limbs, fasciculations, dysarthria, now with bulbar symptoms")
    expect(medicalCase["urgency-level"]).toBe("critical")
    expect(medicalCase["attempted-treatments"]).toBe("Riluzole, physical therapy, speech therapy, non-invasive ventilation at night")
  })
  
  it("should update case status", () => {
    // First register a case
    registerCase(
        "Neurological",
        "Progressive muscle weakness in limbs, fasciculations, dysarthria",
        "Fatigue, weight loss, occasional dysphagia",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers",
        "No family history of neurodegenerative disease, no prior neurological issues",
        "Male, 45-50, Caucasian",
        "North America",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment",
        "Riluzole, physical therapy, speech therapy",
        "high"
    )
    
    // Then update its status
    const updateResult = updateCaseStatus(
        1,
        "matched",
        "Case matched with specialist Dr. Smith"
    )
    
    expect(updateResult.value).toBe(1)
    
    const medicalCase = getCase(1)
    expect(medicalCase["current-status"]).toBe("matched")
  })
  
  it("should verify a case", () => {
    // First register a case
    registerCase(
        "Neurological",
        "Progressive muscle weakness in limbs, fasciculations, dysarthria",
        "Fatigue, weight loss, occasional dysphagia",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers",
        "No family history of neurodegenerative disease, no prior neurological issues",
        "Male, 45-50, Caucasian",
        "North America",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment",
        "Riluzole, physical therapy, speech therapy",
        "high"
    )
    
    // Then verify it
    const verifyResult = verifyCase(
        1,
        true
    )
    
    expect(verifyResult.value).toBe(1)
    
    const medicalCase = getCase(1)
    expect(medicalCase["is-verified"]).toBe(true)
  })
  
  it("should fail to register a case if not an authorized registrar", () => {
    // Remove authorization
    authorizedRegistrars.delete(mockRegistrarPrincipal)
    
    const result = registerCase(
        "Neurological",
        "Progressive muscle weakness in limbs, fasciculations, dysarthria",
        "Fatigue, weight loss, occasional dysphagia",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers",
        "No family history of neurodegenerative disease, no prior neurological issues",
        "Male, 45-50, Caucasian",
        "North America",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment",
        "Riluzole, physical therapy, speech therapy",
        "high"
    )
    
    expect(result.error).toBe(403)
  })
  
  it("should fail to update a non-existent case", () => {
    const updateResult = updateCase(
        999,
        "Progressive muscle weakness in limbs, fasciculations, dysarthria, now with bulbar symptoms",
        "Fatigue, weight loss, dysphagia, occasional shortness of breath",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers, pulmonary function tests",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers, reduced vital capacity on PFTs",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment, now with respiratory involvement",
        "Riluzole, physical therapy, speech therapy, non-invasive ventilation at night",
        "critical"
    )
    
    expect(updateResult.error).toBe(404)
  })
  
  it("should fail to verify a case if not a verifier", () => {
    // First register a case
    registerCase(
        "Neurological",
        "Progressive muscle weakness in limbs, fasciculations, dysarthria",
        "Fatigue, weight loss, occasional dysphagia",
        "EMG, NCS, MRI of brain and spine, blood tests for autoimmune markers",
        "EMG shows widespread denervation, MRI negative for structural lesions, blood tests negative for common autoimmune markers",
        "No family history of neurodegenerative disease, no prior neurological issues",
        "Male, 45-50, Caucasian",
        "North America",
        "Rapid progression over 3 months, asymmetric onset, preserved cognitive function despite severe motor impairment",
        "Riluzole, physical therapy, speech therapy",
        "high"
    )
    
    // Remove verifier status
    verifiers.delete(mockVerifierPrincipal)
    
    // Then try to verify it
    const verifyResult = verifyCase(
        1,
        true
    )
    
    expect(verifyResult.error).toBe(403)
  })
})
