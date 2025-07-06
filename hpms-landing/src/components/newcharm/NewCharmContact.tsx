import React, { useState } from 'react';
import { Icon } from '@iconify/react';

const NewCharmContact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    message: ''
  });

  const services = [
    'General Dentistry',
    'Cosmetic Dentistry',
    'Orthodontics',
    'Dental Implants',
    'Emergency Care',
    'Other'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  const contactInfo = [
    {
      icon: 'solar:map-point-bold',
      title: 'Visit Us',
      lines: ['123 Dental Plaza', 'Suite 100', 'City, State 12345']
    },
    {
      icon: 'solar:phone-bold',
      title: 'Call Us',
      lines: ['(555) 123-4567', 'Mon-Fri: 8am-6pm', 'Sat: 9am-2pm']
    },
    {
      icon: 'solar:letter-bold',
      title: 'Email Us',
      lines: ['hello@newcharmdental.com', 'info@newcharmdental.com', 'We reply within 24 hours']
    }
  ];

  return (
    <section id="contact" className="py-24 bg-gray-50">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full mb-6 shadow-sm">
            <Icon icon="solar:chat-line-bold" className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-sm text-[#7C3AED] font-medium">Get in Touch</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-light text-gray-900 mb-6">
            Start your journey to
            <span className="block text-[#7C3AED] font-normal mt-2">a healthier smile</span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Schedule your appointment today or reach out with any questions. 
            We're here to help you achieve optimal oral health.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl p-10 shadow-sm">
              <h3 className="text-2xl font-medium text-gray-900 mb-8">Request an Appointment</h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors"
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Needed
                    </label>
                    <select
                      value={formData.service}
                      onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors"
                      required
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Message (Optional)
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-colors resize-none"
                    rows={4}
                    placeholder="Tell us more about your dental needs..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-8 py-4 bg-[#7C3AED] text-white rounded-full hover:bg-[#6B21A8] transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Schedule Appointment
                </button>

                <p className="text-sm text-gray-500 text-center">
                  By submitting this form, you agree to our{' '}
                  <a href="#" className="text-[#7C3AED] hover:text-[#6B21A8]">
                    Privacy Policy
                  </a>
                </p>
              </form>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            {contactInfo.map((info, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon icon={info.icon} className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">{info.title}</h4>
                    {info.lines.map((line, idx) => (
                      <p key={idx} className="text-gray-600 text-sm">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Emergency Care */}
            <div className="bg-[#7C3AED] text-white rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-3">
                <Icon icon="solar:siren-bold" className="w-6 h-6" />
                <h4 className="text-lg font-medium">Emergency Care</h4>
              </div>
              <p className="text-sm opacity-90 mb-4">
                Dental emergencies don't wait. Call us immediately for urgent care.
              </p>
              <a
                href="tel:555-123-4567"
                className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors duration-300"
              >
                <Icon icon="solar:phone-calling-bold" className="w-5 h-5" />
                <span className="font-medium">Call Now</span>
              </a>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="mt-16 bg-white rounded-3xl p-4 shadow-sm">
          <div className="h-96 bg-gray-100 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <Icon icon="solar:map-bold" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Interactive map would be displayed here</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewCharmContact;