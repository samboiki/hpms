'use client'

import { PracticeSignupForm } from '@/components/auth/PracticeSignupForm'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon } from '@iconify/react'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-200/20 to-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Icon icon="solar:arrow-left-bold" className="w-6 h-6 text-gray-600" />
              <span className="font-semibold text-gray-700">Back to Home</span>
            </Link>
            <div className="flex items-center gap-2">
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Secure Sign Up</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto"
        >
          {/* Title Section */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gray-900">Start Your Free</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                OneHealth Journey
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Join 500+ healthcare providers who have transformed their practice management. 
              Complete setup in minutes, no credit card required.
            </p>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 mb-10">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
              <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Free Forever Plan</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
              <Icon icon="solar:shield-minimalistic-bold-duotone" className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
              <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">5-Minute Setup</span>
            </div>
          </div>

          {/* Form */}
          <PracticeSignupForm />

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}