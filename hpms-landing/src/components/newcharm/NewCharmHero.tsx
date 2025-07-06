import React from 'react';
import { Icon } from '@iconify/react';

const NewCharmHero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-50">
      {/* Subtle Pattern Background */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='a' patternUnits='userSpaceOnUse' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='1' fill='%237C3AED' fill-opacity='0.05'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23a)'/%3E%3C/svg%3E")`
          }}
        ></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-sm">
              <Icon icon="solar:star-bold" className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-sm text-gray-600 font-medium">Premium Dental Care</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-light leading-tight text-gray-900">
              Your smile is our
              <span className="block text-[#7C3AED] font-normal mt-2">masterpiece</span>
            </h1>

            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed font-light">
              Experience exceptional dental care in a modern, comfortable environment. 
              We combine cutting-edge technology with personalized attention.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button className="px-8 py-4 bg-[#7C3AED] text-white rounded-full hover:bg-[#6B21A8] transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2">
                <span>Schedule Your Visit</span>
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5" />
              </button>
              <button className="px-8 py-4 bg-white text-gray-900 rounded-full hover:bg-gray-50 transition-all duration-300 font-medium shadow-md hover:shadow-lg flex items-center space-x-2">
                <Icon icon="solar:phone-bold" className="w-5 h-5" />
                <span>Call Us Today</span>
              </button>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: 'solar:clock-circle-bold',
                title: 'Same Day Appointments',
                description: 'Flexible scheduling for your convenience'
              },
              {
                icon: 'solar:shield-check-bold',
                title: '100% Safe & Sterile',
                description: 'Highest standards of hygiene and safety'
              },
              {
                icon: 'solar:heart-bold',
                title: 'Gentle Care',
                description: 'Compassionate treatment for all ages'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
              >
                <Icon icon={feature.icon} className="w-8 h-8 text-[#7C3AED] mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 animate-float">
        <div className="w-20 h-20 bg-[#7C3AED]/10 rounded-full blur-xl"></div>
      </div>
      <div className="absolute bottom-20 right-10 animate-float-delay">
        <div className="w-32 h-32 bg-[#7C3AED]/10 rounded-full blur-xl"></div>
      </div>
    </section>
  );
};

export default NewCharmHero;