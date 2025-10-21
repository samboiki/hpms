import React from 'react'
import { Icon } from '@iconify/react'
import { FORM_STEPS } from '../../constants/practice.constants'

interface StepIndicatorProps {
  currentStep: number
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {FORM_STEPS.map((step) => (
          <div key={step.id} className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all ${
                step.id <= currentStep
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <Icon icon={step.icon} className="w-5 h-5" />
            </div>
            <span className={`text-xs font-medium ${
              step.id <= currentStep ? 'text-purple-600' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300 scroll-progress-bar"
          style={{ width: `${(currentStep / 7) * 100}%` }}
        />
      </div>
    </div>
  )
}