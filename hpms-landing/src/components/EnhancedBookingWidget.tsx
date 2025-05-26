'use client';

import { useState, useEffect } from 'react';
import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import ReCAPTCHA from "react-google-recaptcha";
import ModernCalendar from './ModernCalendar';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CheckCircle,
  ArrowRight,
  Mail,
  MapPin,
  DollarSign,
  Sparkles,
  AlertCircle,
  ChevronLeft
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { SubService, ServiceCategory } from '@/data/dr-polina-services';

interface EnhancedBookingWidgetProps {
  practice: Practice;
  preSelectedService?: SubService;
  preSelectedCategory?: ServiceCategory;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EnhancedBookingWidget({ 
  practice, 
  preSelectedService,
  preSelectedCategory 
}: EnhancedBookingWidgetProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    service: preSelectedService?.name || '',
    serviceId: preSelectedService?.id || '',
    categoryId: preSelectedCategory?.id || '',
    price: preSelectedService?.price || '',
    duration: preSelectedService?.duration || '',
    location: 'windhoek', // Default to Windhoek
    notes: '',
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const locations = [
    {
      id: 'windhoek',
      name: 'Windhoek Clinic',
      address: 'Feld Street 4, Ausspannplatz',
      description: 'Close to Maerua Mall'
    },
    {
      id: 'oshikango',
      name: 'Oshikango Clinic',
      address: 'Freedom Square, Shop B3-first floor',
      description: 'Opposite Standard Bank'
    }
  ];

  // Generate time slots based on business hours
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      // Skip lunch hour (12-1 PM)
      if (hour === 12) continue;
      
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    return slots;
  };

  // Check available slots from database
  const checkAvailableSlots = async (date: string) => {
    setIsLoadingSlots(true);
    try {
      // For now, show all time slots since we can't query appointments without auth
      // In production, this could be handled by another Edge Function
      const allSlots = generateTimeSlots();
      setAvailableSlots(allSlots);
    } catch (error) {
      console.error('Error checking slots:', error);
      setAvailableSlots(generateTimeSlots()); // Show all slots on error
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (formData.date) {
      checkAvailableSlots(formData.date);
    }
  }, [formData.date]);

  useEffect(() => {
    if (preSelectedService) {
      setFormData(prev => ({
        ...prev,
        service: preSelectedService.name,
        serviceId: preSelectedService.id,
        categoryId: preSelectedCategory?.id || '',
        price: preSelectedService.price,
        duration: preSelectedService.duration
      }));
    }
  }, [preSelectedService, preSelectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Always use Edge Function (it's been fixed)
      console.log('Submitting booking via Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('submit-booking', {
        body: {
          formData,
          practiceSlug: practice.slug,
          captchaToken: captchaToken || 'test-token'
        }
      });

      console.log('Edge Function response:', { data, error });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Booking failed');

      setIsSuccess(true);
      setCurrentStep(4); // Success step
    } catch (error: any) {
      console.error('Booking error:', error);
      
      // Show user-friendly error message
      let errorMessage = 'There was an error booking your appointment. Please try again.';
      
      // Try to get more details from the error
      if (error.context) {
        try {
          const errorText = await error.context.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          console.error('Edge Function Error Details:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    { number: 1, title: 'Service & Location' },
    { number: 2, title: 'Date & Time' },
    { number: 3, title: 'Your Information' }
  ];

  return (
    <section id="booking" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span 
            className="inline-block px-4 py-2 rounded-full text-white text-sm font-semibold mb-4"
            style={{ backgroundColor: practice.primary_color }}
          >
            Book Appointment
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Schedule Your Visit
          </h2>
          <p className="text-xl text-gray-600">
            Book your appointment in just a few simple steps
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Progress Bar */}
          {!isSuccess && (
            <div className="px-8 pt-8">
              <div className="flex items-center justify-between mb-8">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center">
                    <div className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                          currentStep >= step.number
                            ? 'text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                        style={{
                          backgroundColor: currentStep >= step.number ? practice.primary_color : undefined
                        }}
                      >
                        {currentStep > step.number ? <CheckCircle className="w-5 h-5" /> : step.number}
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`h-1 w-24 mx-2 transition-all ${
                            currentStep > step.number ? '' : 'bg-gray-200'
                          }`}
                          style={{
                            backgroundColor: currentStep > step.number ? practice.primary_color : undefined
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm mb-6">
                {steps.map((step) => (
                  <span
                    key={step.number}
                    className={`${
                      currentStep === step.number ? 'text-gray-900 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-8 pb-8">
            <AnimatePresence mode="wait">
              {/* Step 1: Service & Location */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Select Service & Location</h3>
                    
                    {/* Service Display */}
                    {formData.service && (
                      <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{formData.service}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formData.duration}
                              </span>
                              <span className="flex items-center gap-1 font-semibold" style={{ color: practice.primary_color }}>
                                <DollarSign className="w-4 h-4" />
                                {formData.price}
                              </span>
                            </div>
                          </div>
                          {!preSelectedService && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, service: '', serviceId: '', price: '', duration: '' })}
                              className="text-sm text-purple-600 hover:text-purple-700"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Location Selection */}
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <MapPin className="inline w-4 h-4 mr-1" />
                      Select Clinic Location
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {locations.map((location) => (
                        <motion.div
                          key={location.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData({ ...formData, location: location.id })}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.location === location.id
                              ? 'border-current bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{
                            borderColor: formData.location === location.id ? practice.primary_color : undefined
                          }}
                        >
                          <h4 className="font-semibold text-gray-900">{location.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{location.address}</p>
                          <p className="text-xs text-gray-500 mt-1">{location.description}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <motion.button
                      type="button"
                      onClick={nextStep}
                      className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2"
                      style={{ backgroundColor: practice.primary_color }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Date & Time */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Choose Date & Time</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-4">
                        <Calendar className="inline w-4 h-4 mr-1" />
                        Preferred Date
                      </label>
                      <ModernCalendar
                        selectedDate={formData.date}
                        onDateSelect={(date) => setFormData({ ...formData, date })}
                        primaryColor={practice.primary_color}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="inline w-4 h-4 mr-1" />
                        Preferred Time
                      </label>
                      {isLoadingSlots ? (
                        <div className="text-center py-8">
                          <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-sm text-gray-600 mt-2">Checking availability...</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                          {availableSlots.map((slot) => (
                            <motion.button
                              key={slot}
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setFormData({ ...formData, time: slot })}
                              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                formData.time === slot
                                  ? 'text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={{
                                backgroundColor: formData.time === slot ? practice.primary_color : undefined
                              }}
                            >
                              {slot}
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {availableSlots.length === 0 && !isLoadingSlots && formData.date && (
                        <p className="text-sm text-red-600 mt-2">
                          <AlertCircle className="inline w-4 h-4 mr-1" />
                          No available slots for this date. Please select another date.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <motion.button
                      type="button"
                      onClick={prevStep}
                      className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold flex items-center gap-2 hover:bg-gray-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={nextStep}
                      disabled={!formData.date || !formData.time}
                      className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: practice.primary_color }}
                      whileHover={{ scale: formData.date && formData.time ? 1.05 : 1 }}
                      whileTap={{ scale: formData.date && formData.time ? 0.95 : 1 }}
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Personal Information */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
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
                        placeholder="John Doe"
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
                          placeholder="john@example.com"
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
                          placeholder="+264 81 123 4567"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-all resize-none"
                        placeholder="Any special requirements or concerns..."
                      />
                    </div>
                  </div>

                  {/* Booking Summary */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Booking Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Service:</span>
                        <span className="font-medium">{formData.service}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-medium">
                          {locations.find(l => l.id === formData.location)?.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date & Time:</span>
                        <span className="font-medium">
                          {new Date(formData.date).toLocaleDateString()} at {formData.time}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-600">Price:</span>
                        <span className="font-semibold" style={{ color: practice.primary_color }}>
                          {formData.price}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CAPTCHA */}
                  <div className="mt-6 flex justify-center">
                    <ReCAPTCHA
                      sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"} // Test key for development
                      onChange={setCaptchaToken}
                      theme="light"
                    />
                  </div>

                  <div className="flex justify-between">
                    <motion.button
                      type="button"
                      onClick={prevStep}
                      className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold flex items-center gap-2 hover:bg-gray-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: practice.primary_color }}
                      whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                      whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Booking...
                        </>
                      ) : (
                        <>
                          Confirm Booking
                          <CheckCircle className="w-5 h-5" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Success Step */}
              {isSuccess && currentStep === 4 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${practice.primary_color}20` }}
                  >
                    <CheckCircle className="w-10 h-10" style={{ color: practice.primary_color }} />
                  </motion.div>
                  
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h3>
                  <p className="text-lg text-gray-600 mb-8">
                    We've sent a confirmation email to {formData.email}
                  </p>
                  
                  <div className="bg-gray-50 rounded-xl p-6 text-left max-w-md mx-auto">
                    <h4 className="font-semibold text-gray-900 mb-4">Appointment Details</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 mt-0.5" style={{ color: practice.primary_color }} />
                        <div>
                          <p className="font-medium text-gray-900">{formData.service}</p>
                          <p className="text-sm text-gray-600">{formData.duration} • {formData.price}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 mt-0.5" style={{ color: practice.primary_color }} />
                        <div>
                          <p className="font-medium text-gray-900">
                            {locations.find(l => l.id === formData.location)?.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {locations.find(l => l.id === formData.location)?.address}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 mt-0.5" style={{ color: practice.primary_color }} />
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(formData.date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                          <p className="text-sm text-gray-600">at {formData.time}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mt-6">
                    A member of our team will contact you shortly to confirm your appointment.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
      </div>
    </section>
  );
}