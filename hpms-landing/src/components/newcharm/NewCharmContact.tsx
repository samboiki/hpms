import React from 'react';
import { Icon } from '@iconify/react';
import { Practice } from '@/lib/tenants';
import EnhancedBookingWidget from '@/components/EnhancedBookingWidget';
import { SubService, ServiceCategory } from '@/data/newcharm-services';
import LocationMap from './LocationMap';
import { motion } from 'framer-motion';

interface NewCharmContactProps {
  practice: Practice;
  preSelectedService?: SubService;
  preSelectedCategory?: ServiceCategory;
}

const NewCharmContact: React.FC<NewCharmContactProps> = ({ practice, preSelectedService, preSelectedCategory }) => {
  return (
    <>
      {/* Location Map Section - Full Width */}
      <section className="w-full">
        <LocationMap />
      </section>
      
      <section id="contact" className="py-20 md:py-24 bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/30 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#00BCD4]/10 to-[#0097A7]/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#00BCD4]/10 to-[#0097A7]/10 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [0, -90, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header with Animation */}
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div 
              className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full mb-6 shadow-sm"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <Icon icon="solar:calendar-mark-bold-duotone" className="w-4 h-4 text-[#00BCD4]" />
              <span className="text-sm text-[#00BCD4] font-medium">Schedule Your Visit</span>
            </motion.div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 mb-6 font-[Lexend]">
              Start your journey to
              <span className="block bg-gradient-to-r from-[#00BCD4] to-[#0097A7] bg-clip-text text-transparent font-normal mt-2">
                a healthier smile
              </span>
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed px-4">
              Book your appointment online in just a few clicks. 
              Choose your preferred location, service, and time.
            </p>
          </motion.div>

          {/* Enhanced Booking Widget with Animation */}
          <motion.div 
            className="mb-16"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#00BCD4]/20 to-[#0097A7]/20 blur-3xl opacity-50 -z-10" />
              <EnhancedBookingWidget 
                practice={practice} 
                preSelectedService={preSelectedService}
                preSelectedCategory={preSelectedCategory}
              />
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default NewCharmContact;