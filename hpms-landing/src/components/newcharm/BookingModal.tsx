import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  const locations = [
    {
      id: 'windhoek',
      name: 'Windhoek Clinic',
      address: 'Feld Street 4, Ausspannplatz',
      description: 'Close to Maerua Mall',
      icon: '🏥'
    },
    {
      id: 'oshikango',
      name: 'Oshikango Clinic',
      address: 'Freedom Square, Shop B3-first floor',
      description: 'Opposite Standard Bank',
      icon: '🏥'
    }
  ];

  const services = [
    { id: 'cleaning', name: 'Teeth Cleaning', icon: '🦷' },
    { id: 'whitening', name: 'Teeth Whitening', icon: '✨' },
    { id: 'implants', name: 'Dental Implants', icon: '🔧' },
    { id: 'orthodontics', name: 'Orthodontics', icon: '😁' },
    { id: 'emergency', name: 'Emergency Care', icon: '🚨' },
    { id: 'checkup', name: 'General Checkup', icon: '🔍' }
  ];

  const timeSlots = [
    '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
    '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'
  ];

  const handleContinue = () => {
    if (step === 1 && selectedLocation && selectedService) {
      setStep(2);
    } else if (step === 2 && selectedDate && selectedTime) {
      setStep(3);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Booking submitted:', {
      location: selectedLocation,
      service: selectedService,
      date: selectedDate,
      time: selectedTime,
      ...formData
    });
    // Reset and close
    onClose();
    setStep(1);
    setSelectedLocation('');
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setFormData({ name: '', email: '', phone: '', notes: '' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#32b9e5] to-[#2aa8d3] p-6 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Book Your Appointment</h2>
                    <p className="text-white/80">Complete your booking in 3 easy steps</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon="solar:close-bold" className="w-6 h-6" />
                  </button>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-center mt-6 space-x-4">
                  <div className={`flex items-center ${step >= 1 ? 'text-white' : 'text-white/50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      step >= 1 ? 'bg-white text-[#32b9e5]' : 'bg-white/20'
                    }`}>
                      1
                    </div>
                    <span className="ml-2 text-sm hidden sm:inline">Service & Location</span>
                  </div>
                  <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
                  <div className={`flex items-center ${step >= 2 ? 'text-white' : 'text-white/50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      step >= 2 ? 'bg-white text-[#32b9e5]' : 'bg-white/20'
                    }`}>
                      2
                    </div>
                    <span className="ml-2 text-sm hidden sm:inline">Date & Time</span>
                  </div>
                  <div className={`w-12 h-0.5 ${step >= 3 ? 'bg-white' : 'bg-white/30'}`} />
                  <div className={`flex items-center ${step >= 3 ? 'text-white' : 'text-white/50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      step >= 3 ? 'bg-white text-[#32b9e5]' : 'bg-white/20'
                    }`}>
                      3
                    </div>
                    <span className="ml-2 text-sm hidden sm:inline">Your Information</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Step 1: Service & Location */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Select Service</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {services.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => setSelectedService(service.id)}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              selectedService === service.id
                                ? 'border-[#32b9e5] bg-[#32b9e5]/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-2xl mb-2">{service.icon}</div>
                            <div className="text-sm font-medium">{service.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Select Clinic Location</h3>
                      <div className="space-y-3">
                        {locations.map((location) => (
                          <button
                            key={location.id}
                            onClick={() => setSelectedLocation(location.id)}
                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                              selectedLocation === location.id
                                ? 'border-[#32b9e5] bg-[#32b9e5]/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <span className="text-2xl">{location.icon}</span>
                              <div>
                                <h4 className="font-semibold">{location.name}</h4>
                                <p className="text-sm text-gray-600">{location.address}</p>
                                <p className="text-xs text-gray-500 mt-1">{location.description}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Date & Time */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Select Date</h3>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                      />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Select Time</h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {timeSlots.map((time) => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              selectedTime === time
                                ? 'border-[#32b9e5] bg-[#32b9e5]/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Your Information */}
                {step === 3 && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Additional Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#32b9e5] focus:outline-none resize-none"
                        placeholder="Any special requirements or concerns..."
                      />
                    </div>
                  </form>
                )}
              </div>

              {/* Footer */}
              <div className="border-t p-6 bg-gray-50">
                <div className="flex justify-between items-center">
                  {step > 1 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      ← Back
                    </button>
                  )}
                  <div className="ml-auto">
                    {step < 3 ? (
                      <button
                        onClick={handleContinue}
                        disabled={
                          (step === 1 && (!selectedLocation || !selectedService)) ||
                          (step === 2 && (!selectedDate || !selectedTime))
                        }
                        className="px-8 py-3 bg-[#32b9e5] text-white rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2aa8d3] transition-colors"
                      >
                        Continue →
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        className="px-8 py-3 bg-[#32b9e5] text-white rounded-full font-semibold hover:bg-[#2aa8d3] transition-colors"
                      >
                        Confirm Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BookingModal;