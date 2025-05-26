'use client';

import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { CheckCircle, Award, Users, Clock, Heart, Shield, Star, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface AboutSectionProps {
  practice: Practice;
}

export default function AboutSection({ practice }: AboutSectionProps) {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    { 
      icon: Award, 
      title: 'Excellence in Care',
      description: 'Board-certified specialists with international training and recognition',
      stat: '99%',
      statLabel: 'Patient Satisfaction'
    },
    { 
      icon: Shield, 
      title: 'Latest Technology',
      description: 'State-of-the-art medical equipment and cutting-edge treatment methods',
      stat: '24/7',
      statLabel: 'Emergency Care'
    },
    { 
      icon: Heart, 
      title: 'Patient-First Approach',
      description: 'Personalized treatment plans tailored to your unique health needs',
      stat: '50K+',
      statLabel: 'Lives Touched'
    },
    { 
      icon: Users, 
      title: 'Expert Team',
      description: 'Multidisciplinary healthcare professionals working together for you',
      stat: '15+',
      statLabel: 'Specialists'
    },
  ];

  const achievements = [
    { number: '20+', label: 'Years of Excellence' },
    { number: '50K+', label: 'Happy Patients' },
    { number: '100+', label: 'Staff Members' },
    { number: '4.9', label: 'Google Rating' },
  ];

  return (
    <section id="about" className="py-32 bg-white relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(${practice.primary_color} 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <span 
              className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-6"
              style={{ 
                backgroundColor: practice.primary_color + '20',
                color: practice.primary_color 
              }}
            >
              About Us
            </span>

            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Pioneering Healthcare Excellence Since 2004
            </h2>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              {practice.about_text || `At ${practice.name}, we combine decades of medical expertise with 
              cutting-edge technology to deliver exceptional healthcare services. Our commitment to excellence 
              has made us the trusted choice for families across ${practice.city}.`}
            </p>

            {/* Feature tabs */}
            <div className="space-y-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const isActive = activeFeature === index;
                
                return (
                  <motion.div
                    key={index}
                    onClick={() => setActiveFeature(index)}
                    className={`
                      p-4 rounded-2xl cursor-pointer transition-all duration-300
                      ${isActive 
                        ? 'bg-gradient-to-r shadow-lg' 
                        : 'bg-gray-50 hover:bg-gray-100'
                      }
                    `}
                    style={isActive ? {
                      backgroundImage: `linear-gradient(135deg, ${practice.primary_color}10, ${practice.secondary_color}10)`,
                      borderLeft: `4px solid ${practice.primary_color}`
                    } : {}}
                    whileHover={{ x: 5 }}
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className={`p-3 rounded-xl ${isActive ? 'bg-white shadow-md' : 'bg-white'}`}
                      >
                        <Icon 
                          className="w-6 h-6"
                          style={{ color: practice.primary_color }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {feature.title}
                        </h3>
                        <p className={`text-sm ${isActive ? 'text-gray-600' : 'text-gray-500'}`}>
                          {feature.description}
                        </p>
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 flex items-center gap-4"
                          >
                            <div>
                              <p className="text-2xl font-bold" style={{ color: practice.primary_color }}>
                                {feature.stat}
                              </p>
                              <p className="text-xs text-gray-500">{feature.statLabel}</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Right side - Visual element */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Main image container */}
            <div className="relative">
              <motion.div
                className="relative rounded-3xl overflow-hidden shadow-2xl"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <div 
                  className="w-full h-[500px]"
                  style={{
                    background: `linear-gradient(135deg, ${practice.primary_color}, ${practice.secondary_color})`,
                  }}
                >
                  {/* Overlay pattern */}
                  <div className="absolute inset-0 opacity-20">
                    <svg width="100%" height="100%">
                      <pattern id="pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <circle cx="50" cy="50" r="30" fill="white" opacity="0.1" />
                      </pattern>
                      <rect width="100%" height="100%" fill="url(#pattern)" />
                    </svg>
                  </div>

                  {/* Achievement stats */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-8 p-8">
                      {achievements.map((achievement, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + index * 0.1 }}
                          className="text-center"
                        >
                          <p className="text-4xl md:text-5xl font-bold text-white mb-2">
                            {achievement.number}
                          </p>
                          <p className="text-white/80 text-sm">
                            {achievement.label}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-10 -right-10 w-32 h-32 bg-white rounded-2xl shadow-xl p-4 flex flex-col items-center justify-center"
              >
                <Star className="w-8 h-8 text-yellow-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">4.9</p>
                <p className="text-xs text-gray-500">Rating</p>
              </motion.div>

              <motion.div
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                className="absolute -bottom-10 -left-10 w-40 h-24 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3"
              >
                <TrendingUp className="w-8 h-8" style={{ color: practice.primary_color }} />
                <div>
                  <p className="text-lg font-bold text-gray-900">+32%</p>
                  <p className="text-xs text-gray-500">Growth Rate</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}