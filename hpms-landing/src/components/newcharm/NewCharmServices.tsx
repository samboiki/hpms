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
    'general-dentistry': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'cosmetic-dentistry': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'orthodontics': 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'oral-surgery': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'emergency-care': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'preventive-care': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  };

  const handleBookNow = (subService: SubService) => {
    if (onBookService && selectedCategory) {
      onBookService(subService, selectedCategory);
    }
    setSelectedCategory(null);
  };

  return (
    <section id="services" className="py-20 md:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-[#00BCD4]/10 to-[#0097A7]/10 px-4 py-2 rounded-full mb-6">
            <Icon icon="solar:heart-shine-bold-duotone" className="w-4 h-4 text-[#00BCD4]" />
            <span className="text-sm text-[#00BCD4] font-medium">Our Services</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 mb-6 font-[Lexend]">
            Comprehensive dental care
            <span className="block bg-gradient-to-r from-[#00BCD4] to-[#0097A7] bg-clip-text text-transparent font-normal mt-2">tailored to you</span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed px-4">
            From routine cleanings to advanced procedures, we offer a full spectrum 
            of dental services using the latest technology and techniques.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {newcharmServices.map((service, index) => {
            const IconComponent = Icon;
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
                  className="relative h-full bg-white rounded-3xl shadow-lg overflow-hidden cursor-pointer group border border-gray-100 hover:border-[#00BCD4]/30"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                      <span className="text-white text-xs font-medium flex items-center gap-1">
                        <Icon icon="solar:star-bold-duotone" className="w-3 h-3" />
                        Premium
                      </span>
                    </div>
                  </div>
                  
                  <div className="relative p-6">
                    {/* Icon */}
                    <motion.div
                      className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, #00BCD4, #0097A7)`,
                        boxShadow: isHovered ? `0 10px 30px rgba(0, 188, 212, 0.3)` : '0 5px 15px rgba(0,0,0,0.1)',
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
                      <IconComponent icon={`solar:${service.icon.toLowerCase()}-bold-duotone`} className="w-8 h-8 text-white" />
                    </motion.div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#00BCD4] transition-colors duration-300">
                      {service.name}
                    </h3>
                    
                    <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed text-sm">
                      {service.description}
                    </p>

                    {/* View Services Button */}
                    <motion.div 
                      className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm overflow-hidden"
                      style={{ 
                        background: `linear-gradient(135deg, rgba(0, 188, 212, 0.15), rgba(0, 151, 167, 0.15))`,
                        color: '#00BCD4',
                      }}
                    >
                      <span className="relative z-10">View Services</span>
                      <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                    </motion.div>

                    {/* Service Count Badge */}
                    <motion.div 
                      className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, rgba(0, 188, 212, 0.9), rgba(0, 151, 167, 0.9))`,
                        backdropFilter: 'blur(10px)',
                      }}
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

        {/* CTA Section */}
        <div className="mt-16 text-center bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 md:p-12">
          <h3 className="text-2xl font-light text-gray-900 mb-4">
            Ready to experience premium dental care?
          </h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Schedule your consultation today and discover how we can help you achieve 
            the healthy, beautiful smile you deserve.
          </p>
          <Link
            to="contact"
            smooth={true}
            duration={500}
            offset={-80}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#00BCD4] to-[#0097A7] text-white rounded-full hover:shadow-xl transition-all duration-300 font-medium shadow-lg transform hover:-translate-y-0.5 cursor-pointer"
          >
            Book Your Appointment
            <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5 ml-2" />
          </Link>
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
                  background: `linear-gradient(135deg, #00BCD4, #0097A7)`,
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
                      className="group bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 hover:border-[#00BCD4]/30 transition-all duration-300 shadow-sm hover:shadow-lg"
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
                                  <Check className="w-3 h-3 text-[#00BCD4]" />
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
                            <span className="flex items-center gap-2 font-semibold text-[#00BCD4]">
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
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#00BCD4] to-[#0097A7] text-white rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
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