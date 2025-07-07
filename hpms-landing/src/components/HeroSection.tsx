'use client';

import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { Phone, MapPin, Clock, ArrowRight, Star, Shield, Award, Users } from 'lucide-react';

interface HeroSectionProps {
  practice: Practice;
}

export default function HeroSection({ practice }: HeroSectionProps) {
  // Removed unused currentTime state

  // Check practice type for specialized content
  const isAestheticPractice = practice.slug === 'dr-polina-aesthetics';
  const isDentalPractice = practice.slug === 'newcharm-dental';

  const stats = isAestheticPractice ? [
    { label: 'Years of Experience', value: '10+', icon: Award },
    { label: 'Happy Clients', value: '2K+', icon: Users },
    { label: 'Procedures Done', value: '5K+', icon: Shield },
    { label: 'Client Satisfaction', value: '98%', icon: Star },
  ] : isDentalPractice ? [
    { label: 'Years of Excellence', value: '15+', icon: Award },
    { label: 'Smiles Created', value: '8K+', icon: Users },
    { label: 'Dental Procedures', value: '12K+', icon: Shield },
    { label: 'Patient Satisfaction', value: '99%', icon: Star },
  ] : [
    { label: 'Years of Service', value: '20+', icon: Award },
    { label: 'Patients Served', value: '50K+', icon: Users },
    { label: 'Expert Doctors', value: '15+', icon: Shield },
    { label: 'Google Rating', value: '4.9', icon: Star },
  ];

  const heroImage = isAestheticPractice 
    ? '/images/aesthetic-hero.jpg' 
    : isDentalPractice 
    ? '/images/newcharm/hero-dental-clinic.jpg'
    : null;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Premium Background with dynamic effects */}
      <div className="absolute inset-0">
        {heroImage ? (
          <>
            <img 
              src={heroImage} 
              alt={practice.name} 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div 
              className="absolute inset-0"
              style={{
                background: isDentalPractice 
                  ? `linear-gradient(135deg, ${practice.primary_color}e6 0%, ${practice.secondary_color}cc 40%, ${practice.primary_color}99 100%)`
                  : `linear-gradient(135deg, ${practice.primary_color}dd 0%, ${practice.secondary_color}dd 50%, ${practice.primary_color}dd 100%)`,
              }}
            />
          </>
        ) : (
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 50%, ${practice.primary_color} 100%)`,
            }}
          />
        )}
        {/* Animated shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -100, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -100, 0],
              y: [0, 100, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl"
          />
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white mb-6"
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isDentalPractice ? 'Premier Dental Excellence' : 
                 isAestheticPractice ? 'Aesthetic Excellence Certified' : 
                 'Trusted Healthcare Provider'}
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              {practice.hero_title || 'Excellence in Healthcare'}
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              {practice.hero_subtitle || 'Where compassion meets innovation'}
            </p>

            {/* Premium CTA Buttons with Gradient Effects */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 25px 50px rgba(0,0,0,0.4)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative group px-10 py-5 text-white font-bold rounded-full shadow-2xl transform transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                <span className="relative z-10">{isDentalPractice ? 'Book Dental Appointment' : 'Book Appointment'}</span>
                <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
              </motion.button>
              
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={`tel:${practice.contact_phone}`}
                className="relative group px-10 py-5 backdrop-blur-md text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden border-2"
                style={{
                  borderColor: `${practice.primary_color}80`,
                  background: `linear-gradient(135deg, ${practice.primary_color}20 0%, ${practice.secondary_color}20 100%)`,
                }}
              >
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${practice.primary_color}40 0%, ${practice.secondary_color}40 100%)`,
                  }}
                />
                <Phone className="relative z-10 w-5 h-5 animate-pulse" />
                <span className="relative z-10">{isDentalPractice ? 'Emergency Dental Care' : 'Emergency Call'}</span>
              </motion.a>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Location</p>
                    <p className="text-white font-semibold">{practice.city}, {practice.country}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Open Now</p>
                    <p className="text-white font-semibold">Until 5:00 PM</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right side - Stats Grid */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden lg:grid grid-cols-2 gap-6"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
                >
                  <Icon className="w-8 h-8 text-white mb-3" />
                  <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-white/70 text-sm">{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white rounded-full mt-2"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}