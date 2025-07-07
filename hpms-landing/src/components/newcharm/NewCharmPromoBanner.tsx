import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useBookingModal } from '@/contexts/BookingModalContext';

const NewCharmPromoBanner: React.FC = () => {
  const { openBookingModal } = useBookingModal();
  
  const offers = [
    {
      id: 'teeth-whitening',
      discount: '50',
      tagline: 'Advanced Teeth Whitening - Premium Brands',
      title: 'Brighter Smile Special',
      image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800&h=400&fit=crop',
      buttonText: 'Book Now'
    },
    {
      id: 'dental-implants',
      discount: '30',
      tagline: 'Dental Implants - Top Quality Materials',
      title: 'Complete Smile Package',
      image: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&h=400&fit=crop',
      buttonText: 'Learn More'
    }
  ];

  return (
    <section className="py-16 bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {/* Offers Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {offers.map((offer, index) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative overflow-hidden rounded-2xl group shadow-xl hover:shadow-2xl transition-all duration-300"
              style={{
                backgroundImage: `url(${offer.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: '280px'
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
              
              
              {/* Content */}
              <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                {/* Top section with discount */}
                <div className="flex justify-end">
                  <div className="flex items-baseline text-white bg-[#ec7ec5]/20 backdrop-blur-sm rounded-2xl px-4 py-2">
                    <span className="text-5xl font-bold leading-none">{offer.discount}</span>
                    <div className="ml-1">
                      <div className="text-xl font-bold">%</div>
                      <p className="text-xs font-bold uppercase leading-tight">Off</p>
                    </div>
                  </div>
                </div>

                {/* Bottom section with content */}
                <div>
                  <h3 className="text-base text-white/90 font-medium mb-2">
                    {offer.tagline}
                  </h3>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 font-[Lexend]">
                    {offer.title}
                  </h2>
                  <button
                    onClick={() => openBookingModal()}
                    className="inline-flex items-center px-8 py-3 bg-[#32b9e5] hover:bg-[#ec7ec5] text-white rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg group"
                  >
                    <span>{offer.buttonText}</span>
                    <Icon icon="solar:arrow-right-linear" className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust Indicators */}
        <motion.div 
          className="flex flex-wrap justify-center items-center gap-8 mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center gap-2 text-gray-600">
            <Icon icon="solar:verified-check-bold-duotone" className="w-5 h-5 text-[#32b9e5]" />
            <span className="text-sm">Insurance Accepted</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-[#32b9e5]" />
            <span className="text-sm">100% Safe Procedures</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-[#32b9e5]" />
            <span className="text-sm">Flexible Scheduling</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default NewCharmPromoBanner;