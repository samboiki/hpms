'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Image from 'next/image'

const features = [
  {
    title: 'Smart Scheduling',
    description: 'AI-powered appointment scheduling that reduces no-shows by 40% with automated reminders and intelligent time slot optimization.',
    icon: 'solar:calendar-mark-bold-duotone',
    image: '/scheduling screen.png',
    color: 'from-purple-500 to-pink-500',
    stats: [
      { value: '40%', label: 'Less No-shows' },
      { value: '2x', label: 'Faster Booking' },
    ]
  },
  {
    title: 'Message Center',
    description: 'Send personalized SMS messages to patients with appointment reminders, follow-up care instructions, and health tips using customizable templates.',
    icon: 'solar:chat-round-dots-bold-duotone',
    image: '/message from the app.png',
    color: 'from-blue-500 to-cyan-500',
    stats: [
      { value: 'Bulk', label: 'SMS Capability' },
      { value: '100%', label: 'Delivery Rate' },
    ]
  },
  {
    title: 'Automated Billing',
    description: 'Streamline your revenue cycle with automated insurance claims, payment processing, and comprehensive financial reporting.',
    icon: 'solar:bill-list-bold-duotone',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
    color: 'from-green-500 to-teal-500',
    stats: [
      { value: '60%', label: 'Faster Payments' },
      { value: '95%', label: 'Claim Success' },
    ]
  },
  {
    title: 'Clinical Documentation',
    description: 'Comprehensive EHR system with customizable templates, voice-to-text notes, and intelligent clinical decision support.',
    icon: 'solar:document-medicine-bold-duotone',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800',
    color: 'from-orange-500 to-red-500',
    stats: [
      { value: '50%', label: 'Time Saved' },
      { value: '100+', label: 'Templates' },
    ]
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 bg-white" id="features">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 font-semibold text-sm uppercase tracking-wider">
            Powerful Features
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
            Everything You Need to Run Your Practice
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From patient check-in to billing, our comprehensive suite of features covers every aspect of healthcare management
          </p>
        </motion.div>

        <div className="space-y-32">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className={`grid lg:grid-cols-2 gap-12 items-center ${
                index % 2 === 1 ? 'lg:grid-flow-dense' : ''
              }`}
            >
              {/* Content */}
              <div className={`space-y-6 ${index % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${feature.color}`}
                >
                  <Icon icon={feature.icon} className="w-8 h-8 text-white" />
                </motion.div>

                <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {feature.title}
                </h3>

                <p className="text-lg text-gray-600 leading-relaxed">
                  {feature.description}
                </p>

                <div className="flex gap-8">
                  {feature.stats.map((stat) => (
                    <div key={stat.label}>
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-600">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ x: 5 }}
                  className="inline-flex items-center gap-2 text-purple-600 font-semibold group"
                >
                  Learn more about {feature.title}
                  <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>

              {/* Image */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={`relative ${index % 2 === 1 ? 'lg:col-start-1' : ''}`}
              >
                {/* Main container with perspective */}
                <div className="relative group">
                  {/* Animated gradient background */}
                  <div className={`absolute -inset-4 bg-gradient-to-r ${feature.color} rounded-3xl blur-2xl opacity-30 group-hover:opacity-40 transition-opacity duration-700`} />
                  
                  {/* Glass morphism container */}
                  <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-2 border border-white/20 shadow-2xl">
                    {/* Inner container with transform */}
                    <motion.div
                      whileHover={{ 
                        rotateY: index % 2 === 0 ? 5 : -5,
                        scale: 1.02,
                      }}
                      transition={{ type: "spring", stiffness: 300 }}
                      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
                      className="relative rounded-2xl overflow-hidden"
                    >
                      {/* Gradient overlay for depth */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 z-10 pointer-events-none" />
                      
                      {/* Main image */}
                      <div className={`relative ${feature.image.includes('.png') ? 'bg-gradient-to-br from-gray-50 to-gray-100' : ''}`}>
                        <Image
                          src={feature.image}
                          alt={feature.title}
                          width={800}
                          height={600}
                          className={`w-full h-[500px] ${feature.image.includes('.png') ? 'object-contain p-8' : 'object-cover'}`}
                        />
                        
                        {/* Animated scan line effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent"
                          animate={{ y: [-500, 500] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          style={{ height: '200px' }}
                        />
                      </div>
                      
                      {/* Premium overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      
                      {/* Floating UI elements */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="absolute top-6 left-6 right-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-white/90 text-sm font-medium">Live System</span>
                          </div>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-white/40 rounded-full" />
                            <div className="w-2 h-2 bg-white/60 rounded-full" />
                            <div className="w-2 h-2 bg-white/80 rounded-full" />
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Feature info card */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="absolute bottom-0 left-0 right-0 p-6"
                      >
                        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl p-6 border border-white/20">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <motion.div
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.5 }}
                                className={`p-3 rounded-xl bg-gradient-to-r ${feature.color} shadow-lg`}
                              >
                                <Icon icon={feature.icon} className="w-6 h-6 text-white" />
                              </motion.div>
                              <div>
                                <h4 className="font-bold text-white text-lg">{feature.title}</h4>
                                <p className="text-white/70 text-sm">Premium Feature</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full border border-white/30">
                                Enhanced
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <motion.div 
                              whileHover={{ scale: 1.05 }}
                              className="flex items-center gap-2 bg-white/10 rounded-lg p-2"
                            >
                              <Icon icon="solar:verified-check-bold" className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-white/90">AI-Powered</span>
                            </motion.div>
                            <motion.div 
                              whileHover={{ scale: 1.05 }}
                              className="flex items-center gap-2 bg-white/10 rounded-lg p-2"
                            >
                              <Icon icon="solar:shield-star-bold" className="w-4 h-4 text-blue-400" />
                              <span className="text-sm text-white/90">Enterprise</span>
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>
                  
                  {/* Floating particles */}
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className={`absolute w-2 h-2 bg-gradient-to-r ${feature.color} rounded-full`}
                      animate={{
                        x: [0, 30, -30, 0],
                        y: [0, -30, 30, 0],
                        scale: [1, 1.5, 1, 1],
                      }}
                      transition={{
                        duration: 5 + i,
                        repeat: Infinity,
                        delay: i * 0.5,
                      }}
                      style={{
                        top: `${20 + i * 30}%`,
                        left: `${80 + i * 5}%`,
                      }}
                    />
                  ))}
                </div>

                {/* Decorative elements */}
                <div className={`absolute -z-10 top-8 ${index % 2 === 0 ? '-right-8' : '-left-8'} w-72 h-72 bg-gradient-to-r ${feature.color} rounded-full blur-3xl opacity-20 animate-pulse`} />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}