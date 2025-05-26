'use client';

import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface GalleryProps {
  practice: Practice;
}

export default function Gallery({ practice }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedBeforeAfter, setSelectedBeforeAfter] = useState<number | null>(null);
  const [beforeAfterView, setBeforeAfterView] = useState<'before' | 'after'>('before');

  const galleryImages = practice.slug === 'dr-polina-aesthetics' ? [
    {
      src: '/images/dr-polina-clinic1.jpg',
      alt: 'Modern treatment room',
      category: 'Facility'
    },
    {
      src: '/images/dr-polina-clinic2.jpg',
      alt: 'Reception area',
      category: 'Facility'
    },
    {
      src: '/images/dr-polina-treatment.jpg',
      alt: 'Advanced equipment',
      category: 'Equipment'
    }
  ] : [];

  const beforeAfterPairs = practice.slug === 'dr-polina-aesthetics' ? [
    {
      id: 1,
      beforeSrc: '/images/dr-polina-before-after1.jpg',
      afterSrc: '/images/dr-polina-before-after2.jpg',
      treatment: 'Acne Treatment',
      category: 'Results'
    },
    {
      id: 2,
      beforeSrc: '/images/dr-polina-before-after2.jpg',
      afterSrc: '/images/dr-polina-before-after3.jpg',
      treatment: 'Skin Rejuvenation',
      category: 'Results'
    },
    {
      id: 3,
      beforeSrc: '/images/dr-polina-before-after3.jpg',
      afterSrc: '/images/dr-polina-before-after1.jpg',
      treatment: 'Anti-Aging Treatment',
      category: 'Results'
    }
  ] : [];

  const categories = [...new Set([...galleryImages.map(img => img.category), ...(beforeAfterPairs.length > 0 ? ['Results'] : [])])];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredImages = activeCategory 
    ? galleryImages.filter(img => img.category === activeCategory)
    : galleryImages;
  
  const filteredBeforeAfter = activeCategory === 'Results' || !activeCategory
    ? beforeAfterPairs
    : [];

  const nextImage = () => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage + 1) % filteredImages.length);
    }
  };

  const prevImage = () => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage - 1 + filteredImages.length) % filteredImages.length);
    }
  };

  if (galleryImages.length === 0) return null;

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.span 
            className="inline-block px-4 py-2 rounded-full text-white text-sm font-semibold mb-4"
            style={{ backgroundColor: practice.primary_color }}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            Gallery
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            See Our Work & Facilities
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore our state-of-the-art facilities and remarkable results
          </p>
        </motion.div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <motion.div
            className="flex justify-center gap-4 mb-12 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                activeCategory === null
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={{
                backgroundColor: activeCategory === null ? practice.primary_color : undefined
              }}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  activeCategory === category
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: activeCategory === category ? practice.primary_color : undefined
                }}
              >
                {category}
              </button>
            ))}
          </motion.div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Regular Images */}
          {filteredImages.map((image, index) => (
            <motion.div
              key={`img-${index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg"
              onClick={() => setSelectedImage(index)}
            >
              <div className="aspect-w-16 aspect-h-12 relative">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                
                {/* Overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  initial={false}
                  animate={hoveredIndex === index ? { opacity: 1 } : { opacity: 0 }}
                >
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <p className="text-sm font-medium mb-1">{image.category}</p>
                    <p className="text-lg font-semibold">{image.alt}</p>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
          
          {/* Before/After Pairs */}
          {filteredBeforeAfter.map((pair, index) => (
            <motion.div
              key={`ba-${pair.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (filteredImages.length + index) * 0.1 }}
              className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg"
              onClick={() => setSelectedBeforeAfter(pair.id)}
            >
              <div className="aspect-w-16 aspect-h-12 relative">
                {/* Split View Preview */}
                <div className="relative w-full h-64 overflow-hidden">
                  <img
                    src={pair.beforeSrc}
                    alt={`${pair.treatment} - Before`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 w-1/2 overflow-hidden">
                    <img
                      src={pair.afterSrc}
                      alt={`${pair.treatment} - After`}
                      className="w-full h-full object-cover"
                      style={{ width: '200%' }}
                    />
                  </div>
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white shadow-lg transform -translate-x-1/2" />
                  
                  {/* Labels */}
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-red-500">
                      Before
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-green-500">
                      After
                    </span>
                  </div>
                </div>
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <p className="text-sm font-medium mb-1">Before & After</p>
                    <p className="text-lg font-semibold">{pair.treatment}</p>
                  </div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Maximize2 className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedImage !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <motion.img
            key={selectedImage}
            src={filteredImages[selectedImage].src}
            alt={filteredImages[selectedImage].alt}
            className="max-w-full max-h-[90vh] object-contain"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center">
            <p className="text-lg font-semibold">{filteredImages[selectedImage].alt}</p>
            <p className="text-sm opacity-80">{filteredImages[selectedImage].category}</p>
          </div>
        </motion.div>
      )}

      {/* Before/After Modal */}
      {selectedBeforeAfter !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedBeforeAfter(null)}
        >
          <button
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setSelectedBeforeAfter(null)}
          >
            <X className="w-6 h-6" />
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle Buttons */}
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg">
              <button
                onClick={() => setBeforeAfterView('before')}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  beforeAfterView === 'before'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Before
              </button>
              <button
                onClick={() => setBeforeAfterView('after')}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  beforeAfterView === 'after'
                    ? 'bg-green-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                After
              </button>
            </div>

            {/* Image Display */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {(() => {
                  const currentPair = beforeAfterPairs.find(p => p.id === selectedBeforeAfter);
                  if (!currentPair) return null;
                  
                  return (
                    <motion.img
                      key={beforeAfterView}
                      src={beforeAfterView === 'before' ? currentPair.beforeSrc : currentPair.afterSrc}
                      alt={`${currentPair.treatment} - ${beforeAfterView === 'before' ? 'Before' : 'After'}`}
                      className="w-full h-auto max-h-[80vh] object-contain"
                      initial={{ opacity: 0, x: beforeAfterView === 'before' ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: beforeAfterView === 'before' ? 20 : -20 }}
                      transition={{ duration: 0.3 }}
                    />
                  );
                })()}
              </AnimatePresence>
            </div>

            {/* Treatment Info */}
            <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {beforeAfterPairs.find(p => p.id === selectedBeforeAfter)?.treatment}
              </h3>
              <p className="text-gray-600">
                Slide between before and after to see the amazing transformation achieved through our treatments.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}