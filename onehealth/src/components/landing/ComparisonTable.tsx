'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useInView } from 'react-intersection-observer'

const features = [
  { name: 'Namibian Built & Supported', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Multi-Branch Management', onehealth: true, nance: false, xir: false, good: false },
  { name: 'SMS Automations', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Email Automations', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Cloud & On-Premise Options', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Knowledge Base', onehealth: true, nance: true, xir: false, good: true },
  { name: 'Free Website & Custom Domain', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Value for Money', onehealth: true, nance: false, xir: true, good: false },
  { name: 'Accounting Integration', onehealth: true, nance: true, xir: true, good: true },
  { name: 'Accounts Receivable', onehealth: true, nance: true, xir: true, good: false },
  { name: 'Activity Dashboard', onehealth: true, nance: true, xir: false, good: true },
  { name: 'Admissions Management', onehealth: true, nance: false, xir: true, good: false },
  { name: 'Alerts/Notifications', onehealth: true, nance: true, xir: false, good: true },
  { name: 'Appointment Management', onehealth: true, nance: true, xir: true, good: true },
  { name: 'Appointment Scheduling', onehealth: true, nance: true, xir: true, good: true },
  { name: 'Billing & Invoicing', onehealth: true, nance: true, xir: true, good: true },
  { name: 'Case Management', onehealth: true, nance: false, xir: true, good: false },
  { name: 'Charting', onehealth: true, nance: true, xir: true, good: true },
  { name: 'Customizable Dashboard', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Customizable Forms', onehealth: true, nance: false, xir: true, good: false },
  { name: 'Customizable Reports', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Document Management', onehealth: true, nance: true, xir: true, good: false },
  { name: 'In-Patient Management', onehealth: true, nance: false, xir: true, good: false },
  { name: 'Inventory Management', onehealth: true, nance: true, xir: true, good: false },
  { name: 'Medical Billing', onehealth: true, nance: true, xir: true, good: true },
  { name: 'Mobile Ready - Use Anywhere', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Automated Care Plans', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Patient Portal', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Auto-Generated Leave Forms', onehealth: true, nance: false, xir: false, good: false },
  { name: 'World-Class Reporting', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Natural Language Processing', onehealth: true, nance: false, xir: false, good: false },
  { name: 'Branded Documents', onehealth: true, nance: false, xir: false, good: false },
]

export function ComparisonTable() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-teal-100 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:chart-square-bold-duotone" className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Feature Comparison</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Why OneHealth is the
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-600"> Clear Choice</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how OneHealth compares to other practice management solutions in the market.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="overflow-x-auto"
        >
          <div className="min-w-[800px] bg-white rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  <th className="px-6 py-4 text-left font-semibold">Features</th>
                  <th className="px-6 py-4 text-center font-semibold">
                    <div className="flex flex-col items-center">
                      <span className="text-xl">OneHealth</span>
                      <span className="text-xs opacity-80 mt-1">Recommended</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center font-semibold">Nance</th>
                  <th className="px-6 py-4 text-center font-semibold">Xir</th>
                  <th className="px-6 py-4 text-center font-semibold">Good</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.1 + index * 0.02 }}
                    className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-purple-50 transition-colors`}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{feature.name}</td>
                    <td className="px-6 py-4 text-center">
                      {feature.onehealth ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.3 + index * 0.02 }}
                        >
                          <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500 mx-auto" />
                        </motion.div>
                      ) : (
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {feature.nance ? (
                        <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500 mx-auto" />
                      ) : (
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {feature.xir ? (
                        <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500 mx-auto" />
                      ) : (
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {feature.good ? (
                        <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500 mx-auto" />
                      ) : (
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-300 mx-auto" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-purple-100 to-pink-100 px-8 py-4 rounded-full">
            <Icon icon="solar:cup-star-bold-duotone" className="w-8 h-8 text-purple-600" />
            <div className="text-left">
              <p className="text-sm text-purple-600 font-medium">The Clear Winner</p>
              <p className="text-lg font-bold text-gray-900">OneHealth offers 100% of essential features</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}