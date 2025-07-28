'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Icon } from '@iconify/react'

export function LegacyBanner() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })

  const x = useTransform(scrollYProgress, [0, 1], [-100, 100])

  return (
    <section ref={ref} className="relative py-24 overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Animated background elements */}
      <motion.div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          x
        }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Warning icon */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="inline-flex p-4 rounded-full bg-orange-500/20 mb-6"
          >
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-12 h-12 text-orange-400" />
          </motion.div>

          {/* Main message */}
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight"
          >
            Legacy systems are{' '}
            <span className="text-orange-400">expensive</span>,{' '}
            <span className="text-red-400">insecure</span>, and{' '}
            <span className="text-purple-400">stall innovation</span>.
          </motion.h2>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-12"
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">75%</div>
              <p className="text-gray-300">Higher maintenance costs</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-red-400 mb-2">3x</div>
              <p className="text-gray-300">More security vulnerabilities</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">60%</div>
              <p className="text-gray-300">Slower feature deployment</p>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-12"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl transition-all"
            >
              Modernize Your Practice
              <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}