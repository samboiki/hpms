import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';

const NewCharmTestimonials: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const testimonials = [
    {
      name: 'Maria Shikongo',
      role: 'General Consultation',
      content: 'The care I received was exceptional. From the moment I walked in, the staff made me feel comfortable and valued. Dr. Timoteus took the time to explain everything thoroughly, and my recovery has been smooth thanks to their excellent follow-up care.',
      rating: 5,
      treatment: 'General Consultation',
      image: 'https://i.pravatar.cc/150?img=1',
      date: '2 weeks ago'
    },
    {
      name: 'Johannes Hamutenya',
      role: 'Specialist Care',
      content: 'I\'ve been coming here for over 5 years, and the consistency in quality care is remarkable. The modern facilities, combined with the compassionate staff, make this the best dental practice in Windhoek. Highly recommend!',
      rating: 5,
      treatment: 'Specialist Care',
      image: 'https://i.pravatar.cc/150?img=3',
      date: '1 month ago'
    },
    {
      name: 'Selma Nangula',
      role: 'Dental Checkup',
      content: 'As someone new to Windhoek, finding a trustworthy dental practice was crucial. The online booking was seamless, wait times were minimal, and the dentist addressed all my concerns. I\'m grateful to have found such professional dental care.',
      rating: 5,
      treatment: 'Dental Checkup',
      image: 'https://i.pravatar.cc/150?img=5',
      date: '3 weeks ago'
    },
    {
      name: 'Petrus Shilongo',
      role: 'Emergency Care',
      content: 'The emergency dental care I received was outstanding. Despite being extremely busy, the staff remained professional and attentive. They kept me informed throughout the process, and the pain relief was immediate.',
      rating: 5,
      treatment: 'Emergency Care',
      image: 'https://i.pravatar.cc/150?img=8',
      date: '1 week ago'
    },
    {
      name: 'Elizabeth Kangootui',
      role: 'Family Dentistry',
      content: 'We\'ve been bringing our entire family here for years. The pediatric dental care is excellent, and they always make my children feel at ease. The Klein Windhoek location and flexible scheduling make it perfect for busy families like ours.',
      rating: 5,
      treatment: 'Family Dentistry',
      image: 'https://i.pravatar.cc/150?img=9',
      date: '2 months ago'
    }
  ];

  const handlePrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeIndex]);

  return (
    <section id="testimonials" className="py-20 bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div 
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center space-x-2 bg-[#32b9e5]/10 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:chat-round-like-bold-duotone" className="w-4 h-4 text-[#32b9e5]" />
            <span className="text-sm text-[#32b9e5] font-medium">Patient Stories</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-lexend font-light text-gray-900 mb-4">
            Real smiles,
            <span className="text-[#32b9e5] font-normal"> real stories</span>
          </h2>
          <p className="text-base text-gray-600 leading-relaxed">
            Hear from our patients about their experiences at NewCharm Dental.
          </p>
        </motion.div>
        
        <div className="relative">
          {/* Main Testimonial Carousel */}
          <div className="overflow-hidden rounded-2xl" style={{ opacity: 1 }}>
            <div className="relative bg-white shadow-xl">
              {/* Google G Logo Background */}
              <div 
                className="absolute top-8 left-8 w-20 h-20 rounded-2xl flex items-center justify-center opacity-10"
                style={{ backgroundColor: '#f5f5f5' }}
              >
                <svg 
                  viewBox="0 0 48 48" 
                  className="w-14 h-14"
                  aria-hidden="true"
                >
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              </div>

              {/* Testimonial Content */}
              <div className="relative px-8 lg:px-16 py-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="max-w-4xl mx-auto"
                  >
                    {/* Stars */}
                    <div className="flex items-center justify-center mb-6">
                      {[...Array(5)].map((_, i) => (
                        <svg 
                          key={i}
                          xmlns="http://www.w3.org/2000/svg" 
                          width="24" 
                          height="24" 
                          viewBox="0 0 24 24" 
                          fill="currentColor" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="w-6 h-6" 
                          aria-hidden="true" 
                          style={{ color: '#fbbf24' }}
                        >
                          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
                        </svg>
                      ))}
                    </div>

                    {/* Quote */}
                    <blockquote className="text-xl lg:text-2xl text-gray-700 text-center mb-8 leading-relaxed">
                      "{testimonials[activeIndex].content}"
                    </blockquote>

                    {/* Author */}
                    <div className="flex items-center justify-center">
                      <img 
                        src={testimonials[activeIndex].image}
                        alt={testimonials[activeIndex].name}
                        className="w-16 h-16 rounded-full object-cover mr-4"
                      />
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">
                          {testimonials[activeIndex].name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {testimonials[activeIndex].treatment} • {testimonials[activeIndex].date}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Arrows */}
              <div className="absolute inset-y-0 left-0 flex items-center">
                <button 
                  onClick={handlePrevious}
                  className="ml-4 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                  style={{ color: '#32b9e5' }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-6 h-6" 
                    aria-hidden="true"
                  >
                    <path d="m15 18-6-6 6-6"></path>
                  </svg>
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button 
                  onClick={handleNext}
                  className="mr-4 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                  style={{ color: '#32b9e5' }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-6 h-6" 
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6"></path>
                  </svg>
                </button>
              </div>

              {/* Dots Indicator */}
              <div className="flex justify-center pb-8 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 hover:scale-125 ${
                      index === activeIndex ? 'w-8' : 'w-2'
                    }`}
                    style={{ 
                      backgroundColor: index === activeIndex ? '#32b9e5' : '#E5E7EB' 
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Small Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12" style={{ opacity: 1, transform: 'none' }}>
            {testimonials.slice(0, 3).map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                style={{ opacity: 1, transform: 'none' }}
              >
                {/* Stars and Date */}
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg 
                      key={i}
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="w-4 h-4" 
                      aria-hidden="true" 
                      style={{ color: '#fbbf24' }}
                    >
                      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
                    </svg>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">{testimonial.date}</span>
                </div>

                {/* Quote */}
                <p className="text-gray-700 mb-4" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center">
                  <img 
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-10 h-10 rounded-full object-cover mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-gray-600">
                      {testimonial.treatment}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewCharmTestimonials;