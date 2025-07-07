'use client';

import { motion } from 'framer-motion';
import { Calendar, Award, Clock, Users, Star, Shield, Heart, Sparkles } from 'lucide-react';
import PremiumButton from '@/components/ui/PremiumButton';
import { Practice } from '@/lib/tenants';
import { useState, useEffect } from 'react';

interface PremiumHeroProps {
  practice: Practice;
}

export default function PremiumHero({ practice }: PremiumHeroProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    { icon: Award, text: 'Award-Winning Care' },
    { icon: Clock, text: '24/7 Availability' },
    { icon: Users, text: 'Expert Team' },
    { icon: Shield, text: 'Trusted & Secure' }
  ];

  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Premium background with parallax effect */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, ${practice.primary_color}20 0%, transparent 50%)`,
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${practice.primary_color}10 0%, transparent 40%, ${practice.secondary_color || practice.primary_color}10 100%)`
          }}
        />
        
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: `radial-gradient(circle, ${practice.primary_color}30 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full"
          style={{
            background: `radial-gradient(circle, ${practice.secondary_color || practice.primary_color}30 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Premium badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{
                background: `${practice.primary_color}15`,
                border: `1px solid ${practice.primary_color}30`
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Sparkles className="w-4 h-4" style={{ color: practice.primary_color }} />
              <span className="text-sm font-medium" style={{ color: practice.primary_color }}>
                Premium Healthcare Experience
              </span>
            </motion.div>

            {/* Main heading with gradient text */}
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="block text-gray-900">Excellence in</span>
              <span 
                className="block mt-2"
                style={{
                  background: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color || practice.primary_color} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Healthcare
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Experience world-class medical care with our team of dedicated professionals. 
              Your health and comfort are our highest priorities.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 mb-12">
              <PremiumButton
                onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
                variant="primary"
                size="large"
                icon={<Calendar className="w-5 h-5" />}
                gradient={`linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color || practice.primary_color} 100%)`}
              >
                Book Consultation
              </PremiumButton>
              
              <PremiumButton
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                variant="glass"
                size="large"
                icon={<Heart className="w-5 h-5" />}
              >
                Our Services
              </PremiumButton>
            </div>

            {/* Feature badges */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/50 backdrop-blur-sm border border-gray-100"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${practice.primary_color}15` }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: practice.primary_color }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Image or graphic */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <div className="relative">
              {/* Glass morphism card */}
              <motion.div
                className="relative p-8 rounded-3xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                {/* Stats */}
                <div className="grid grid-cols-2 gap-6">
                  <motion.div
                    className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-4xl font-bold mb-2" style={{ color: practice.primary_color }}>
                      15+
                    </div>
                    <div className="text-sm text-gray-600">Years of Excellence</div>
                  </motion.div>
                  <motion.div
                    className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-4xl font-bold mb-2" style={{ color: practice.primary_color }}>
                      50k+
                    </div>
                    <div className="text-sm text-gray-600">Happy Patients</div>
                  </motion.div>
                  <motion.div
                    className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-4xl font-bold mb-2" style={{ color: practice.primary_color }}>
                      4.9
                    </div>
                    <div className="flex justify-center gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <div className="text-sm text-gray-600">Patient Rating</div>
                  </motion.div>
                  <motion.div
                    className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-4xl font-bold mb-2" style={{ color: practice.primary_color }}>
                      24/7
                    </div>
                    <div className="text-sm text-gray-600">Emergency Care</div>
                  </motion.div>
                </div>

                {/* Decorative elements */}
                <motion.div
                  className="absolute -top-4 -right-4 w-20 h-20 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${practice.primary_color}40 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <motion.div
                  className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${practice.secondary_color || practice.primary_color}40 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                  }}
                  animate={{
                    scale: [1, 1.3, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1 }}
      >
        <motion.div
          className="w-6 h-10 rounded-full border-2 border-gray-400 flex justify-center"
          animate={{ borderColor: [practice.primary_color, '#9ca3af', practice.primary_color] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full mt-2"
            style={{ backgroundColor: practice.primary_color }}
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}