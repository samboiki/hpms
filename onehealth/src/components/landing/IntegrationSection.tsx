'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Icon } from '@iconify/react'
import Image from 'next/image'

const integrations = [
  {
    name: 'Medical Aids',
    description: 'Seamlessly connect with all major medical aid providers in Namibia for instant eligibility checks and claims processing.',
    logos: [
      { name: 'NMC', color: '#0052CC' },
      { name: 'Prosperity', color: '#00BFA5' },
      { name: 'Renaissance', color: '#7C3AED' },
      { name: 'Medscheme', color: '#EA4335' },
    ],
    icon: 'solar:shield-check-bold-duotone',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    name: 'Laboratory Partners',
    description: 'Direct integration with leading labs for real-time result delivery and automated patient notifications.',
    logos: [
      { name: 'PathCare', color: '#00BFA5' },
      { name: 'NIP', color: '#FF6B6B' },
      { name: 'Lancet', color: '#4285F4' },
      { name: 'Ampath', color: '#7C3AED' },
    ],
    icon: 'solar:test-tube-minimalistic-bold-duotone',
    color: 'from-green-500 to-teal-500',
  },
  {
    name: 'Pharmacy Networks',
    description: 'E-prescriptions sent directly to pharmacies with real-time medication availability and interaction checks.',
    logos: [
      { name: 'Dis-Chem', color: '#00B8D4' },
      { name: 'Clicks', color: '#FF5722' },
      { name: 'MediRite', color: '#4CAF50' },
      { name: 'Alpha', color: '#9C27B0' },
    ],
    icon: 'solar:pills-bold-duotone',
    color: 'from-purple-500 to-pink-500',
  },
]

export function IntegrationSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  // Create transforms for each integration
  const opacity0 = useTransform(scrollYProgress, [0, 0.05, 0.28, 0.33], [0, 1, 1, 0])
  const scale0 = useTransform(scrollYProgress, [0, 0.05, 0.28, 0.33], [0.9, 1, 1, 0.9])
  
  const opacity1 = useTransform(scrollYProgress, [0.33, 0.38, 0.61, 0.66], [0, 1, 1, 0])
  const scale1 = useTransform(scrollYProgress, [0.33, 0.38, 0.61, 0.66], [0.9, 1, 1, 0.9])
  
  const opacity2 = useTransform(scrollYProgress, [0.66, 0.71, 0.95, 1], [0, 1, 1, 0])
  const scale2 = useTransform(scrollYProgress, [0.66, 0.71, 0.95, 1], [0.9, 1, 1, 0.9])
  
  const integrationTransforms = [
    { opacity: opacity0, scale: scale0 },
    { opacity: opacity1, scale: scale1 },
    { opacity: opacity2, scale: scale2 },
  ]

  return (
    <section ref={containerRef} className="relative bg-white">
      {/* Section Header */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-purple-600 font-semibold text-sm uppercase tracking-wider">
            Seamless Integration
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
            Connected Healthcare Ecosystem
          </h2>
          <p className="text-xl text-gray-600">
            OneHealth integrates with all major healthcare providers, labs, and pharmacies 
            in Namibia for a truly connected patient experience.
          </p>
        </motion.div>
      </div>

      {/* Sticky Scroll Container */}
      <div className="relative">
        {integrations.map((integration, index) => {
          const start = index / integrations.length
          const end = (index + 1) / integrations.length

          return (
            <div
              key={index}
              className="sticky top-0 h-screen flex items-center"
              style={{ zIndex: integrations.length - index }}
            >
              <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Left: Integration Info */}
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.5 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${integration.color} mb-6`}>
                      <Icon icon={integration.icon} className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                      {integration.name}
                    </h3>
                    <p className="text-lg text-gray-600 mb-8">
                      {integration.description}
                    </p>

                    {/* Partner Logos */}
                    <div className="flex flex-wrap gap-4">
                      {integration.logos.map((logo, logoIndex) => (
                        <motion.div
                          key={logoIndex}
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: false }}
                          transition={{ delay: logoIndex * 0.1 }}
                          className="bg-gray-50 rounded-xl p-4 flex items-center justify-center"
                          style={{ minWidth: '120px' }}
                        >
                          <div
                            className="w-20 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: logo.color }}
                          >
                            {logo.name}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <motion.button
                      whileHover={{ x: 5 }}
                      className="mt-8 inline-flex items-center gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors"
                    >
                      View all integrations
                      <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
                    </motion.button>
                  </motion.div>

                  {/* Right: Visual */}
                  <motion.div className="hidden lg:block relative">
                    <motion.div
                      style={{
                        opacity: integrationTransforms[index].opacity,
                        scale: integrationTransforms[index].scale,
                      }}
                      className="relative"
                    >
                      {/* Connection visualization */}
                      <div className="relative w-full h-[500px]">
                        {/* Central hub */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <motion.div
                            animate={{
                              scale: [1, 1.1, 1],
                              rotate: [0, 180, 360],
                            }}
                            transition={{
                              duration: 20,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className={`w-32 h-32 rounded-full bg-gradient-to-r ${integration.color} flex items-center justify-center`}
                          >
                            <Icon icon="solar:health-bold-duotone" className="w-16 h-16 text-white" />
                          </motion.div>
                        </div>

                        {/* Orbiting logos */}
                        {integration.logos.map((logo, logoIndex) => {
                          const angle = (logoIndex / integration.logos.length) * 2 * Math.PI
                          const radius = 150
                          const x = Math.cos(angle) * radius
                          const y = Math.sin(angle) * radius

                          return (
                            <motion.div
                              key={logoIndex}
                              className="absolute top-1/2 left-1/2"
                              style={{
                                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                              }}
                              animate={{
                                rotate: [0, -360],
                              }}
                              transition={{
                                duration: 20,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                            >
                              <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg"
                                style={{ backgroundColor: logo.color }}
                              >
                                {logo.name}
                              </div>
                              {/* Connection line */}
                              <svg
                                className="absolute top-1/2 left-1/2 -z-10"
                                style={{
                                  width: radius,
                                  height: 2,
                                  transform: `translate(-${radius}px, -1px) rotate(${(logoIndex / integration.logos.length) * 360 + 180}deg)`,
                                }}
                              >
                                <motion.line
                                  x1="0"
                                  y1="1"
                                  x2={radius}
                                  y2="1"
                                  stroke={logo.color}
                                  strokeWidth="2"
                                  strokeDasharray="5 5"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: 1 }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                />
                              </svg>
                            </motion.div>
                          )
                        })}
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
              </div>

              {/* Background gradient */}
              <div
                className="absolute inset-0 -z-10"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${
                    index === 0 ? 'rgb(249, 250, 251)' : 'white'
                  }, ${index === integrations.length - 1 ? 'rgb(249, 250, 251)' : 'white'}, transparent)`,
                }}
              />
            </div>
          )
        })}

        {/* Spacer for scroll */}
        <div style={{ height: `${integrations.length * 75}vh` }} />
      </div>
    </section>
  )
}