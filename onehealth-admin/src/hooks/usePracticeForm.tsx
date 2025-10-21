import { useState } from 'react'
import type { PracticeFormData } from '../types/practice.types'
import { generateInitialFormData, validateFormStep } from '../utils/practice.utils'

export function usePracticeForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<PracticeFormData>(generateInitialFormData())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const nextStep = () => {
    if (currentStep < 7 && validateFormStep(currentStep, formData)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 7) {
      setCurrentStep(step)
    }
  }

  const resetForm = () => {
    setCurrentStep(1)
    setFormData(generateInitialFormData())
    setIsSubmitting(false)
  }

  const updateFormData = (updates: Partial<PracticeFormData>) => {
    setFormData(prevData => ({ ...prevData, ...updates }))
  }

  const isCurrentStepValid = () => {
    return validateFormStep(currentStep, formData)
  }

  const canProceedToNext = () => {
    return currentStep < 7 && isCurrentStepValid()
  }

  const canGoToPrevious = () => {
    return currentStep > 1
  }

  return {
    currentStep,
    formData,
    isSubmitting,
    setIsSubmitting,
    nextStep,
    prevStep,
    goToStep,
    resetForm,
    updateFormData,
    setFormData,
    isCurrentStepValid,
    canProceedToNext,
    canGoToPrevious
  }
}