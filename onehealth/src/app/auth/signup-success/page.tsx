'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-200/20 to-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-2xl w-full"
      >
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Icon icon="solar:check-circle-bold" className="w-12 h-12 text-white" />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              Registration Submitted Successfully!
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-gray-600 mb-8 max-w-md mx-auto"
            >
              Thank you for choosing OneHealth. Your practice registration is being reviewed by our team.
            </motion.p>

            {/* What's Next */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-50 rounded-xl p-6 mb-8"
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center justify-center gap-2">
                <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600" />
                What happens next?
              </h2>
              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-purple-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Account Review</p>
                    <p className="text-sm text-gray-600">Our team will review your application within 24 hours</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-purple-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Email Confirmation</p>
                    <p className="text-sm text-gray-600">You'll receive login credentials at {' '}
                      <span className="font-medium">your registered email</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-purple-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Start Using OneHealth</p>
                    <p className="text-sm text-gray-600">Access your dashboard and begin managing your practice</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contact Support */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8"
            >
              <p className="text-sm text-blue-800">
                Need immediate assistance? Contact our support team at{' '}
                <a href="mailto:support@onehealth.com" className="font-medium underline">
                  support@onehealth.com
                </a>
              </p>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/">
                <Button variant="outline" size="lg" className="min-w-[150px]">
                  <Icon icon="solar:home-2-bold" className="w-5 h-5 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Link href="/login">
                <Button 
                  size="lg" 
                  className="min-w-[150px] bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                >
                  Go to Login
                  <Icon icon="solar:arrow-right-bold" className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-gray-600">
            Didn't receive an email? Check your spam folder or{' '}
            <button className="text-purple-600 hover:text-purple-700 font-medium">
              resend confirmation
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}