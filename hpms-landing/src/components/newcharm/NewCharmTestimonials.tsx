import React, { useState } from 'react';
import { Icon } from '@iconify/react';

const NewCharmTestimonials: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Business Professional',
      content: 'NewCharm Dental has completely transformed my smile and my confidence. The team is incredibly professional, and the modern facility made me feel at ease throughout my treatment.',
      rating: 5,
      treatment: 'Cosmetic Dentistry'
    },
    {
      name: 'Michael Chen',
      role: 'Software Engineer',
      content: 'I was nervous about getting dental implants, but the team at NewCharm made the entire process smooth and painless. The results exceeded my expectations!',
      rating: 5,
      treatment: 'Dental Implants'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Teacher',
      content: 'As someone with dental anxiety, I can\'t recommend NewCharm enough. They truly care about patient comfort and take the time to explain everything thoroughly.',
      rating: 5,
      treatment: 'General Dentistry'
    },
    {
      name: 'David Thompson',
      role: 'Retired Veteran',
      content: 'The level of care and attention to detail at NewCharm is outstanding. They\'ve been taking care of my family\'s dental needs for years, and we couldn\'t be happier.',
      rating: 5,
      treatment: 'Family Dentistry'
    }
  ];

  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section id="testimonials" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#7C3AED]/10 px-4 py-2 rounded-full mb-6">
            <Icon icon="solar:chat-round-like-bold" className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-sm text-[#7C3AED] font-medium">Patient Stories</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-light text-gray-900 mb-6">
            Real smiles,
            <span className="block text-[#7C3AED] font-normal mt-2">real stories</span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Hear from our patients about their experiences at NewCharm Dental.
          </p>
        </div>

        {/* Testimonial Carousel */}
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gray-50 rounded-3xl p-12 md:p-16">
            {/* Quote Icon */}
            <Icon 
              icon="solar:quote-up-square-bold" 
              className="w-12 h-12 text-[#7C3AED]/20 absolute top-8 left-8"
            />

            {/* Testimonial Content */}
            <div className="relative z-10 text-center">
              {/* Stars */}
              <div className="flex justify-center space-x-1 mb-6">
                {[...Array(testimonials[activeIndex].rating)].map((_, i) => (
                  <Icon key={i} icon="solar:star-bold" className="w-5 h-5 text-yellow-400" />
                ))}
              </div>

              {/* Content */}
              <p className="text-xl text-gray-700 leading-relaxed mb-8 italic">
                "{testimonials[activeIndex].content}"
              </p>

              {/* Author */}
              <div className="space-y-2">
                <h4 className="text-lg font-medium text-gray-900">
                  {testimonials[activeIndex].name}
                </h4>
                <p className="text-sm text-gray-600">
                  {testimonials[activeIndex].role}
                </p>
                <div className="inline-flex items-center space-x-2 bg-white px-3 py-1 rounded-full">
                  <Icon icon="solar:tooth-bold" className="w-4 h-4 text-[#7C3AED]" />
                  <span className="text-xs text-gray-600">
                    {testimonials[activeIndex].treatment}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-12">
              <button
                onClick={prevTestimonial}
                className="p-3 bg-white rounded-full hover:bg-gray-100 transition-colors duration-300 shadow-sm"
              >
                <Icon icon="solar:arrow-left-linear" className="w-5 h-5 text-gray-700" />
              </button>

              {/* Indicators */}
              <div className="flex space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === activeIndex
                        ? 'w-8 bg-[#7C3AED]'
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextTestimonial}
                className="p-3 bg-white rounded-full hover:bg-gray-100 transition-colors duration-300 shadow-sm"
              >
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-6">Trusted by thousands of patients</p>
          <div className="flex flex-wrap justify-center items-center gap-8">
            <div className="flex items-center space-x-2">
              <Icon icon="solar:verified-check-bold" className="w-6 h-6 text-[#7C3AED]" />
              <span className="text-gray-700 font-medium">Google Reviews 4.9★</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon icon="solar:shield-check-bold" className="w-6 h-6 text-[#7C3AED]" />
              <span className="text-gray-700 font-medium">BBB Accredited</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon icon="solar:cup-star-bold" className="w-6 h-6 text-[#7C3AED]" />
              <span className="text-gray-700 font-medium">Best of City 2023</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewCharmTestimonials;