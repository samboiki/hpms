'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Image from 'next/image'

const workflows = [
  {
    step: '01',
    title: 'Patient Check-In',
    description: 'Patients check in using QR codes or self-service kiosks. Medical history and insurance are automatically verified.',
    features: [
      'QR code check-in',
      'Insurance verification',
      'Medical history review',
      'Queue management',
    ],
    icon: 'solar:user-scan-bold-duotone',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
    color: 'from-purple-500 to-pink-500',
  },
  {
    step: '02',
    title: 'Clinical Documentation',
    description: 'Doctors use voice-to-text and smart templates for efficient documentation. AI assists with diagnoses and treatment plans.',
    features: [
      'Voice-to-text notes',
      'Smart templates',
      'AI diagnosis support',
      'Drug interaction checks',
    ],
    icon: 'solar:document-medicine-bold-duotone',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    step: '03',
    title: 'Lab & Imaging',
    description: 'Orders are sent electronically to labs and imaging centers. Results are automatically imported back into patient records.',
    features: [
      'Electronic orders',
      'Result tracking',
      'Auto-import results',
      'Patient notifications',
    ],
    icon: 'solar:test-tube-minimalistic-bold-duotone',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800',
    color: 'from-green-500 to-teal-500',
  },
  {
    step: '04',
    title: 'Billing & Claims',
    description: 'Automated billing processes insurance claims and patient payments. Real-time eligibility checks prevent claim denials.',
    features: [
      'Auto-claim submission',
      'Payment processing',
      'Denial management',
      'Financial reporting',
    ],
    icon: 'solar:bill-list-bold-duotone',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
    color: 'from-orange-500 to-red-500',
  },
]

export function WorkflowSection() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 font-semibold text-sm uppercase tracking-wider">
            Streamlined Workflow
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
            From Check-In to Check-Out
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience a seamless patient journey with our intelligent workflow automation that saves time and improves care quality
          </p>
        </motion.div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200" />
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-purple-600 to-blue-600"
              initial={{ width: '0%' }}
              animate={{ width: `${((activeStep + 1) / workflows.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
            
            <div className="relative flex justify-between">
              {workflows.map((workflow, index) => (
                <button
                  key={workflow.step}
                  onClick={() => setActiveStep(index)}
                  className="group"
                >
                  <motion.div
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold transition-all duration-300 ${
                      index <= activeStep
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-transparent text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {workflow.step}
                  </motion.div>
                  <span className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 text-sm font-medium whitespace-nowrap transition-colors ${
                    index === activeStep ? 'text-purple-600' : 'text-gray-500'
                  }`}>
                    {workflow.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Text Content */}
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={`p-4 rounded-2xl bg-gradient-to-r ${workflows[activeStep].color}`}
              >
                <Icon icon={workflows[activeStep].icon} className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                  {workflows[activeStep].step}
                </div>
              </div>
            </div>

            <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
              {workflows[activeStep].title}
            </h3>

            <p className="text-lg text-gray-600 leading-relaxed">
              {workflows[activeStep].description}
            </p>

            <div className="space-y-3">
              {workflows[activeStep].features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icon icon="solar:arrow-left-bold" className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveStep(Math.min(workflows.length - 1, activeStep + 1))}
                disabled={activeStep === workflows.length - 1}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next Step
                <Icon icon="solar:arrow-right-bold" className="w-5 h-5 inline ml-2" />
              </button>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            key={`image-${activeStep}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src={workflows[activeStep].image}
                alt={workflows[activeStep].title}
                width={800}
                height={600}
                className="w-full h-[500px] object-cover"
              />
              
              {/* Decorative overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              
              {/* Step indicator */}
              <div className="absolute top-8 right-8">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-sm font-medium text-gray-600">Step</span>
                  <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 ml-2">
                    {workflows[activeStep].step}
                  </span>
                </div>
              </div>
            </div>

            {/* Decorative blob */}
            <div className={`absolute -z-10 top-1/2 -translate-y-1/2 -right-20 w-96 h-96 bg-gradient-to-r ${workflows[activeStep].color} rounded-full blur-3xl opacity-20`} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}