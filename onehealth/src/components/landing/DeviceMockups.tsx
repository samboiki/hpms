'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useInView } from 'react-intersection-observer'
import Image from 'next/image'

export function DeviceMockups() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated background elements */}
      <motion.div
        className="absolute top-20 right-10 w-72 h-72 bg-purple-200/30 rounded-full blur-3xl"
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-20 left-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"
        animate={{
          x: [0, -20, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:devices-bold-duotone" className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Cross-Platform Experience</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Powerful Dashboard
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"> Everywhere</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Access your practice data from any device. Desktop power meets mobile convenience.
          </p>
        </motion.div>

        <div ref={ref} className="relative">
          {/* Laptop Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative z-20"
          >
            <div className="relative mx-auto max-w-5xl">
              {/* Laptop Frame */}
              <div className="relative bg-gray-900 rounded-t-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <div className="flex-1 flex justify-center">
                    <div className="bg-gray-800 rounded px-4 py-1 text-xs text-gray-400">
                      onehealth.com.na
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Content */}
                <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-white">Good Morning, Dr. Smith</h3>
                        <p className="text-purple-100">Today&apos;s Overview - Monday, 26 Jan 2025</p>
                      </div>
                      <Image
                        src="/onehealthlogo.png"
                        alt="OneHealth"
                        width={120}
                        height={40}
                        className="h-8 w-auto brightness-0 invert"
                      />
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      {[
                        { label: 'Appointments Today', value: '24', icon: 'solar:calendar-bold-duotone', color: 'text-blue-600' },
                        { label: 'New Patients', value: '8', icon: 'solar:user-plus-bold-duotone', color: 'text-green-600' },
                        { label: 'Revenue Today', value: 'N$12.5k', icon: 'solar:dollar-circle-bold-duotone', color: 'text-purple-600' },
                        { label: 'Pending Tasks', value: '3', icon: 'solar:checklist-bold-duotone', color: 'text-orange-600' },
                      ].map((stat, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={inView ? { opacity: 1, scale: 1 } : {}}
                          transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                          className="bg-gray-50 rounded-xl p-4"
                        >
                          <Icon icon={stat.icon} className={`w-6 h-6 ${stat.color} mb-2`} />
                          <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                          <p className="text-sm text-gray-600">{stat.label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Chart Placeholder */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Weekly Revenue Trend</h4>
                      <div className="h-40 flex items-end justify-between gap-2">
                        {[40, 65, 45, 70, 85, 75, 90].map((height, index) => (
                          <motion.div
                            key={index}
                            initial={{ height: 0 }}
                            animate={inView ? { height: `${height}%` } : {}}
                            transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                            className="flex-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-lg"
                          />
                        ))}
                      </div>
                    </div>

                    {/* Recent Appointments */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h4>
                      <div className="space-y-2">
                        {[
                          { time: '09:00', patient: 'John Doe', type: 'Consultation', status: 'confirmed' },
                          { time: '10:30', patient: 'Jane Smith', type: 'Follow-up', status: 'confirmed' },
                          { time: '14:00', patient: 'Mike Johnson', type: 'Procedure', status: 'pending' },
                        ].map((appointment, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ duration: 0.3, delay: 1 + index * 0.1 }}
                            className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-semibold text-purple-600">{appointment.time}</span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{appointment.patient}</p>
                                <p className="text-sm text-gray-600">{appointment.type}</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              appointment.status === 'confirmed' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {appointment.status}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Laptop Base */}
              <div className="bg-gray-300 h-4 rounded-b-2xl mx-auto" style={{ width: '80%' }} />
              <div className="bg-gray-400 h-2 rounded-b-lg mx-auto" style={{ width: '60%' }} />
            </div>
          </motion.div>

          {/* Mobile Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 100, y: 20 }}
            animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute -bottom-10 right-0 z-30 w-72"
          >
            <div className="bg-gray-900 rounded-3xl p-2 shadow-2xl">
              <div className="bg-white rounded-2xl overflow-hidden">
                {/* Mobile Status Bar */}
                <div className="bg-gray-900 text-white text-xs px-4 py-1 flex justify-between items-center">
                  <span>9:41</span>
                  <div className="flex gap-1">
                    <Icon icon="solar:wifi-router-bold" className="w-3 h-3" />
                    <Icon icon="solar:battery-full-bold" className="w-3 h-3" />
                  </div>
                </div>

                {/* Mobile Content */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
                  <Image
                    src="/onehealthlogo.png"
                    alt="OneHealth"
                    width={100}
                    height={30}
                    className="h-6 w-auto brightness-0 invert mb-2"
                  />
                  <p className="text-white text-sm">Welcome back!</p>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-purple-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Today&apos;s Appointments</span>
                      <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">24</p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">New Patients</span>
                      <Icon icon="solar:user-plus-bold-duotone" className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">8</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { icon: 'solar:calendar-bold-duotone', label: 'Schedule' },
                      { icon: 'solar:users-group-rounded-bold-duotone', label: 'Patients' },
                      { icon: 'solar:chart-2-bold-duotone', label: 'Reports' },
                    ].map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-center">
                        <Icon icon={item.icon} className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                        <span className="text-xs text-gray-600">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floating UI Elements */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="absolute top-10 left-10 bg-white rounded-xl shadow-xl p-4 z-10"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Appointment Confirmed</p>
                <p className="text-sm text-gray-600">John Doe - 09:00 AM</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="absolute bottom-40 left-20 bg-white rounded-xl shadow-xl p-4 z-10"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Icon icon="solar:dollar-circle-bold-duotone" className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Payment Received</p>
                <p className="text-sm text-gray-600">N$2,500</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}