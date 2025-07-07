'use client';

import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { 
  Stethoscope, 
  Microscope, 
  Baby, 
  Heart,
  Users,
  Pill,
  Activity,
  Syringe,
  Brain,
  Eye,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useState } from 'react';

interface ServicesSectionProps {
  practice: Practice;
}

const iconMap: { [key: string]: any } = {
  stethoscope: Stethoscope,
  microscope: Microscope,
  baby: Baby,
  heart: Heart,
  users: Users,
  pill: Pill,
  activity: Activity,
  syringe: Syringe,
  brain: Brain,
  eye: Eye,
  ambulance: Zap,
  'user-md': Stethoscope,
  plane: Syringe,
};

export default function ServicesSection({ practice }: ServicesSectionProps) {
  const [hoveredService, setHoveredService] = useState<string | null>(null);

  return (
    <section id="services" className="py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-100 to-blue-100 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span 
            className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4"
            style={{ 
              backgroundColor: practice.primary_color + '20',
              color: practice.primary_color 
            }}
          >
            Our Services
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Comprehensive Healthcare Solutions
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From preventive care to specialized treatments, we offer a full spectrum of medical services 
            tailored to your health needs.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {practice.services.map((service, index) => {
            const Icon = iconMap[service.icon] || Stethoscope;
            const isHovered = hoveredService === service.id;
            
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                onMouseEnter={() => setHoveredService(service.id)}
                onMouseLeave={() => setHoveredService(null)}
                className="relative group"
              >
                <div className={`
                  relative bg-white rounded-3xl p-8 h-full
                  transition-all duration-300 cursor-pointer
                  ${isHovered ? 'shadow-2xl transform -translate-y-2' : 'shadow-lg'}
                `}>
                  {/* Gradient border effect */}
                  <div 
                    className={`
                      absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100
                      transition-opacity duration-300
                    `}
                    style={{
                      background: `linear-gradient(135deg, ${practice.primary_color}20, ${practice.secondary_color}20)`,
                      padding: '1px',
                    }}
                  >
                    <div className="bg-white h-full w-full rounded-3xl" />
                  </div>

                  <div className="relative">
                    {/* Icon container */}
                    <motion.div 
                      className="mb-6"
                      animate={isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div 
                        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                        style={{ 
                          background: `linear-gradient(135deg, ${practice.primary_color}20, ${practice.secondary_color}20)`
                        }}
                      >
                        <Icon 
                          className="w-10 h-10"
                          style={{ color: practice.primary_color }}
                        />
                      </div>
                    </motion.div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                      {service.name}
                    </h3>
                    
                    <p className="text-gray-600 text-center mb-6 leading-relaxed">
                      {service.description}
                    </p>

                    {/* Learn more link */}
                    <motion.div
                      className="flex items-center justify-center gap-2 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ color: practice.primary_color }}
                    >
                      Learn More
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </div>
                </div>

                {/* Decorative element */}
                {isHovered && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="absolute -z-10 inset-0 rounded-3xl"
                    style={{
                      background: `linear-gradient(135deg, ${practice.primary_color}10, ${practice.secondary_color}10)`,
                      filter: 'blur(20px)',
                      transform: 'scale(1.1)',
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <p className="text-lg text-gray-600 mb-6">
            Can't find what you're looking for? We offer many more specialized services.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
            style={{ 
              backgroundColor: practice.primary_color,
              color: 'white'
            }}
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            View All Services
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}