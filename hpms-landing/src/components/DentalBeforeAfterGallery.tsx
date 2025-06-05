'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Clock, Award } from 'lucide-react';

interface BeforeAfterCase {
  id: string;
  before: string;
  after: string;
  title: string;
  treatment: string;
  duration?: string;
}

interface DentalBeforeAfterGalleryProps {
  cases?: BeforeAfterCase[];
  practiceMetadata?: any;
}

export default function DentalBeforeAfterGallery({ cases, practiceMetadata }: DentalBeforeAfterGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAfter, setShowAfter] = useState(false);

  // Use cases from props or metadata
  const transformations = cases || practiceMetadata?.before_after_gallery || [
    {
      id: '1',
      before: 'https://images.unsplash.com/photo-1606265752439-1f18756aa5fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      after: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      title: 'Complete Smile Makeover',
      treatment: 'Veneers & Teeth Whitening',
      duration: '3 weeks'
    }
  ];

  const currentCase = transformations[currentIndex];

  const nextCase = () => {
    setShowAfter(false);
    setCurrentIndex((prev) => (prev + 1) % transformations.length);
  };

  const prevCase = () => {
    setShowAfter(false);
    setCurrentIndex((prev) => (prev - 1 + transformations.length) % transformations.length);
  };

  if (!transformations.length) return null;

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full text-sm font-medium mb-4"
          >
            <Sparkles className="w-4 h-4" />
            Real Patient Transformations
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            See the NewCharm Difference
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Witness remarkable dental transformations achieved by our expert team using cutting-edge technology
          </p>
        </motion.div>

        {/* Main Gallery */}
        <div className="relative max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Image Comparison Container */}
            <div className="relative aspect-[16/10] overflow-hidden">
              <AnimatePresence mode="wait">
                {!showAfter ? (
                  <motion.div
                    key="before"
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <img
                      src={currentCase.before}
                      alt={`Before ${currentCase.treatment}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-full font-semibold shadow-lg">
                      BEFORE
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="after"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <img
                      src={currentCase.after}
                      alt={`After ${currentCase.treatment}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-2 rounded-full font-semibold shadow-lg">
                      AFTER
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAfter(!showAfter)}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-8 py-3 rounded-full shadow-xl font-semibold text-gray-800 hover:bg-white transition-colors"
              >
                {showAfter ? 'Show Before' : 'Show After'}
              </motion.button>
            </div>

            {/* Case Information */}
            <div className="p-8 bg-gradient-to-br from-teal-50 to-white">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {currentCase.title}
              </h3>
              <div className="flex flex-wrap items-center gap-6 text-gray-600">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-teal-600" />
                  <span className="font-medium">{currentCase.treatment}</span>
                </div>
                {currentCase.duration && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-teal-600" />
                    <span>Treatment Duration: {currentCase.duration}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Navigation Buttons */}
          <button
            onClick={prevCase}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <button
            onClick={nextCase}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>

          {/* Case Indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {transformations.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setShowAfter(false);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-teal-600'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-lg text-gray-600 mb-6">
            Ready to transform your smile? Schedule your consultation today.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-teal-600 text-white px-8 py-4 rounded-full font-semibold shadow-xl hover:bg-teal-700 transition-colors"
          >
            Start Your Transformation
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}