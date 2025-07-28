'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useInView } from 'react-intersection-observer'

const features = [
  {
    icon: 'solar:hospital-bold-duotone',
    title: 'Multi-Branch Management',
    description: 'Manage multiple practice locations from a single dashboard with centralized oversight and reporting.',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    icon: 'solar:users-group-rounded-bold-duotone',
    title: 'Patient Portal',
    description: 'Empower patients with secure access to their health records, appointments, and communication tools.',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    icon: 'solar:smartphone-2-bold-duotone',
    title: 'SMS & Email Automation',
    description: 'Automated appointment reminders, follow-ups, and marketing campaigns to keep patients engaged.',
    color: 'from-green-500 to-teal-500',
    bgColor: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    icon: 'solar:chart-2-bold-duotone',
    title: 'AI-Powered Analytics',
    description: 'Natural language processing for reports and intelligent insights to optimize your practice performance.',
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  {
    icon: 'solar:shield-check-bold-duotone',
    title: 'HIPAA Compliant',
    description: 'Bank-level security with complete audit trails and compliance features for healthcare regulations.',
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    icon: 'solar:cloud-bold-duotone',
    title: 'Cloud & On-Premise',
    description: 'Flexible deployment options to meet your infrastructure needs with seamless data synchronization.',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-50',
    iconColor: 'text-pink-600',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
}

export function FeaturesGrid() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 bg-gray-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-100 to-cyan-100 rounded-full blur-3xl opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:star-bold-duotone" className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">Powerful Features</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Everything You Need to
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600"> Succeed</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Built by healthcare professionals for healthcare professionals. Every feature designed with your workflow in mind.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl"
                style={{
                  backgroundImage: `linear-gradient(to right, ${feature.color.split(' ')[1]}, ${feature.color.split(' ')[3]})`,
                }}
              />
              <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300">
                <div className={`w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon icon={feature.icon} className={`w-8 h-8 ${feature.iconColor}`} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                <div className="mt-6 flex items-center text-sm font-semibold group-hover:text-purple-600 transition-colors">
                  Learn more
                  <Icon icon="solar:arrow-right-bold-duotone" className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { number: '99.9%', label: 'Uptime SLA', icon: 'solar:shield-check-bold-duotone' },
            { number: '500+', label: 'Healthcare Providers', icon: 'solar:hospital-bold-duotone' },
            { number: '50K+', label: 'Patients Managed', icon: 'solar:users-group-rounded-bold-duotone' },
            { number: '24/7', label: 'Support Available', icon: 'solar:headphones-round-bold-duotone' },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <Icon icon={stat.icon} className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <motion.div
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="text-3xl md:text-4xl font-bold text-gray-900"
              >
                {stat.number}
              </motion.div>
              <p className="text-gray-600 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}