'use client';

import { useState } from 'react';
import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MessageSquare, 
  CheckCircle,
  Stethoscope,
  Heart,
  Brain,
  Baby,
  ArrowRight,
  Mail,
  AlertCircle
} from 'lucide-react';

interface BookingWidgetProps {
  practice: Practice;
}

export default function BookingWidget({ practice }: BookingWidgetProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    service: '',
    reason: '',
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const services = [
    { id: 'consultation', name: 'General Consultation', icon: Stethoscope },
    { id: 'checkup', name: 'Health Checkup', icon: Heart },
    { id: 'specialist', name: 'Specialist Visit', icon: Brain },
    { id: 'pediatric', name: 'Pediatric Care', icon: Baby },
  ];

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsSuccess(true);
    
    // Reset after showing success
    setTimeout(() => {
      setIsSuccess(false);
      setCurrentStep(1);
      setFormData({
        name: '',
        email: '',
        phone: '',
        date: '',
        time: '',
        service: '',
        reason: '',
      });
    }, 3000);
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <section id="booking" className="py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-20 blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-green-100 to-blue-100 rounded-full opacity-20 blur-3xl transform translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span 
            className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4"
            style={{ 
              backgroundColor: practice.primary_color + '20',
              color: practice.primary_color 
            }}
          >
            Book Appointment
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Schedule Your Visit
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Book your appointment in just a few clicks. Our team will confirm your booking within 30 minutes.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Progress bar */}
            <div className="bg-gray-50 px-8 py-4">
              <div className="flex items-center justify-between">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <motion.div
                      animate={{
                        backgroundColor: currentStep >= step ? practice.primary_color : '#e5e7eb',
                        scale: currentStep === step ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                    >
                      {currentStep > step ? <CheckCircle className="w-6 h-6" /> : step}
                    </motion.div>
                    {step < 3 && (
                      <div 
                        className="w-24 md:w-32 h-1 mx-2"
                        style={{
                          backgroundColor: currentStep > step ? practice.primary_color : '#e5e7eb'
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-600">Service</span>
                <span className="text-sm text-gray-600">Details</span>
                <span className="text-sm text-gray-600">Confirm</span>
              </div>
            </div>

            {/* Form content */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-center py-16"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                      className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                      <CheckCircle className="w-12 h-12 text-green-600" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h3>
                    <p className="text-gray-600">We'll send you a confirmation email shortly.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {/* Step 1: Service Selection */}
                    {currentStep === 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">Choose a Service</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                          {services.map((service) => {
                            const Icon = service.icon;
                            const isSelected = formData.service === service.id;
                            
                            return (
                              <motion.button
                                key={service.id}
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setFormData({ ...formData, service: service.id })}
                                className={`
                                  p-6 rounded-2xl border-2 transition-all duration-200
                                  ${isSelected 
                                    ? 'border-transparent shadow-lg' 
                                    : 'border-gray-200 hover:border-gray-300'
                                  }
                                `}
                                style={isSelected ? {
                                  borderColor: practice.primary_color,
                                  backgroundColor: practice.primary_color + '10'
                                } : {}}
                              >
                                <Icon 
                                  className="w-8 h-8 mb-3 mx-auto"
                                  style={{ color: isSelected ? practice.primary_color : '#6b7280' }}
                                />
                                <p className={`font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {service.name}
                                </p>
                              </motion.button>
                            );
                          })}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Brief reason for visit (optional)
                          </label>
                          <textarea
                            rows={3}
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                            style={{ '--tw-ring-color': practice.primary_color } as React.CSSProperties}
                            placeholder="Tell us briefly about your symptoms or concerns..."
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Personal Details */}
                    {currentStep === 2 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">Your Information</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <User className="inline w-4 h-4 mr-1" />
                              Full Name
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                              style={{ '--tw-ring-color': practice.primary_color } as React.CSSProperties}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Mail className="inline w-4 h-4 mr-1" />
                                Email
                              </label>
                              <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                                style={{ '--tw-ring-color': practice.primary_color } as React.CSSProperties}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Phone className="inline w-4 h-4 mr-1" />
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                                style={{ '--tw-ring-color': practice.primary_color } as React.CSSProperties}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="inline w-4 h-4 mr-1" />
                                Preferred Date
                              </label>
                              <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                                style={{ '--tw-ring-color': practice.primary_color } as React.CSSProperties}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Clock className="inline w-4 h-4 mr-1" />
                                Preferred Time
                              </label>
                              <select
                                required
                                value={formData.time}
                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all"
                                style={{ '--tw-ring-color': practice.primary_color } as React.CSSProperties}
                              >
                                <option value="">Select time</option>
                                {timeSlots.map((slot) => (
                                  <option key={slot} value={slot}>{slot}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Confirmation */}
                    {currentStep === 3 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">Confirm Your Appointment</h3>
                        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                          <h4 className="font-semibold text-gray-900 mb-4">Appointment Details</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Service:</span>
                              <span className="font-medium">
                                {services.find(s => s.id === formData.service)?.name}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Date:</span>
                              <span className="font-medium">{formData.date}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Time:</span>
                              <span className="font-medium">{formData.time}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Patient:</span>
                              <span className="font-medium">{formData.name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-blue-800">
                              Please arrive 15 minutes before your appointment time for registration.
                              Bring your ID and medical aid card if applicable.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex justify-between mt-8">
                      {currentStep > 1 && (
                        <button
                          type="button"
                          onClick={prevStep}
                          className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                        >
                          Back
                        </button>
                      )}
                      
                      <div className="ml-auto">
                        {currentStep < 3 ? (
                          <button
                            type="button"
                            onClick={nextStep}
                            disabled={
                              (currentStep === 1 && !formData.service) ||
                              (currentStep === 2 && (!formData.name || !formData.email || !formData.phone || !formData.date || !formData.time))
                            }
                            className="px-8 py-3 font-semibold rounded-full flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            style={{ 
                              backgroundColor: practice.primary_color,
                              color: 'white'
                            }}
                          >
                            Continue
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        ) : (
                          <motion.button
                            type="submit"
                            disabled={isSubmitting}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-8 py-3 font-semibold rounded-full flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            style={{ 
                              backgroundColor: practice.primary_color,
                              color: 'white'
                            }}
                          >
                            {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                            {!isSubmitting && <CheckCircle className="w-5 h-5" />}
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Free Cancellation</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>Quick Confirmation</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              <span>24/7 Support</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}