'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useInView } from 'react-intersection-observer'
import { useState } from 'react'

const testimonials = [
  {
    id: 1,
    name: 'Dr. Sarah Nambinga',
    role: 'General Practitioner',
    clinic: 'MediCare Clinic, Windhoek',
    content: 'OneHealth has transformed how we manage our practice. The automated SMS reminders alone have reduced no-shows by 40%. The natural language reporting is a game-changer!',
    rating: 5,
    image: '/testimonial-1.jpg',
  },
  {
    id: 2,
    name: 'Dr. Michael Shikongo',
    role: 'Dental Surgeon',
    clinic: 'Smile Dental Practice, Swakopmund',
    content: 'Managing multiple branches was a nightmare before OneHealth. Now I can see real-time data from all locations. The customizable forms and branded documents give us a professional edge.',
    rating: 5,
    image: '/testimonial-2.jpg',
  },
  {
    id: 3,
    name: 'Sr. Maria Hamutenya',
    role: 'Practice Manager',
    clinic: 'HealthFirst Medical Centre',
    content: 'The billing and accounting integration saves us hours every day. Patient satisfaction has improved significantly with the patient portal. Best investment we\'ve made!',
    rating: 5,
    image: '/testimonial-3.jpg',
  },
]

export function TestimonialsSection() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-30" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:heart-bold-duotone" className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">Loved by Healthcare Professionals</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Trusted by Leading
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600"> Healthcare Providers</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join hundreds of practices across Namibia who have transformed their operations with OneHealth.
          </p>
        </motion.div>

        <div ref={ref} className="max-w-6xl mx-auto">
          {/* Main Testimonial */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Avatar */}
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                  <Icon icon="solar:user-bold-duotone" className="w-16 h-16 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2">
                  <Icon icon="solar:check-circle-bold" className="w-6 h-6 text-white" />
                </div>
              </motion.div>

              {/* Content */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex justify-center md:justify-start gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Icon key={i} icon="solar:star-bold" className="w-5 h-5 text-yellow-500" />
                  ))}
                </div>
                
                <motion.p
                  key={activeTestimonial}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-xl text-gray-700 italic mb-6"
                >
                  &ldquo;{testimonials[activeTestimonial].content}&rdquo;
                </motion.p>

                <motion.div
                  key={`${activeTestimonial}-info`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <p className="text-lg font-semibold text-gray-900">
                    {testimonials[activeTestimonial].name}
                  </p>
                  <p className="text-gray-600">
                    {testimonials[activeTestimonial].role}
                  </p>
                  <p className="text-sm text-purple-600">
                    {testimonials[activeTestimonial].clinic}
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Testimonial Navigation */}
          <div className="flex justify-center gap-4">
            {testimonials.map((_, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTestimonial(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  activeTestimonial === index
                    ? 'bg-purple-600 w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {/* Success Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { number: '98%', label: 'Customer Satisfaction', icon: 'solar:heart-bold-duotone' },
              { number: '45%', label: 'Efficiency Increase', icon: 'solar:graph-up-bold-duotone' },
              { number: '60%', label: 'Time Saved Daily', icon: 'solar:clock-circle-bold-duotone' },
              { number: '4.9/5', label: 'Average Rating', icon: 'solar:star-bold-duotone' },
            ].map((metric, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="text-center"
              >
                <Icon icon={metric.icon} className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">{metric.number}</p>
                <p className="text-gray-600 mt-1">{metric.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 text-center"
          >
            <p className="text-sm text-gray-600 mb-4">Trusted by leading healthcare institutions</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {['MediCare', 'HealthFirst', 'CarePoint', 'WellBeing', 'LifeCare'].map((name, index) => (
                <div key={index} className="text-xl font-bold text-gray-400">
                  {name}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}