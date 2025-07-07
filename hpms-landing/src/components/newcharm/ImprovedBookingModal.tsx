import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBookingModal } from '@/contexts/BookingModalContext';
import Image from 'next/image';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImprovedBookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose }) => {
  const { selectedLocation: preSelectedLocation, selectedService: preSelectedService } = useBookingModal();
  const [step, setStep] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [hasMedicalAid, setHasMedicalAid] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    medicalAidScheme: '',
    medicalAidNumber: '',
    notes: ''
  });

  // Initialize with pre-selected values
  useEffect(() => {
    if (preSelectedLocation) {
      setSelectedLocation(preSelectedLocation);
    }
    if (preSelectedService) {
      setSelectedService(preSelectedService);
    }
  }, [preSelectedLocation, preSelectedService]);

  const locations = [
    {
      id: 'Independence Avenue',
      name: 'Independence Avenue',
      address: '90000, 402 Independence Ave, Windhoek',
      description: 'Main clinic in city center',
      icon: '🏥',
      hours: 'Mon-Fri: 8AM-6PM, Sat: 9AM-2PM'
    },
    {
      id: 'Otjomuise Branch',
      name: 'Otjomuise Branch',
      address: 'Erf 157 Beijing Street, Otjomuise, Windhoek',
      description: 'Convenient neighborhood location',
      icon: '🏥',
      hours: 'Mon-Fri: 8AM-6PM, Sat: 9AM-2PM'
    }
  ];

  const services = [
    { 
      id: 'cleaning', 
      name: 'Teeth Cleaning', 
      icon: 'solar:tooth-bold-duotone',
      image: 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-074156.png',
      duration: '45 min',
      price: 'N$350'
    },
    { 
      id: 'whitening', 
      name: 'Teeth Whitening', 
      icon: 'solar:star-shine-bold-duotone',
      image: 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-074718.png',
      duration: '90 min',
      price: 'N$2,800'
    },
    { 
      id: 'implants', 
      name: 'Dental Implants', 
      icon: 'solar:medical-kit-bold-duotone',
      image: 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-074514.png',
      duration: '2-3 visits',
      price: 'From N$12,000'
    },
    { 
      id: 'orthodontics', 
      name: 'Orthodontics', 
      icon: 'solar:smile-circle-bold-duotone',
      image: 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-074844.png',
      duration: '12-24 months',
      price: 'From N$18,000'
    },
    { 
      id: 'emergency', 
      name: 'Emergency Care', 
      icon: 'solar:shield-warning-bold-duotone',
      image: 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-074402.png',
      duration: 'Immediate',
      price: 'From N$550'
    },
    { 
      id: 'checkup', 
      name: 'General Checkup', 
      icon: 'solar:health-bold-duotone',
      image: 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/screenshot-2025-07-07-074442.png',
      duration: '60 min',
      price: 'N$450'
    }
  ];

  const timeSlots = [
    '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
    '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'
  ];

  // Remove the unused generateDates function since we're using date input now

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
      hasMedicalAid,
      ...formData
    });
    // Reset and close
    onClose();
    setStep(1);
    setSelectedLocation('');
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setHasMedicalAid(null);
    setFormData({ name: '', email: '', phone: '', gender: '', medicalAidScheme: '', medicalAidNumber: '', notes: '' });
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header - Fixed */}
              <div className="bg-gradient-to-r from-[#32b9e5] to-[#2aa8d3] p-8 text-white relative flex-shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold mb-3">Book Your Appointment</h2>
                    <p className="text-white/90 text-lg">Complete your booking in 3 easy steps</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 group border border-white/20"
                  >
                    <Icon icon="solar:close-bold" className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </div>

                  {/* Steps Indicator */}
                  <div className="flex items-center justify-center mt-8 space-x-6">
                    {[
                      { num: 1, label: 'Service & Location', icon: 'solar:map-point-bold-duotone' },
                      { num: 2, label: 'Date & Time', icon: 'solar:calendar-bold-duotone' },
                      { num: 3, label: 'Your Information', icon: 'solar:user-bold-duotone' }
                    ].map((s, idx) => (
                      <React.Fragment key={s.num}>
                        <motion.div 
                          className={`flex items-center ${step >= s.num ? 'text-white' : 'text-white/50'}`}
                          whileHover={{ scale: 1.05 }}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${
                            step >= s.num ? 'bg-white text-[#32b9e5] shadow-lg' : 'bg-white/20'
                          }`}>
                            {step > s.num ? (
                              <Icon icon="solar:check-circle-bold" className="w-6 h-6" />
                            ) : (
                              s.num
                            )}
                          </div>
                          <span className="ml-3 text-sm font-medium hidden sm:inline">{s.label}</span>
                        </motion.div>
                        {idx < 2 && (
                          <div className={`w-16 h-1 rounded-full transition-all duration-300 ${
                            step > s.num ? 'bg-white' : 'bg-white/30'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
              </div>

              {/* Content - Scrollable */}
              <div 
                className="flex-1 overflow-y-auto overscroll-contain scroll-smooth scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollBehavior: 'smooth',
                  msOverflowStyle: 'auto',
                  scrollbarWidth: 'thin'
                }}
              >
                <div className="p-8">
                {/* Step 1: Service & Location */}
                {step === 1 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-900">Select Service</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {services.map((service) => (
                          <motion.button
                            key={service.id}
                            onClick={() => setSelectedService(service.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                              selectedService === service.id
                                ? 'ring-4 ring-[#32b9e5] shadow-xl'
                                : 'hover:shadow-lg'
                            }`}
                          >
                            <div className="relative h-40 w-full">
                              <Image
                                src={service.image}
                                alt={service.name}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                              {selectedService === service.id && (
                                <div className="absolute top-3 right-3 bg-[#32b9e5] text-white p-2 rounded-full">
                                  <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon icon={service.icon} className="w-5 h-5" />
                                <h4 className="font-semibold text-left">{service.name}</h4>
                              </div>
                              <div className="flex justify-between text-xs text-white/80">
                                <span>{service.duration}</span>
                                <span>{service.price}</span>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-2xl font-semibold mb-6 text-gray-900">Select Clinic Location</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locations.map((location) => (
                          <motion.button
                            key={location.id}
                            onClick={() => setSelectedLocation(location.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${
                              selectedLocation === location.id
                                ? 'border-[#32b9e5] bg-[#32b9e5]/5 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-start space-x-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                                selectedLocation === location.id ? 'bg-[#32b9e5]/20' : 'bg-gray-100'
                              }`}>
                                <Icon icon="solar:hospital-bold-duotone" className="w-6 h-6 text-[#32b9e5]" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg mb-1">{location.name}</h4>
                                <p className="text-sm text-gray-600 mb-2">{location.address}</p>
                                <p className="text-xs text-gray-500">{location.description}</p>
                                <p className="text-xs text-[#32b9e5] mt-2 font-medium">{location.hours}</p>
                              </div>
                              {selectedLocation === location.id && (
                                <Icon icon="solar:check-circle-bold" className="w-6 h-6 text-[#32b9e5]" />
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Date & Time */}
                {step === 2 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <h3 className="text-2xl font-semibold text-gray-900">Select Date & Time</h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Date Selection */}
                      <div>
                        <h4 className="text-lg font-medium mb-4 text-gray-700">Choose Date</h4>
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                          {/* Month/Year Selector */}
                          <div className="flex items-center justify-between mb-4">
                            <select
                              value={`${selectedDate ? new Date(selectedDate).getMonth() : new Date().getMonth()}`}
                              onChange={(e) => {
                                const month = parseInt(e.target.value);
                                const year = selectedDate ? new Date(selectedDate).getFullYear() : new Date().getFullYear();
                                const newDate = new Date(year, month, 1);
                                setSelectedDate(newDate.toISOString().split('T')[0]);
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                            >
                              {['January', 'February', 'March', 'April', 'May', 'June', 
                                'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                                <option key={month} value={idx}>{month}</option>
                              ))}
                            </select>
                            <select
                              value={`${selectedDate ? new Date(selectedDate).getFullYear() : new Date().getFullYear()}`}
                              onChange={(e) => {
                                const year = parseInt(e.target.value);
                                const month = selectedDate ? new Date(selectedDate).getMonth() : new Date().getMonth();
                                const newDate = new Date(year, month, 1);
                                setSelectedDate(newDate.toISOString().split('T')[0]);
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                            >
                              {[2025, 2026, 2027].map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Date Input */}
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#32b9e5] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Time Selection */}
                      <div>
                        <h4 className="text-lg font-medium mb-4 text-gray-700">Choose Time</h4>
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                          <div className="grid grid-cols-2 gap-2">
                            {timeSlots.map((time) => {
                              const isLunch = time === '12:00 PM' || time === '12:30 PM' || time === '1:00 PM' || time === '1:30 PM';
                              return (
                                <button
                                  key={time}
                                  onClick={() => setSelectedTime(time)}
                                  disabled={isLunch}
                                  className={`p-3 rounded-lg font-medium transition-all duration-300 ${
                                    selectedTime === time
                                      ? 'bg-[#32b9e5] text-white shadow-md'
                                      : isLunch
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {time}
                                  {isLunch && <span className="block text-xs">Lunch</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Your Information */}
                {step === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none transition-colors"
                            placeholder="John Doe"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Gender <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none transition-colors"
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer-not-to-say">Prefer not to say</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none transition-colors"
                            placeholder="+264 61 234 5678"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email <span className="text-gray-400">(Optional)</span>
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none transition-colors"
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      {/* Medical Aid Section */}
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h4 className="font-semibold text-lg mb-4">Medical Aid Information</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Do you have medical aid cover?
                            </label>
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => setHasMedicalAid(true)}
                                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                                  hasMedicalAid === true
                                    ? 'bg-[#32b9e5] text-white'
                                    : 'bg-white text-gray-700 border-2 border-gray-200'
                                }`}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setHasMedicalAid(false)}
                                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                                  hasMedicalAid === false
                                    ? 'bg-[#32b9e5] text-white'
                                    : 'bg-white text-gray-700 border-2 border-gray-200'
                                }`}
                              >
                                No
                              </button>
                            </div>
                          </div>

                          {hasMedicalAid === true && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
                            >
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Medical Aid Scheme <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required={hasMedicalAid === true}
                                  value={formData.medicalAidScheme}
                                  onChange={(e) => setFormData({ ...formData, medicalAidScheme: e.target.value })}
                                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none transition-colors"
                                  placeholder="e.g., Discovery Health"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Medical Aid Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required={hasMedicalAid === true}
                                  value={formData.medicalAidNumber}
                                  onChange={(e) => setFormData({ ...formData, medicalAidNumber: e.target.value })}
                                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none transition-colors"
                                  placeholder="123456789"
                                />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Additional Notes <span className="text-gray-400">(Optional)</span>
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                          className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#32b9e5] focus:outline-none resize-none transition-colors"
                          placeholder="Any special requirements or concerns..."
                        />
                      </div>
                    </form>
                  </motion.div>
                )}
                </div>
              </div>

              {/* Footer - Fixed */}
              <div className="border-t bg-gray-50 p-6 flex-shrink-0">
                <div className="flex justify-between items-center">
                  {step > 1 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                    >
                      <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
                      Back
                    </button>
                  )}
                  <div className="ml-auto flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors border border-gray-300"
                    >
                      Cancel
                    </button>
                    {step < 3 ? (
                      <button
                        onClick={handleContinue}
                        disabled={
                          (step === 1 && (!selectedLocation || !selectedService)) ||
                          (step === 2 && (!selectedDate || !selectedTime))
                        }
                        className="flex items-center gap-2 px-8 py-3 bg-[#32b9e5] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2aa8d3] transition-colors"
                      >
                        Continue
                        <Icon icon="solar:arrow-right-linear" className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-8 py-3 bg-[#32b9e5] text-white rounded-lg font-semibold hover:bg-[#2aa8d3] transition-colors"
                      >
                        <Icon icon="solar:calendar-check-bold-duotone" className="w-5 h-5" />
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

export default ImprovedBookingModal;