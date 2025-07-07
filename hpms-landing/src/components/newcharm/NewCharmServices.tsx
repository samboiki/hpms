import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { newcharmServices, ServiceCategory, SubService } from '@/data/newcharm-services';
import { Practice } from '@/lib/tenants';
import { Clock, DollarSign, ArrowRight, Check, X, Calendar } from 'lucide-react';
import { Link } from 'react-scroll';

interface NewCharmServicesProps {
  practice: Practice;
  onBookService?: (service: SubService, category: ServiceCategory) => void;
}

const NewCharmServices: React.FC<NewCharmServicesProps> = ({ onBookService }) => {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const serviceImages: Record<string, string> = {
    'general-dentistry': '/images/newcharm/images/Screenshot 2025-07-07 074156.png',
    'cosmetic-dentistry': '/images/newcharm/images/Screenshot 2025-07-07 075054.png',
    'orthodontics': '/images/newcharm/images/Screenshot 2025-07-07 074844.png',
    'oral-surgery': '/images/newcharm/images/Screenshot 2025-07-07 074333.png',
    'emergency-care': '/images/newcharm/images/Screenshot 2025-07-07 074402.png',
    'preventive-care': '/images/newcharm/images/Screenshot 2025-07-07 074236.png'
  };

  const handleBookNow = (subService: SubService) => {
    if (onBookService && selectedCategory) {
      onBookService(subService, selectedCategory);
    }
    setSelectedCategory(null);
  };

  return (
    <section id="services" className="py-20 md:py-24 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 bg-[#ec7ec5]/10 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:heart-shine-bold-duotone" className="w-4 h-4 text-[#ec7ec5]" />
            <span className="text-sm text-[#ec7ec5] font-medium">Our Services</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-lexend font-light text-gray-900 mb-4">
            Comprehensive dental care
            <span className="text-[#32b9e5] font-normal"> tailored to you</span>
          </h2>
          <p className="text-base text-gray-600 leading-relaxed">
            From routine cleanings to advanced procedures, we offer a full spectrum 
            of dental services using the latest technology and techniques.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {newcharmServices.map((service, index) => {
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
                  className="relative h-full bg-white rounded-3xl shadow-lg overflow-hidden cursor-pointer group border border-gray-100 hover:border-[#32b9e5]/30"
                  whileHover={{ 
                    y: -8,
                    scale: 1.02,
                    transition: { duration: 0.3, type: "spring", stiffness: 300 }
                  }}
                  onClick={() => setSelectedCategory(service)}
                >
                  {/* Service Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={serviceImages[service.id]} 
                      alt={service.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-[#32b9e5]/20 via-transparent to-[#ec7ec5]/20" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                      <span className="text-white text-xs font-medium flex items-center gap-1">
                        <Icon icon="solar:star-bold-duotone" className="w-3 h-3" />
                        Premium
                      </span>
                    </div>
                  </div>
                  
                  <div className="relative p-6">

                    <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#32b9e5] transition-colors duration-300">
                      {service.name}
                    </h3>
                    
                    <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed text-sm">
                      {service.description}
                    </p>

                    {/* View Services Button */}
                    <motion.div 
                      className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm overflow-hidden bg-[#32b9e5]/10 text-[#32b9e5]"
                    >
                      <span className="relative z-10">View Services</span>
                      <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                    </motion.div>

                    {/* Service Count Badge */}
                    <motion.div 
                      className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-lg bg-[#ec7ec5]"
                      whileHover={{ scale: 1.1 }}
                    >
                      {service.subServices.length} services
                    </motion.div>
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
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div 
                className="relative px-8 py-6 text-white"
                style={{
                  background: `linear-gradient(135deg, #32b9e5, #ec7ec5)`,
                }}
              >
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-4 mb-2">
                  <Icon icon={`solar:${selectedCategory.icon.toLowerCase()}-bold-duotone`} className="w-10 h-10" />
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
                      className="group bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 hover:border-[#32b9e5]/30 transition-all duration-300 shadow-sm hover:shadow-lg"
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
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm text-gray-700 border border-gray-200"
                                >
                                  <Check className="w-3 h-3 text-[#32b9e5]" />
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
                            <span className="flex items-center gap-2 font-semibold text-[#32b9e5]">
                              <DollarSign className="w-4 h-4" />
                              {subService.price}
                            </span>
                          </div>
                        </div>

                        {/* Book Now Button */}
                        <Link
                          to="contact"
                          smooth={true}
                          duration={500}
                          offset={-80}
                          onClick={() => {
                            handleBookNow(subService);
                          }}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#32b9e5] to-[#ec7ec5] text-white rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                        >
                          <Calendar className="w-5 h-5 mr-2" />
                          <span>Book Now</span>
                        </Link>
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
};

export default NewCharmServices;