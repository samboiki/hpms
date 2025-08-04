'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Image from 'next/image'

export function AISystemSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Duotone background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black" />
      
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-40 w-80 h-80 bg-blue-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight"
            >
              The first composable<br />
              <span className="gradient-text">AI system</span>, built for rapid<br />
              policy change.
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-300 mb-12"
            >
              Purpose-built for Health & Human Services<br />
              and other government agencies.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-6"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl transition-all"
              >
                Get Started
                <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 border-2 border-gray-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/10 transition-all"
              >
                Watch Demo
                <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Right: Visual */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            {/* Phone mockup */}
            <div className="relative mx-auto w-80">
              {/* Gradient background */}
              <div className="absolute -inset-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-3xl blur-2xl opacity-50" />
              
              {/* Phone frame */}
              <div className="relative bg-gray-900 rounded-[3rem] p-4 shadow-2xl">
                <div className="bg-white rounded-[2.5rem] overflow-hidden">
                  {/* Phone screen */}
                  <div className="bg-gray-50 p-8">
                    {/* Status bar */}
                    <div className="flex justify-between items-center mb-8 text-xs text-gray-600">
                      <span>9:41</span>
                      <div className="flex gap-1">
                        <Icon icon="solar:signal-full-bold" className="w-4 h-4" />
                        <Icon icon="solar:wifi-router-bold" className="w-4 h-4" />
                        <Icon icon="solar:battery-full-bold" className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-gray-900 mb-8">Request Sent</h3>
                      
                      {/* Success illustration */}
                      <div className="relative w-32 h-32 mx-auto mb-8">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full" />
                        <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center">
                            <Icon icon="solar:document-text-bold-duotone" className="w-10 h-10 text-purple-600" />
                          </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <Icon icon="solar:check-bold" className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <button className="w-full gradient-purple-blue text-white py-4 rounded-2xl font-semibold">
                        Track Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}