'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Icon } from '@iconify/react'

export function BannerSection() {
  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="absolute inset-0 bg-white/40" />
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            The Future of Healthcare is
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mt-2">
              Already Here
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join thousands of healthcare providers who have transformed their practice with OneHealth&apos;s intelligent management system
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative max-w-6xl mx-auto"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl">
            <Image
              src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&q=80"
              alt="Healthcare Technology"
              width={1920}
              height={1080}
              className="w-full h-[600px] object-cover"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>

          {/* Floating elements */}
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-8 -right-8 bg-white rounded-2xl shadow-xl p-6 hidden md:block"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100">
                <Icon icon="solar:check-circle-bold" className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">HIPAA Compliant</div>
                <div className="text-sm text-gray-600">Fully Secure</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{
              y: [0, 10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5
            }}
            className="absolute -bottom-8 -left-8 bg-white rounded-2xl shadow-xl p-6 hidden md:block"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-100">
                <Icon icon="solar:star-bold" className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">5-Star Rated</div>
                <div className="text-sm text-gray-600">By Healthcare Pros</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}