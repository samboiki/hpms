'use client';

import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Send, MessageCircle, Navigation } from 'lucide-react';
import { useState, FormEvent } from 'react';

interface EnhancedContactSectionProps {
  practice: Practice;
}

export default function EnhancedContactSection({ practice }: EnhancedContactSectionProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    location: 'windhoek'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('windhoek');

  const locations = practice.slug === 'dr-polina-aesthetics' ? [
    {
      id: 'windhoek',
      name: 'Windhoek Clinic',
      address: 'Feld Street 4, Ausspannplatz',
      city: 'Windhoek',
      description: 'Close to Maerua Mall',
      phone: '+264 81 435 8844',
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3674.5!2d17.0833!3d-22.5667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjLCsDM0JzAwLjAiUyAxN8KwMDUnMDAuMCJF!5e0!3m2!1sen!2s!4v1234567890',
      hours: 'Mon-Fri: 9:00 AM - 6:00 PM, Sat: 9:00 AM - 2:00 PM'
    },
    {
      id: 'oshikango',
      name: 'Oshikango Clinic',
      address: 'Freedom Square, Shop B3-first floor',
      city: 'Oshikango',
      description: 'Opposite Standard Bank',
      phone: '+264 81 435 8844',
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3674.5!2d17.4!3d-17.4!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTfCsDI0JzAwLjAiUyAxN8KwMjQnMDAuMCJF!5e0!3m2!1sen!2s!4v1234567890',
      hours: 'Mon-Fri: 9:00 AM - 6:00 PM, Sat: 9:00 AM - 2:00 PM'
    }
  ] : [{
    id: 'main',
    name: practice.name,
    address: practice.address || '123 Medical Plaza',
    city: practice.city || 'Windhoek',
    description: '',
    phone: practice.contact_phone || '+264 61 123 4567',
    mapUrl: '',
    hours: 'Mon-Fri: 8:00 AM - 6:00 PM, Sat: 9:00 AM - 1:00 PM'
  }];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setShowSuccess(true);
    setFormData({ name: '', email: '', phone: '', subject: '', message: '', location: 'windhoek' });
    
    setTimeout(() => setShowSuccess(false), 5000);
  };

  const currentLocation = locations.find(loc => loc.id === selectedLocation) || locations[0];

  return (
    <section id="contact" className="py-24 relative overflow-hidden bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <MessageCircle className="w-4 h-4" />
            Contact Us
          </motion.span>
          <motion.h2 
            className="text-5xl md:text-6xl font-black mb-6 bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 50%, ${practice.primary_color} 100%)`,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {practice.slug === 'newcharm-dental' 
              ? 'Visit Our Modern Dental Facility'
              : `Visit Our ${locations.length > 1 ? 'Clinics' : 'Clinic'}`
            }
          </motion.h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {practice.slug === 'dr-polina-aesthetics' 
              ? 'Experience beauty transformations at our state-of-the-art facilities'
              : 'We\'re here to provide you with exceptional healthcare services'
            }
          </p>
        </motion.div>

        {/* Location Selector for Multiple Locations */}
        {locations.length > 1 && (
          <motion.div
            className="flex justify-center gap-4 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {locations.map((location) => (
              <motion.button
                key={location.id}
                onClick={() => setSelectedLocation(location.id)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  selectedLocation === location.id
                    ? 'text-white shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                }`}
                style={{
                  backgroundColor: selectedLocation === location.id ? practice.primary_color : undefined,
                  borderColor: selectedLocation === location.id ? practice.primary_color : undefined
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {location.name}
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Map and Contact Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Map Section - Full Width on Mobile, 2 Columns on Desktop */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden h-full">
              {/* Map Display */}
              <div className="relative h-96 lg:h-full min-h-[400px] bg-gray-200">
                {/* Static Map Image with Google Maps Link */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">{currentLocation.name}</h3>
                    <p className="text-gray-600 mb-4">{currentLocation.address}</p>
                    <motion.a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(currentLocation.address + ', ' + currentLocation.city)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold"
                      style={{ backgroundColor: practice.primary_color }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Navigation className="w-5 h-5" />
                      Get Directions
                    </motion.a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Location Details Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${practice.primary_color}20` }}>
                  <MapPin className="w-6 h-6" style={{ color: practice.primary_color }} />
                </div>
                {currentLocation.name}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Address</p>
                  <p className="text-gray-700 font-medium">{currentLocation.address}</p>
                  <p className="text-gray-600">{currentLocation.city}</p>
                  {currentLocation.description && (
                    <p className="text-sm text-gray-500 mt-1">{currentLocation.description}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                  <a 
                    href={`tel:${currentLocation.phone}`}
                    className="text-gray-700 font-medium hover:text-gray-900 flex items-center gap-2"
                  >
                    <Phone className="w-4 h-4" style={{ color: practice.primary_color }} />
                    {currentLocation.phone}
                  </a>
                </div>

                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Hours</p>
                  <div className="text-gray-700">
                    <p className="font-medium">Monday - Friday</p>
                    <p className="text-gray-600">9:00 AM - 6:00 PM</p>
                    <p className="font-medium mt-2">Saturday</p>
                    <p className="text-gray-600">9:00 AM - 2:00 PM</p>
                    <p className="font-medium mt-2">Sunday</p>
                    <p className="text-gray-600">Closed</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Email</p>
                  <a 
                    href={`mailto:${practice.contact_email}`}
                    className="text-gray-700 font-medium hover:text-gray-900 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" style={{ color: practice.primary_color }} />
                    {practice.contact_email || 'info@drpolinaaesthetics.com'}
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Send us a Message</h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                    placeholder="+264 81 123 4567"
                  />
                </div>
                {locations.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Location</label>
                    <select
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all resize-none"
                  placeholder="Tell us how we can help you..."
                />
              </div>

              <div className="text-center">
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-xl text-white font-semibold transition-all duration-300 inline-flex items-center gap-2"
                  style={{ 
                    backgroundColor: isSubmitting ? '#9ca3af' : practice.primary_color,
                  }}
                  whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>

              {/* Success Message */}
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-50 border border-green-200 rounded-xl text-center"
                >
                  <MessageCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">Message sent successfully!</p>
                  <p className="text-green-600 text-sm">We'll get back to you soon.</p>
                </motion.div>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}