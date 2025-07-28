'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-200/20 to-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-32 mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="max-w-2xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-purple-100/80 backdrop-blur-md px-6 py-3 rounded-full mb-8 border border-purple-200"
            >
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">Trusted by 500+ Healthcare Providers</span>
            </motion.div>

            {/* Heading */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
            >
              <span className="text-gray-900">The everything app,</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                for healthcare work.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed font-montserrat"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              One app for practices, knowledge, conversations, and more. 
              Get more done faster—together.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/auth/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg text-lg px-8 py-6 rounded-xl font-semibold shadow-md hover:scale-[1.02] transition-all"
                >
                  Get started. It's FREE!
                  <Icon icon="solar:arrow-right-bold" className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 text-lg px-8 py-6 rounded-xl font-semibold transition-all"
                >
                  <Icon icon="solar:play-bold" className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center gap-8 mt-12"
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:star-bold" className="w-5 h-5 text-yellow-500" />
                <span className="font-semibold text-gray-700">4.9/5 Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-gray-700">10,000+ Patients</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:shield-check-bold" className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-gray-700">HIPAA Compliant</span>
              </div>
            </motion.div>

            {/* Free Forever Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600"
            >
              <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
              <span className="font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Free Forever. No Credit Card.
              </span>
            </motion.div>
          </div>

          {/* Right Content - Dashboard Preview with Mobile Overlay */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative lg:pl-12"
          >
            <div className="relative">
              {/* Main Dashboard Image - Extra Large and Prominent */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl transform scale-110 origin-left">
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-70 z-10" />
                <Image
                  src="/dash.png"
                  alt="OneHealth Dashboard"
                  width={1000}
                  height={750}
                  className="w-full h-auto"
                  priority
                />
              </div>

              {/* Mobile Phone Overlay - Much Smaller and Overlapping */}
              <motion.div
                initial={{ opacity: 0, y: 40, x: -20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="absolute -bottom-6 -right-16 z-30"
              >
                <div className="relative">
                  <Image
                    src="/Screenshot 2025-07-26 162326-portrait.png"
                    alt="OneHealth Mobile App"
                    width={140}
                    height={300}
                    className="h-[240px] w-auto drop-shadow-2xl"
                    priority
                  />
                  {/* Mobile Feature Badge - Smaller to match phone */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.9 }}
                    className="absolute -top-3 -left-3 bg-white rounded-lg shadow-lg p-2 flex items-center gap-1.5"
                  >
                    <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                      <Icon icon="solar:smartphone-bold-duotone" className="w-3 h-3 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-rubik font-semibold text-[10px] text-gray-900">Mobile</p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Floating Feature Cards */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="absolute top-1/3 -left-8 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3 z-20"
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Icon icon="solar:chart-2-bold-duotone" className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-rubik font-semibold text-sm text-gray-900">Real-time Analytics</p>
                  <p className="text-xs text-gray-600 font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Track performance
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}