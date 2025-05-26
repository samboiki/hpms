'use client';

import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, Clock, DollarSign, ArrowRight, Check, Sparkles, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { drPolinaServices, ServiceCategory, SubService } from '@/data/dr-polina-services';

interface EnhancedServicesSectionProps {
  practice: Practice;
  onBookService?: (service: SubService, category: ServiceCategory) => void;
}

export default function EnhancedServicesSection({ practice, onBookService }: EnhancedServicesSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Use special services for Dr. Polina
  const isDrPolina = practice.slug === 'dr-polina-aesthetics';
  const services = isDrPolina ? drPolinaServices : practice.services;

  const handleBookNow = (subService: SubService) => {
    if (onBookService && selectedCategory) {
      onBookService(subService, selectedCategory);
    }
    // Scroll to booking widget
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    setSelectedCategory(null);
  };

  return (
    <section id="services" className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-5">
        <motion.div
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 50,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full"
          style={{ background: `radial-gradient(circle, ${practice.primary_color}40, transparent)` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-16"
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
            Our Services
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {practice.slug === 'dr-polina-aesthetics' 
              ? 'Transform Your Beauty Journey'
              : 'Comprehensive Healthcare Services'
            }
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {practice.slug === 'dr-polina-aesthetics'
              ? 'Discover our range of advanced aesthetic treatments designed to enhance your natural beauty'
              : 'Quality medical care tailored to your needs'
            }
          </p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(Array.isArray(services) ? services : drPolinaServices).map((service, index) => {
            const IconComponent = (Icons as any)[service.icon] || Icons.Activity;
            const isHovered = hoveredCard === service.id;
            
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                onMouseEnter={() => setHoveredCard(service.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <motion.div
                  className="relative h-full bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer group"
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  onClick={() => setSelectedCategory(service as ServiceCategory)}
                >
                  {/* Service Image */}
                  {isDrPolina && 'image' in service && (service as ServiceCategory).image && (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={(service as ServiceCategory).image} 
                        alt={service.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  )}
                  
                  {/* Gradient Border Effect */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, ${practice.primary_color}20, ${practice.secondary_color}20)`,
                    }}
                  />
                  
                  <div className="relative p-6">
                    {/* Icon */}
                    <motion.div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                      style={{
                        background: isDrPolina && 'color' in service && (service as ServiceCategory).color ? (service as ServiceCategory).color : `linear-gradient(135deg, ${practice.primary_color}, ${practice.secondary_color})`,
                      }}
                      animate={isHovered ? { rotate: [0, -10, 10, -10, 0] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <IconComponent className="w-8 h-8 text-white" />
                    </motion.div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {service.name}
                    </h3>
                    
                    <p className="text-gray-600 mb-6 line-clamp-2">
                      {service.description}
                    </p>

                    {/* View Services Button */}
                    <motion.div 
                      className="flex items-center text-sm font-semibold group-hover:gap-3 transition-all"
                      style={{ color: practice.primary_color }}
                    >
                      <span>View Services</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </motion.div>

                    {/* Service Count Badge */}
                    {isDrPolina && 'subServices' in service && (service as ServiceCategory).subServices && (
                      <div className="absolute top-6 right-6 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                        {(service as ServiceCategory).subServices.length} treatments
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedCategory(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div 
                className="relative px-8 py-6 text-white"
                style={{
                  background: selectedCategory.color || `linear-gradient(135deg, ${practice.primary_color}, ${practice.secondary_color})`,
                }}
              >
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-4 mb-2">
                  {(() => {
                    const IconComponent = (Icons as any)[selectedCategory.icon] || Icons.Activity;
                    return <IconComponent className="w-10 h-10" />;
                  })()}
                  <h3 className="text-3xl font-bold">{selectedCategory.name}</h3>
                </div>
                <p className="text-white/90">{selectedCategory.description}</p>
              </div>

              {/* Sub-services List */}
              <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
                <div className="grid gap-4">
                  {selectedCategory.subServices?.map((subService, index) => (
                    <motion.div
                      key={subService.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-semibold text-gray-900 mb-2">
                            {subService.name}
                          </h4>
                          <p className="text-gray-600 mb-4">
                            {subService.description}
                          </p>
                          
                          {/* Benefits */}
                          {subService.benefits && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {subService.benefits.map((benefit, idx) => (
                                <span 
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm text-gray-700"
                                >
                                  <Check className="w-3 h-3" style={{ color: practice.primary_color }} />
                                  {benefit}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Duration and Price */}
                          <div className="flex items-center gap-6 text-sm">
                            <span className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-4 h-4" />
                              {subService.duration}
                            </span>
                            <span className="flex items-center gap-2 font-semibold" style={{ color: practice.primary_color }}>
                              <DollarSign className="w-4 h-4" />
                              {subService.price}
                            </span>
                          </div>
                        </div>

                        {/* Book Now Button */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleBookNow(subService)}
                          className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all animate-heartbeat"
                          style={{ backgroundColor: practice.primary_color }}
                        >
                          <Calendar className="w-5 h-5" />
                          Book Now
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}