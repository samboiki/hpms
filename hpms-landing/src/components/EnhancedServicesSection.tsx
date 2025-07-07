'use client';

import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, Clock, DollarSign, ArrowRight, Check, Sparkles, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { drPolinaServices, ServiceCategory, SubService } from '@/data/dr-polina-services';
import { newcharmServices, ServiceCategory as NewCharmServiceCategory, SubService as NewCharmSubService } from '@/data/newcharm-services';

interface EnhancedServicesSectionProps {
  practice: Practice;
  onBookService?: (service: SubService | NewCharmSubService, category: ServiceCategory | NewCharmServiceCategory) => void;
}

export default function EnhancedServicesSection({ practice, onBookService }: EnhancedServicesSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | NewCharmServiceCategory | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Use specialized services for specific practices
  const isDrPolina = practice.slug === 'dr-polina-aesthetics';
  const isNewCharm = practice.slug === 'newcharm-dental';
  const services = isDrPolina ? drPolinaServices : isNewCharm ? newcharmServices : practice.services;

  // Premium service images for NewCharm
  const serviceImages: Record<string, string> = {
    'general-dentistry': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'cosmetic-dentistry': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'orthodontics': 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'oral-surgery': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'emergency-care': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'preventive-care': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  };

  const handleBookNow = (subService: SubService | NewCharmSubService) => {
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
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, type: "spring" }}
        >
          <motion.span 
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold mb-6 shadow-xl"
            style={{ 
              background: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 100%)`,
              boxShadow: `0 10px 30px ${practice.primary_color}40`,
            }}
            initial={{ scale: 0, rotate: -180 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4" />
            Our Services
            <Sparkles className="w-4 h-4" />
          </motion.span>
          <motion.h2 
            className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 50%, ${practice.primary_color} 100%)`,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {practice.slug === 'dr-polina-aesthetics' 
              ? 'Transform Your Beauty Journey'
              : practice.slug === 'newcharm-dental'
              ? 'Premier Dental Excellence'
              : 'Comprehensive Healthcare Services'
            }
          </motion.h2>
          <motion.p 
            className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {practice.slug === 'dr-polina-aesthetics'
              ? 'Discover our range of advanced aesthetic treatments designed to enhance your natural beauty'
              : practice.slug === 'newcharm-dental'
              ? 'Experience world-class dental care with cutting-edge technology and compassionate treatment in the heart of Windhoek'
              : 'Quality medical care tailored to your needs'
            }
          </motion.p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(Array.isArray(services) ? services : drPolinaServices).map((service, index) => {
            const IconComponent = Icons[service.icon as keyof typeof Icons] || Icons.Activity;
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
                  className="relative h-full bg-white rounded-3xl shadow-xl overflow-hidden cursor-pointer group border-2 border-transparent"
                  style={{
                    background: `linear-gradient(white, white) padding-box, linear-gradient(135deg, ${practice.primary_color}20, ${practice.secondary_color}20) border-box`,
                  }}
                  whileHover={{ 
                    y: -8,
                    scale: 1.02,
                    transition: { duration: 0.3, type: "spring", stiffness: 300 }
                  }}
                  onClick={() => setSelectedCategory(service as ServiceCategory)}
                >
                  {/* Service Image */}
                  {((isDrPolina && 'image' in service && (service as ServiceCategory).image) || 
                    (isNewCharm && serviceImages[service.id])) && (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={isNewCharm ? serviceImages[service.id] : (service as ServiceCategory).image || ''} 
                        alt={service.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {/* Premium badge for NewCharm */}
                      {isNewCharm && (
                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-white text-xs font-medium flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Premium
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Premium Gradient Overlay */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none z-10"
                    style={{
                      background: `linear-gradient(135deg, ${practice.primary_color}10 0%, transparent 50%, ${practice.secondary_color}10 100%)`,
                    }}
                  />
                  
                  {/* Animated Border Glow */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
                    style={{
                      boxShadow: `0 0 40px ${practice.primary_color}40, 0 0 80px ${practice.secondary_color}20`,
                    }}
                  />
                  
                  <div className="relative p-6">
                    {/* Premium Icon with Shadow */}
                    <motion.div
                      className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-2xl"
                      style={{
                        background: isDrPolina && 'color' in service && (service as ServiceCategory).color ? (service as ServiceCategory).color : `linear-gradient(135deg, ${practice.primary_color}, ${practice.secondary_color})`,
                        boxShadow: isHovered ? `0 10px 30px ${practice.primary_color}50` : '0 5px 15px rgba(0,0,0,0.1)',
                      }}
                      animate={isHovered ? { 
                        rotate: 10,
                        scale: 1.1
                      } : {
                        rotate: 0,
                        scale: 1
                      }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
                    >
                      <IconComponent className="w-10 h-10 text-white" />
                      {/* Icon Glow Effect */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        animate={isHovered ? {
                          opacity: [0, 0.5, 0],
                          scale: [1, 1.2, 1.2],
                        } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{
                          background: `radial-gradient(circle, ${practice.primary_color}40, transparent)`,
                        }}
                      />
                    </motion.div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-transparent group-hover:bg-clip-text transition-all duration-300"
                      style={{
                        backgroundImage: isHovered ? `linear-gradient(135deg, ${practice.primary_color}, ${practice.secondary_color})` : 'none',
                      }}
                    >
                      {service.name}
                    </h3>
                    
                    <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed">
                      {service.description}
                    </p>

                    {/* Premium View Services Button */}
                    <motion.div 
                      className="relative inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm overflow-hidden"
                      style={{ 
                        background: `linear-gradient(135deg, ${practice.primary_color}15, ${practice.secondary_color}15)`,
                        color: practice.primary_color,
                      }}
                    >
                      {/* Button Shine Effect */}
                      <motion.div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100"
                        animate={isHovered ? {
                          x: ['-100%', '100%'],
                        } : {}}
                        transition={{ duration: 0.6 }}
                        style={{
                          background: `linear-gradient(90deg, transparent, ${practice.primary_color}30, transparent)`,
                        }}
                      />
                      <span className="relative z-10">View Services</span>
                      <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                    </motion.div>

                    {/* Premium Service Count Badge */}
                    {'subServices' in service && (service as ServiceCategory).subServices && (
                      <motion.div 
                        className="absolute top-6 right-6 px-4 py-2 rounded-full text-sm font-medium text-white shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${practice.primary_color}90, ${practice.secondary_color}90)`,
                          backdropFilter: 'blur(10px)',
                        }}
                        whileHover={{ scale: 1.1 }}
                      >
                        {(service as ServiceCategory).subServices.length} {isNewCharm ? 'services' : 'treatments'}
                      </motion.div>
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
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden border-2"
              style={{
                borderColor: `${practice.primary_color}20`,
                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 100px ${practice.primary_color}20`,
              }}
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
                    const IconComponent = Icons[selectedCategory.icon as keyof typeof Icons] || Icons.Activity;
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
                      className="group bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 hover:border-transparent transition-all duration-300 shadow-md hover:shadow-xl"
                      style={{
                        '--tw-shadow-color': practice.primary_color + '20',
                      } as React.CSSProperties}
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

                        {/* Premium Book Now Button */}
                        <motion.button
                          whileHover={{ scale: 1.05, boxShadow: `0 20px 40px ${practice.primary_color}40` }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleBookNow(subService)}
                          className="relative px-8 py-4 rounded-2xl text-white font-bold flex items-center gap-3 shadow-xl transition-all overflow-hidden group"
                          style={{ 
                            background: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 100%)`,
                          }}
                        >
                          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                          <Calendar className="relative z-10 w-5 h-5" />
                          <span className="relative z-10">Book Now</span>
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