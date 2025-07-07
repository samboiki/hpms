import React from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-scroll';
import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';

interface NewCharmHeroProps {
  practice: Practice;
}

const NewCharmHero: React.FC<NewCharmHeroProps> = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#32b9e5]/5 via-white to-[#ec7ec5]/5">
      {/* Professional Background Image */}
      <motion.div className="absolute inset-0"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      >
        <img 
          src="https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-072110.png"
          alt="Professional dental care"
          className="w-full h-full object-cover"
        />
        {/* Single elegant gradient overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(90deg, 
                rgba(255,255,255,0.95) 0%, 
                rgba(255,255,255,0.92) 25%, 
                rgba(255,255,255,0.85) 40%, 
                rgba(255,255,255,0.5) 55%, 
                rgba(255,255,255,0.2) 65%,
                transparent 75%
              ),
              linear-gradient(180deg,
                rgba(255,255,255,0.7) 0%,
                rgba(255,255,255,0.3) 15%,
                transparent 30%
              )
            `
          }}
        />
      </motion.div>
      
      {/* Decorative Elements */}
      <motion.div 
        className="absolute top-20 right-10 w-72 h-72 bg-[#32b9e5]/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.15, 0.1]
        }}
        transition={{ 
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div 
        className="absolute bottom-20 left-10 w-96 h-96 bg-[#ec7ec5]/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.1, 0.15, 0.1]
        }}
        transition={{ 
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen py-20">
          {/* Left Content */}
          <motion.div 
            className="text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              className="inline-flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-lg mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Icon icon="solar:star-bold-duotone" className="w-5 h-5 text-[#32b9e5]" />
              <span className="text-sm text-gray-700 font-medium">Excellence in Dental Care Since 2008</span>
            </motion.div>

            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-[Rubik] font-medium leading-tight text-gray-900 mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Creating Beautiful
              <motion.span 
                className="block font-semibold bg-gradient-to-r from-[#32b9e5] to-[#ec7ec5] bg-clip-text text-transparent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                Healthy Smiles
              </motion.span>
            </motion.h1>

            <motion.p 
              className="text-xl text-gray-700 leading-relaxed mb-8 max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              Welcome to NewCharm Dental, where advanced technology meets compassionate care. 
              Our expert team is dedicated to giving you the confident smile you deserve.
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row gap-4 mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
            >
              <Link
                to="contact"
                smooth={true}
                duration={500}
                offset={-80}
                className="group px-8 py-4 bg-[#32b9e5] text-white rounded-xl hover:bg-[#ec7ec5] transition-all duration-300 font-medium shadow-lg flex items-center justify-center space-x-3 cursor-pointer"
              >
                <Icon icon="solar:calendar-add-bold-duotone" className="w-6 h-6" />
                <span>Book Appointment</span>
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="tel:+264612345678"
                className="px-8 py-4 bg-white text-gray-900 rounded-xl hover:shadow-lg transition-all duration-300 font-medium shadow-md flex items-center justify-center space-x-3 border border-gray-200"
              >
                <Icon icon="solar:phone-calling-bold-duotone" className="w-6 h-6 text-[#32b9e5]" />
                <span>+264 61 234 5678</span>
              </a>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div 
              className="grid grid-cols-3 gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-[#32b9e5] mb-1">15+</div>
                <div className="text-sm text-gray-600">Years Experience</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#32b9e5] mb-1">10k+</div>
                <div className="text-sm text-gray-600">Happy Patients</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#32b9e5] mb-1">4.9★</div>
                <div className="text-sm text-gray-600">Google Rating</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

    </section>
  );
};

export default NewCharmHero;