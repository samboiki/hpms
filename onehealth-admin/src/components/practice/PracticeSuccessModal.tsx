import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

interface PracticeSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  practiceName: string
  monthlyPremium: number
  numberOfBranches: number
  professionalEmails: number
}

export function PracticeSuccessModal({
  isOpen,
  onClose,
  practiceName,
  monthlyPremium,
  numberOfBranches,
  professionalEmails
}: PracticeSuccessModalProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-in overflow-hidden">
        {/* Success Header with Gradient */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-500 to-blue-600 p-8 text-white overflow-hidden">
          {/* Animated Background Patterns */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 right-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          {/* Success Icon */}
          <div className="relative flex flex-col items-center mb-6">
            <div className="relative">
              {/* Pulsing rings */}
              <div className="absolute inset-0 bg-white rounded-full opacity-30 animate-ping"></div>
              <div className="absolute inset-0 bg-white rounded-full opacity-20 animate-pulse"></div>

              {/* Main icon */}
              <div className="relative bg-white rounded-full p-6 shadow-2xl">
                <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-500" />
              </div>
            </div>

            <h2 className="text-3xl font-bold mt-6 mb-2">Practice Registered Successfully!</h2>
            <p className="text-purple-100 text-lg">Welcome to OneHealth</p>
          </div>
        </div>

        {/* Practice Details */}
        <div className="p-8">
          {/* Practice Name Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 rounded-xl p-6 mb-6 border border-gray-200/50">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:buildings-3-bold-duotone" className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">{practiceName}</h3>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center border border-gray-100 shadow-sm">
                <Icon icon="solar:wallet-money-bold-duotone" className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">N${monthlyPremium.toLocaleString()}</p>
                <p className="text-xs text-gray-600 mt-1">Monthly Premium</p>
              </div>

              <div className="bg-white rounded-lg p-4 text-center border border-gray-100 shadow-sm">
                <Icon icon="solar:map-point-bold-duotone" className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{numberOfBranches}</p>
                <p className="text-xs text-gray-600 mt-1">{numberOfBranches === 1 ? 'Branch' : 'Branches'}</p>
              </div>

              <div className="bg-white rounded-lg p-4 text-center border border-gray-100 shadow-sm">
                <Icon icon="solar:letter-bold-duotone" className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">{professionalEmails}</p>
                <p className="text-xs text-gray-600 mt-1">Email{professionalEmails !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-xl p-6 mb-6 border border-blue-100">
            <div className="flex items-start gap-3">
              <Icon icon="solar:lightbulb-bolt-bold-duotone" className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Next Steps</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>SMS and email subscriptions have been created</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Branch records have been initialized</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Practice is now active and ready to use</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Icon icon="solar:eye-bold-duotone" className="w-5 h-5" />
              View Practice
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}