'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CommunicationSection() {
  return (
    <section className="relative py-20 overflow-hidden bg-gradient-to-br from-gray-50 via-white to-purple-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-200/10 to-blue-200/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tr from-blue-200/10 to-purple-200/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-xl"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-orange-100/80 backdrop-blur-md px-4 py-2 rounded-full mb-6 border border-orange-200"
            >
              <Icon icon="solar:chat-round-dots-bold-duotone" className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Communications Center</span>
            </motion.div>

            {/* Heading with split animation */}
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight"
            >
              <span className="text-gray-900">Upgrade to a </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
                cost-effective system
              </span>
              <br />
              <span className="text-gray-900">that delivers measurable </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                ROI
              </span>
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-lg text-gray-600 mb-8 leading-relaxed font-montserrat"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              Reduce administrative burden while improving patient engagement. Our intelligent 
              communication suite automates reminders, handles bulk messaging, and tracks 
              delivery metrics—all while staying compliant.
            </motion.p>

            {/* Feature List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="space-y-4 mb-8"
            >
              {[
                { icon: 'solar:smartphone-2-bold-duotone', text: 'Automated SMS & WhatsApp reminders', color: 'text-green-600' },
                { icon: 'solar:letter-opened-bold-duotone', text: 'Professional email campaigns', color: 'text-blue-600' },
                { icon: 'solar:chart-2-bold-duotone', text: 'Real-time delivery analytics', color: 'text-purple-600' },
                { icon: 'solar:shield-check-bold-duotone', text: 'POPI compliant communications', color: 'text-orange-600' }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon icon={feature.icon} className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <span className="font-montserrat text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {feature.text}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              viewport={{ once: true }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/features#communications">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:shadow-lg text-base px-6 py-3 rounded-xl font-semibold shadow-md hover:scale-[1.02] transition-all"
                >
                  Explore Communications
                  <Icon icon="solar:arrow-right-bold" className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 text-base px-6 py-3 rounded-xl font-semibold transition-all"
                >
                  <Icon icon="solar:calculator-bold" className="w-4 h-4 mr-2" />
                  Calculate ROI
                </Button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              viewport={{ once: true }}
              className="flex flex-wrap items-center gap-6 mt-8 pt-8 border-t border-gray-200"
            >
              <div>
                <p className="text-2xl font-bold text-gray-900">97.2%</p>
                <p className="text-sm text-gray-600 font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  SMS delivery rate
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">75%</p>
                <p className="text-sm text-gray-600 font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Reduced no-shows
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">4.8/5</p>
                <p className="text-sm text-gray-600 font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Patient satisfaction
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - Communications Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative lg:pl-8"
          >
            <div className="relative">
              {/* Main Dashboard Image */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/com.png"
                  alt="OneHealth Communications Center"
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                  priority
                />
              </div>

              {/* Floating Stats Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Icon icon="solar:smartphone-vibration-bold-duotone" className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-rubik font-semibold text-sm text-gray-900">SMS Sent Today</p>
                  <p className="text-2xl font-bold text-green-600">142</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon icon="solar:letter-bold-duotone" className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-rubik font-semibold text-sm text-gray-900">Emails Delivered</p>
                  <p className="text-2xl font-bold text-blue-600">256</p>
                </div>
              </motion.div>

              {/* Active Status Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">Active Services</span>
              </motion.div>

              {/* Success Rate Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                viewport={{ once: true }}
                className="absolute bottom-4 right-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg"
              >
                <p className="text-xs font-medium opacity-90">Success Rate</p>
                <p className="text-xl font-bold">98.6%</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}