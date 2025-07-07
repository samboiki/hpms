import React from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

const NewCharmHelpBar: React.FC = () => {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Card - Need Help */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-[#ec7ec5] to-[#e665bb] rounded-2xl p-8 md:p-10 shadow-lg"
          >
            <div className="flex items-center space-x-6">
              {/* Decorative dots */}
              <div className="hidden md:block">
                <img 
                  src="https://www.portotheme.com/wordpress/porto/shop50/wp-content/uploads/sites/233/2024/07/shop50-slide-dots-block.png"
                  alt="Decorative dots"
                  width="17"
                  height="94"
                  className="opacity-50"
                />
              </div>
              
              {/* Help Icon and Text */}
              <div className="flex items-center space-x-5">
                <div className="flex-shrink-0">
                  <img
                    src="https://www.portotheme.com/wordpress/porto/shop50/wp-content/uploads/sites/233/2024/07/shop50-question-icon.png"
                    alt="Question Icon"
                    width="61"
                    height="61"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-[7px]">Need Any Help?</h3>
                  <p className="text-white/70">We are here to help you with any question.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Card - Contact Info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white rounded-2xl p-8 md:p-10 shadow-lg"
          >
            <div className="grid md:grid-cols-5 gap-4 items-center h-full">
              {/* Phone Section */}
              <div className="md:col-span-2">
                <a 
                  href="tel:+264612345678" 
                  className="group block mb-3"
                >
                  <div className="flex items-center space-x-3">
                    <Icon icon="solar:phone-bold" className="w-8 h-8 text-gray-800" />
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[#32b9e5] transition-colors">+264 61 234 5678</h3>
                  </div>
                </a>
                <button className="inline-flex items-center px-[1.52em] py-[0.73em] bg-[#f1f2fe] text-gray-800 rounded-full text-[1.1428em] font-semibold hover:bg-[#e8e9fc] transition-all duration-300">
                  <span>Online Help</span>
                  <Icon icon="solar:square-arrow-up-right-bold" className="w-4 h-4 ml-2" />
                </button>
              </div>

              {/* Hours and FAQ Section */}
              <div className="md:col-span-3">
                <p className="text-gray-700 mb-3">Monday to Saturday - 8am - 6pm</p>
                <a 
                  href="#faq" 
                  className="inline-flex items-center text-[#32b9e5] hover:text-[#ec7ec5] bg-[rgba(0,0,12,0.01)] px-4 py-2 rounded transition-all duration-300 text-sm font-medium"
                >
                  <span>Frequently Asked Questions</span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default NewCharmHelpBar;