'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'

const services = [
  {
    title: 'Personal',
    description: 'Build more websites',
    icon: 'solar:user-bold-duotone',
    color: 'from-yellow-400 to-orange-500',
    bgColor: 'bg-gradient-to-br from-yellow-400 to-orange-500',
  },
  {
    title: 'Marketing',
    description: 'Iterate at super speeds',
    icon: 'solar:megaphone-bold-duotone',
    color: 'from-orange-400 to-red-500',
    bgColor: 'bg-gradient-to-br from-orange-400 to-red-500',
  },
  {
    title: 'Startups',
    description: 'Big launch. Small team.',
    icon: 'solar:rocket-bold-duotone',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  {
    title: 'Scaleups',
    description: 'Ship sites that scale',
    icon: 'solar:graph-up-bold-duotone',
    color: 'from-purple-600 to-purple-800',
    bgColor: 'bg-gradient-to-br from-purple-600 to-purple-800',
  },
  {
    title: 'Freelance',
    description: 'Build sites from A to Z',
    icon: 'solar:case-round-bold-duotone',
    color: 'from-blue-400 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-400 to-cyan-500',
  },
  {
    title: 'Agencies',
    description: 'Meet every deadline',
    icon: 'solar:buildings-bold-duotone',
    color: 'from-indigo-500 to-purple-600',
    bgColor: 'bg-gradient-to-br from-indigo-500 to-purple-600',
  },
]

interface ServicesDropdownProps {
  isOpen: boolean
  onClose: () => void
}

export function ServicesDropdown({ isOpen, onClose }: ServicesDropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <div className="container mx-auto px-4">
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-200/50">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {services.map((service, index) => (
                    <motion.div
                      key={service.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      className="cursor-pointer"
                    >
                      <div className={`${service.bgColor} rounded-2xl p-6 text-white h-full relative overflow-hidden group`}>
                        <div className="relative z-10">
                          <Icon icon={service.icon} className="w-8 h-8 mb-3 opacity-90" />
                          <h3 className="font-bold text-lg mb-1">{service.title}</h3>
                          <p className="text-sm opacity-90">{service.description}</p>
                        </div>
                        
                        {/* Hover effect */}
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Decorative element */}
                        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Healthcare specific services */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Healthcare Solutions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <Icon icon="solar:hospital-bold-duotone" className="w-6 h-6 text-purple-600 mt-1" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Multi-Branch Management</h4>
                        <p className="text-sm text-gray-600">Manage multiple locations seamlessly</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <Icon icon="solar:heart-pulse-bold-duotone" className="w-6 h-6 text-purple-600 mt-1" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Patient Care</h4>
                        <p className="text-sm text-gray-600">Comprehensive patient management</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <Icon icon="solar:chart-2-bold-duotone" className="w-6 h-6 text-purple-600 mt-1" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Analytics & Reports</h4>
                        <p className="text-sm text-gray-600">Data-driven insights for growth</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}