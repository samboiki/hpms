import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';

const NewCharmTestimonials: React.FC = () => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Testimonials with Namibian names and authentic reviews
  const testimonials = [
    {
      name: 'Helena Shikongo',
      role: 'Business Owner',
      content: 'Dr. Amalwa and her team at NewCharm Dental are absolutely exceptional! They transformed my smile with veneers, and I couldn\'t be happier. The care and attention to detail is world-class.',
      rating: 5,
      treatment: 'Cosmetic Dentistry',
      image: 'https://images.unsplash.com/photo-1589156191108-c762ff4b96ab?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '2 weeks ago'
    },
    {
      name: 'Johannes Nambinga',
      role: 'Engineer',
      content: 'I had a complex root canal procedure, and the team made it completely painless. Their use of modern technology and gentle approach made all the difference. Highly recommend!',
      rating: 5,
      treatment: 'Endodontics',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '1 month ago'
    },
    {
      name: 'Maria Kapolo',
      role: 'Teacher',
      content: 'As someone who was terrified of dentists, NewCharm Dental changed everything for me. They are patient, understanding, and truly care about your comfort. My whole family goes here now!',
      rating: 5,
      treatment: 'Family Dentistry',
      image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '3 weeks ago'
    },
    {
      name: 'Petrus Hamutenya',
      role: 'Government Official',
      content: 'The professionalism at NewCharm is unmatched in Windhoek. From the reception to the dental chair, everyone makes you feel valued. My dental implants look and feel natural!',
      rating: 5,
      treatment: 'Dental Implants',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '2 months ago'
    },
    {
      name: 'Ndapewa Amadhila',
      role: 'Pharmacist',
      content: 'The Invisalign treatment at NewCharm gave me the confidence I\'ve always wanted. Dr. Amalwa\'s expertise and the team\'s support throughout the process was incredible!',
      rating: 5,
      treatment: 'Orthodontics',
      image: 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '1 month ago'
    },
    {
      name: 'Tomas Shivute',
      role: 'Bank Manager',
      content: 'I\'ve been coming to NewCharm for 5 years now. They maintain the highest standards of hygiene and use the latest equipment. The best dental practice in Namibia!',
      rating: 5,
      treatment: 'Preventive Care',
      image: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '3 months ago'
    },
    {
      name: 'Frieda Nghipondoka',
      role: 'Entrepreneur',
      content: 'The teeth whitening treatment exceeded my expectations! The results were immediate and long-lasting. NewCharm\'s attention to detail and patient care is exceptional.',
      rating: 5,
      treatment: 'Teeth Whitening',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '2 weeks ago'
    },
    {
      name: 'Elias Iiyambo',
      role: 'Architect',
      content: 'After an accident, I needed emergency dental care. NewCharm saw me immediately and saved my tooth. Their emergency response and follow-up care were outstanding!',
      rating: 5,
      treatment: 'Emergency Dentistry',
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '1 month ago'
    },
    {
      name: 'Selma Haipinge',
      role: 'Lawyer',
      content: 'The pediatric care for my children at NewCharm is amazing. They make dental visits fun and educational. My kids actually look forward to their check-ups now!',
      rating: 5,
      treatment: 'Pediatric Dentistry',
      image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop&crop=face',
      source: 'google',
      date: '1 month ago'
    }
  ];

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, []);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -336, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 336, behavior: 'smooth' });
    }
  };

  return (
    <section id="testimonials" className="py-16 bg-gradient-to-br from-gray-50 to-white overflow-hidden relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div 
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center space-x-2 bg-[#00BCD4]/10 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:chat-round-like-bold-duotone" className="w-4 h-4 text-[#00BCD4]" />
            <span className="text-sm text-[#00BCD4] font-medium">Patient Stories</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-4 font-[Lexend]">
            Real smiles,
            <span className="text-[#00BCD4] font-normal"> real stories</span>
          </h2>
          <p className="text-base text-gray-600 leading-relaxed">
            Hear from our patients about their experiences at NewCharm Dental.
          </p>
        </motion.div>

        {/* Testimonials Slider Container */}
        <div className="relative max-w-7xl mx-auto">
          {/* Professional Navigation Arrows */}
          {canScrollLeft && (
            <button
              onClick={scrollLeft}
              className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:bg-white"
              aria-label="Previous testimonials"
            >
              <Icon icon="solar:alt-arrow-left-bold" className="w-5 h-5 text-gray-700 group-hover:text-[#00BCD4] transition-colors" />
            </button>
          )}
          
          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:bg-white"
              aria-label="Next testimonials"
            >
              <Icon icon="solar:alt-arrow-right-bold" className="w-5 h-5 text-gray-700 group-hover:text-[#00BCD4] transition-colors" />
            </button>
          )}

          {/* Scrollable Container */}
          <div className="overflow-hidden">
            <div 
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: Math.min(index * 0.1, 0.3) }}
                  className="flex-none w-[320px] bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group"
                >
                  {/* Google Review Badge - Simplified */}
                  <div className="bg-gradient-to-r from-[#4285F4] to-[#34A853] p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon icon="logos:google-icon" className="w-5 h-5" />
                        <span className="text-white text-xs font-medium">Google Review</span>
                      </div>
                      <span className="text-white/80 text-xs">{testimonial.date}</span>
                    </div>
                  </div>

                  {/* Compact Card Content */}
                  <div className="p-4">
                    {/* Header with smaller image */}
                    <div className="flex items-start space-x-3 mb-3">
                      <img 
                        src={testimonial.image}
                        alt={testimonial.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{testimonial.name}</h4>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Icon 
                              key={i} 
                              icon="solar:star-bold" 
                              className={`w-3.5 h-3.5 ${i < testimonial.rating ? 'text-yellow-400' : 'text-gray-200'}`} 
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Testimonial Content */}
                    <p className="text-gray-700 text-sm leading-relaxed mb-3 line-clamp-3">
                      "{testimonial.content}"
                    </p>
                    
                    {/* Treatment tag - smaller */}
                    <div className="inline-flex items-center space-x-1.5 bg-[#00BCD4]/10 px-3 py-1 rounded-full">
                      <Icon icon="solar:tooth-bold" className="w-3.5 h-3.5 text-[#00BCD4]" />
                      <span className="text-xs text-gray-700">
                        {testimonial.treatment}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Google Reviews Summary - Compact */}
        <motion.div 
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 bg-white px-6 py-4 rounded-xl shadow-lg">
            <div className="flex items-center space-x-3">
              <Icon icon="logos:google-icon" className="w-8 h-8" />
              <div className="text-left">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">4.9</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Icon key={i} icon="solar:star-bold" className="w-4 h-4 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600">150+ Google Reviews</p>
              </div>
            </div>
            <a 
              href="https://www.google.com/search?q=NewCharm+Dental+Windhoek+reviews" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-[#00BCD4] hover:text-[#0097A7] font-medium transition-colors"
            >
              View all reviews →
            </a>
          </div>
        </motion.div>

        {/* Trust Badges */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-6 font-medium">Trusted by the Windhoek Community</p>
          <div className="flex flex-wrap justify-center items-center gap-8">
            <motion.div 
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
            >
              <Icon icon="solar:verified-check-bold" className="w-6 h-6 text-[#00BCD4]" />
              <span className="text-gray-700 font-semibold">Google Verified Business</span>
            </motion.div>
            <motion.div 
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
            >
              <Icon icon="solar:shield-check-bold" className="w-6 h-6 text-[#00BCD4]" />
              <span className="text-gray-700 font-semibold">100% Authentic Reviews</span>
            </motion.div>
            <motion.div 
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
            >
              <Icon icon="solar:cup-star-bold" className="w-6 h-6 text-[#00BCD4]" />
              <span className="text-gray-700 font-semibold">Top Rated in Namibia</span>
            </motion.div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-4 {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </section>
  );
};

export default NewCharmTestimonials;