import React from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-scroll';
import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';

interface NewCharmHeroProps {
  practice: Practice;
}

const NewCharmHero: React.FC<NewCharmHeroProps> = ({ practice }) => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Professional Background Image */}
      <div className="absolute inset-0">
        <img 
          src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=2000&auto=format&fit=crop"
          alt="Modern dental clinic"
          className="w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen py-20">
          {/* Left Content */}
          <motion.div 
            className="text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-lg mb-6">
              <Icon icon="solar:star-bold-duotone" className="w-5 h-5 text-[#00BCD4]" />
              <span className="text-sm text-gray-700 font-medium">Excellence in Dental Care Since 2008</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light leading-tight text-gray-900 mb-6">
              Creating Beautiful
              <span className="block font-medium text-[#00BCD4]">Healthy Smiles</span>
            </h1>

            <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-xl">
              Welcome to NewCharm Dental, where advanced technology meets compassionate care. 
              Our expert team is dedicated to giving you the confident smile you deserve.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link
                to="contact"
                smooth={true}
                duration={500}
                offset={-80}
                className="group px-8 py-4 bg-[#00BCD4] text-white rounded-xl hover:bg-[#0097A7] transition-all duration-300 font-medium shadow-lg flex items-center justify-center space-x-3 cursor-pointer"
              >
                <Icon icon="solar:calendar-add-bold-duotone" className="w-6 h-6" />
                <span>Book Appointment</span>
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="tel:+264612345678"
                className="px-8 py-4 bg-white text-gray-900 rounded-xl hover:shadow-lg transition-all duration-300 font-medium shadow-md flex items-center justify-center space-x-3 border border-gray-200"
              >
                <Icon icon="solar:phone-calling-bold-duotone" className="w-6 h-6 text-[#00BCD4]" />
                <span>+264 61 234 5678</span>
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#00BCD4] mb-1">15+</div>
                <div className="text-sm text-gray-600">Years Experience</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#00BCD4] mb-1">10k+</div>
                <div className="text-sm text-gray-600">Happy Patients</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#00BCD4] mb-1">4.9★</div>
                <div className="text-sm text-gray-600">Google Rating</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

    </section>
  );
};

export default NewCharmHero;