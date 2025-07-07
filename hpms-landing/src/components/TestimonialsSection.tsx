'use client';

import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { Star, Quote, ChevronLeft, ChevronRight, Heart, Shield, Award } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TestimonialsSectionProps {
  practice: Practice;
}

interface Testimonial {
  id: number;
  name: string;
  role: string;
  image: string;
  rating: number;
  text: string;
  date: string;
  treatment: string;
}

export default function TestimonialsSection({ practice }: TestimonialsSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Sarah Johnson",
      role: "Patient",
      image: "https://i.pravatar.cc/150?img=1",
      rating: 5,
      text: "The care I received was exceptional. From the moment I walked in, the staff made me feel comfortable and valued. Dr. Smith took the time to explain everything thoroughly, and my recovery has been smooth thanks to their excellent follow-up care.",
      date: "2 weeks ago",
      treatment: "General Consultation"
    },
    {
      id: 2,
      name: "Michael Chen",
      role: "Long-term Patient",
      image: "https://i.pravatar.cc/150?img=3",
      rating: 5,
      text: "I've been coming here for over 5 years, and the consistency in quality care is remarkable. The modern facilities, combined with the compassionate staff, make this the best medical practice in the area. Highly recommend!",
      date: "1 month ago",
      treatment: "Specialist Care"
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      role: "New Patient",
      image: "https://i.pravatar.cc/150?img=5",
      rating: 5,
      text: "As someone new to the area, finding a trustworthy medical practice was crucial. The online booking was seamless, wait times were minimal, and the doctor addressed all my concerns. I'm grateful to have found such professional healthcare.",
      date: "3 weeks ago",
      treatment: "Health Checkup"
    },
    {
      id: 4,
      name: "David Thompson",
      role: "Patient",
      image: "https://i.pravatar.cc/150?img=8",
      rating: 5,
      text: "The emergency care I received was outstanding. Despite being extremely busy, the staff remained professional and attentive. They kept me informed throughout the process, and the follow-up care exceeded my expectations.",
      date: "1 week ago",
      treatment: "Emergency Care"
    },
    {
      id: 5,
      name: "Lisa Martinez",
      role: "Family Patient",
      image: "https://i.pravatar.cc/150?img=9",
      rating: 5,
      text: "We've been bringing our entire family here for years. The pediatric care is excellent, and they always make my children feel at ease. The convenient location and flexible scheduling make it perfect for busy families like ours.",
      date: "2 months ago",
      treatment: "Family Medicine"
    }
  ];

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const stats = [
    { icon: Heart, value: "10,000+", label: "Happy Patients" },
    { icon: Star, value: "4.9/5", label: "Average Rating" },
    { icon: Shield, value: "15+", label: "Years of Service" },
    { icon: Award, value: "50+", label: "Awards Won" }
  ];

  return (
    <section id="testimonials" className="py-24 relative overflow-hidden bg-gradient-to-b from-white to-gray-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, ${practice.primary_color}20 0%, transparent 50%),
                           radial-gradient(circle at 80% 80%, ${practice.secondary_color}20 0%, transparent 50%)`
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
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
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Star className="w-4 h-4" />
            {practice.slug === 'newcharm-dental' ? 'Patient Success Stories' : 'Patient Stories'}
            <Star className="w-4 h-4" />
          </motion.span>
          <motion.h2 
            className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 50%, ${practice.primary_color} 100%)`,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {practice.slug === 'newcharm-dental' ? 'Smiles Tell Our Story' : 'What Our Patients Say'}
          </motion.h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real experiences from real patients. Discover why thousands trust us with their healthcare needs.
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
            >
              <motion.div 
                className="relative w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
                style={{ 
                  background: `linear-gradient(135deg, ${practice.primary_color}20, ${practice.secondary_color}20)`,
                }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <stat.icon className="w-10 h-10" style={{ color: practice.primary_color }} />
                {/* Pulse effect */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: index * 0.2,
                  }}
                  style={{
                    background: `radial-gradient(circle, ${practice.primary_color}40, transparent)`,
                  }}
                />
              </motion.div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials Carousel */}
        <div className="relative">
          <motion.div
            className="overflow-hidden rounded-2xl"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="relative bg-white shadow-xl">
              {/* Quote Icon */}
              <div 
                className="absolute top-8 left-8 w-16 h-16 rounded-full flex items-center justify-center opacity-10"
                style={{ backgroundColor: practice.primary_color }}
              >
                <Quote className="w-8 h-8 text-white" />
              </div>

              {/* Testimonial Content */}
              <div className="relative px-8 lg:px-16 py-12">
                {testimonials.map((testimonial, index) => (
                  <motion.div
                    key={testimonial.id}
                    className={`${index === activeIndex ? 'block' : 'hidden'}`}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: index === activeIndex ? 1 : 0, x: index === activeIndex ? 0 : 50 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="max-w-4xl mx-auto">
                      {/* Rating Stars */}
                      <div className="flex items-center justify-center mb-6">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className="w-6 h-6 fill-current" 
                            style={{ color: i < testimonial.rating ? '#fbbf24' : '#e5e7eb' }}
                          />
                        ))}
                      </div>

                      {/* Testimonial Text */}
                      <blockquote className="text-xl lg:text-2xl text-gray-700 text-center mb-8 leading-relaxed">
                        "{testimonial.text}"
                      </blockquote>

                      {/* Author Info */}
                      <div className="flex items-center justify-center">
                        <img
                          src={testimonial.image}
                          alt={testimonial.name}
                          className="w-16 h-16 rounded-full object-cover mr-4"
                        />
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">{testimonial.name}</div>
                          <div className="text-sm text-gray-600">{testimonial.treatment} • {testimonial.date}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  onClick={goToPrevious}
                  className="ml-4 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                  style={{ color: practice.primary_color }}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  onClick={goToNext}
                  className="mr-4 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                  style={{ color: practice.primary_color }}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Dots Indicator */}
              <div className="flex justify-center pb-8 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveIndex(index);
                      setIsAutoPlaying(false);
                    }}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === activeIndex 
                        ? 'w-8' 
                        : 'hover:scale-125'
                    }`}
                    style={{ 
                      backgroundColor: index === activeIndex 
                        ? practice.primary_color 
                        : '#e5e7eb' 
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Additional Testimonials Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {testimonials.slice(0, 3).map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.7 + index * 0.1 }}
              >
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-4 h-4 fill-current" 
                      style={{ color: i < testimonial.rating ? '#fbbf24' : '#e5e7eb' }}
                    />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">{testimonial.date}</span>
                </div>
                <p className="text-gray-700 mb-4 line-clamp-3">"{testimonial.text}"</p>
                <div className="flex items-center">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-10 h-10 rounded-full object-cover mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{testimonial.name}</div>
                    <div className="text-xs text-gray-600">{testimonial.treatment}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA Section */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-gray-600 mb-6">Join thousands of satisfied patients who trust us with their health</p>
          <motion.button
            onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-3 rounded-xl text-white font-semibold transition-all duration-300"
            style={{ backgroundColor: practice.primary_color }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Book Your Appointment Today
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}