'use client';

import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Award, Users, Sparkles } from 'lucide-react';

interface BeforeAfterGalleryProps {
  practice: Practice;
}

export default function BeforeAfterGallery({ practice }: BeforeAfterGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'before' | 'after' | 'split'>('split');

  const beforeAfterImages = [
    {
      id: 1,
      before: '/images/dr-polina-before-after1.jpg',
      after: '/images/dr-polina-before-after2.jpg',
      treatment: 'Acne Treatment',
      duration: '3 months',
      description: 'Complete acne clearing with medical-grade treatments'
    },
    {
      id: 2,
      before: '/images/dr-polina-before-after2.jpg',
      after: '/images/dr-polina-before-after3.jpg',
      treatment: 'Skin Rejuvenation',
      duration: '6 weeks',
      description: 'Dramatic improvement in skin texture and tone'
    },
    {
      id: 3,
      before: '/images/dr-polina-before-after3.jpg',
      after: '/images/dr-polina-before-after1.jpg',
      treatment: 'Anti-Aging Treatment',
      duration: '2 months',
      description: 'Reduced fine lines and improved skin elasticity'
    }
  ];

  const achievements = [
    { icon: Award, value: '98%', label: 'Success Rate' },
    { icon: Users, value: '2000+', label: 'Transformations' },
    { icon: Sparkles, value: '100%', label: 'Natural Results' },
    { icon: Eye, value: '24/7', label: 'Support Available' }
  ];

  const nextImage = () => {
    setActiveIndex((prev) => (prev + 1) % beforeAfterImages.length);
  };

  const prevImage = () => {
    setActiveIndex((prev) => (prev - 1 + beforeAfterImages.length) % beforeAfterImages.length);
  };

  const currentImage = beforeAfterImages[activeIndex];

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span 
            className="inline-block px-4 py-2 rounded-full text-white text-sm font-semibold mb-4"
            style={{ backgroundColor: practice.primary_color }}
          >
            Real Results
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Transformations That Speak
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See the remarkable before and after results achieved through our personalized aesthetic treatments
          </p>
        </motion.div>

        {/* Achievement Stats */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {achievements.map((achievement, index) => (
            <motion.div
              key={index}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
            >
              <div 
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${practice.primary_color}15` }}
              >
                <achievement.icon className="w-8 h-8" style={{ color: practice.primary_color }} />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{achievement.value}</div>
              <div className="text-gray-600">{achievement.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Before/After Gallery */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Gallery Controls */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentImage.treatment}
                </h3>
                <p className="text-gray-600">{currentImage.description}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                  Treatment Duration: {currentImage.duration}
                </span>
              </div>
              
              {/* View Mode Toggles */}
              <div className="flex items-center gap-2">
                {(['before', 'split', 'after'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      viewMode === mode
                        ? 'text-white'
                        : 'text-gray-600 hover:text-gray-900 bg-gray-100'
                    }`}
                    style={viewMode === mode ? { backgroundColor: practice.primary_color } : {}}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image Display */}
          <div className="relative h-96 lg:h-[600px]">
            {viewMode === 'before' && (
              <img
                src={currentImage.before}
                alt="Before treatment"
                className="w-full h-full object-cover"
              />
            )}
            
            {viewMode === 'after' && (
              <img
                src={currentImage.after}
                alt="After treatment"
                className="w-full h-full object-cover"
              />
            )}
            
            {viewMode === 'split' && (
              <div className="relative w-full h-full overflow-hidden">
                <img
                  src={currentImage.before}
                  alt="Before treatment"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 w-1/2 overflow-hidden">
                  <img
                    src={currentImage.after}
                    alt="After treatment"
                    className="w-full h-full object-cover"
                    style={{ width: '200%' }}
                  />
                </div>
                <div className="absolute inset-y-0 left-1/2 w-1 bg-white shadow-lg transform -translate-x-1/2" />
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/70 text-white text-sm rounded-full">
                  Before
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 bg-black/70 text-white text-sm rounded-full">
                  After
                </div>
              </div>
            )}

            {/* Navigation Arrows */}
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          {/* Gallery Thumbnails */}
          <div className="p-6 border-t border-gray-100">
            <div className="flex items-center justify-center gap-4">
              {beforeAfterImages.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setActiveIndex(index)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    index === activeIndex 
                      ? 'border-current' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={index === activeIndex ? { borderColor: practice.primary_color } : {}}
                >
                  <img
                    src={image.before}
                    alt={`Treatment ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-gray-600 mb-6 text-lg">
            Ready to start your own transformation journey?
          </p>
          <motion.button
            onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 rounded-xl text-white font-semibold transition-all duration-300 flex items-center gap-2 mx-auto animate-heartbeat"
            style={{ backgroundColor: practice.primary_color }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="w-5 h-5" />
            Book Your Consultation
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}