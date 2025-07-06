import React from 'react';
import { Icon } from '@iconify/react';

const NewCharmServices: React.FC = () => {
  const services = [
    {
      icon: 'solar:tooth-bold',
      title: 'General Dentistry',
      description: 'Comprehensive oral health care including cleanings, fillings, and preventive treatments.',
      features: ['Regular Check-ups', 'Professional Cleaning', 'Cavity Treatment']
    },
    {
      icon: 'solar:star-shine-bold',
      title: 'Cosmetic Dentistry',
      description: 'Transform your smile with veneers, whitening, and aesthetic treatments.',
      features: ['Teeth Whitening', 'Porcelain Veneers', 'Smile Makeovers']
    },
    {
      icon: 'solar:shield-plus-bold',
      title: 'Restorative Care',
      description: 'Advanced solutions to restore function and beauty to damaged teeth.',
      features: ['Dental Crowns', 'Bridges', 'Root Canals']
    },
    {
      icon: 'solar:face-scan-circle-bold',
      title: 'Orthodontics',
      description: 'Modern teeth straightening options including clear aligners.',
      features: ['Clear Aligners', 'Traditional Braces', 'Retainers']
    },
    {
      icon: 'solar:medical-kit-bold',
      title: 'Oral Surgery',
      description: 'Expert surgical procedures performed with precision and care.',
      features: ['Wisdom Teeth', 'Dental Implants', 'Extractions']
    },
    {
      icon: 'solar:users-group-rounded-bold',
      title: 'Family Dentistry',
      description: 'Gentle dental care for patients of all ages, from children to seniors.',
      features: ['Pediatric Care', 'Teen Dentistry', 'Senior Care']
    }
  ];

  return (
    <section id="services" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#7C3AED]/10 px-4 py-2 rounded-full mb-6">
            <Icon icon="solar:heart-shine-bold" className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-sm text-[#7C3AED] font-medium">Our Services</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-light text-gray-900 mb-6">
            Comprehensive dental care
            <span className="block text-[#7C3AED] font-normal mt-2">tailored to you</span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            From routine cleanings to advanced procedures, we offer a full spectrum 
            of dental services using the latest technology and techniques.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="group relative bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100"
            >
              {/* Icon */}
              <div className="mb-6">
                <div className="w-14 h-14 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center group-hover:bg-[#7C3AED]/20 transition-colors duration-300">
                  <Icon icon={service.icon} className="w-7 h-7 text-[#7C3AED]" />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-medium text-gray-900 mb-3">
                {service.title}
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {service.description}
              </p>

              {/* Features */}
              <ul className="space-y-2">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-gray-500">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#7C3AED] mr-2 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Learn More Link */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button className="text-[#7C3AED] text-sm font-medium flex items-center space-x-2 hover:text-[#6B21A8] transition-colors duration-300">
                  <span>Learn More</span>
                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-gray-50 rounded-3xl p-12">
          <h3 className="text-2xl font-light text-gray-900 mb-4">
            Ready to experience premium dental care?
          </h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Schedule your consultation today and discover how we can help you achieve 
            the healthy, beautiful smile you deserve.
          </p>
          <button className="px-8 py-4 bg-[#7C3AED] text-white rounded-full hover:bg-[#6B21A8] transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            Book Your Appointment
          </button>
        </div>
      </div>
    </section>
  );
};

export default NewCharmServices;