import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useBookingModal } from '@/contexts/BookingModalContext';

// Dynamically import GoogleMap to avoid SSR issues
const GoogleMap = dynamic(() => import('./GoogleMap'), { ssr: false });

interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: { day: string; time: string }[];
  coordinates: { lat: number; lng: number };
  mapImage: string;
}

const locations: Location[] = [
  {
    id: 'windhoek',
    name: 'Independence Avenue',
    address: '90000, 402 Independence Ave, Windhoek',
    phone: '+264 61 234 5678',
    hours: [
      { day: 'Monday - Friday', time: '8:00 AM - 6:00 PM' },
      { day: 'Saturday', time: '9:00 AM - 2:00 PM' },
      { day: 'Sunday', time: 'Closed' }
    ],
    coordinates: { lat: -22.556600, lng: 17.083646 },
    mapImage: ''
  },
  {
    id: 'otjomuise',
    name: 'Otjomuise Branch',
    address: 'Erf 157 Beijing Street, Otjomuise, Windhoek, Namibia',
    phone: '+264 61 234 5678',
    hours: [
      { day: 'Monday - Friday', time: '8:00 AM - 6:00 PM' },
      { day: 'Saturday', time: '9:00 AM - 2:00 PM' },
      { day: 'Sunday', time: 'Closed' }
    ],
    coordinates: { lat: -22.549500, lng: 17.028188 },
    mapImage: ''
  }
];

const LocationMap: React.FC = () => {
  const [activeLocation, setActiveLocation] = useState<Location>(locations[0]);
  const { openBookingModal } = useBookingModal();

  return (
    <section className="py-16 bg-gray-50 w-full">
      <div className="w-full">
        {/* Section Header */}
        <motion.div 
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center space-x-2 bg-[#32b9e5]/10 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:map-point-wave-bold-duotone" className="w-4 h-4 text-[#32b9e5]" />
            <span className="text-sm text-[#32b9e5] font-medium">Our Locations</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-lexend font-light text-gray-900 mb-4">
            Find Us
            <span className="text-[#32b9e5] font-normal"> Near You</span>
          </h2>
          <p className="text-base text-gray-600 leading-relaxed">
            Visit our modern facilities equipped with the latest dental technology
          </p>
        </motion.div>

        {/* Location Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => setActiveLocation(location)}
                className={`px-8 py-4 rounded-xl font-medium transition-all duration-300 ${
                  activeLocation.id === location.id
                    ? 'bg-[#32b9e5] text-white shadow-lg'
                    : 'bg-white text-gray-700 shadow-md hover:shadow-lg hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon 
                    icon="solar:map-point-bold-duotone" 
                    className={`w-5 h-5 ${
                      activeLocation.id === location.id ? 'text-white' : 'text-[#32b9e5]'
                    }`}
                  />
                  <span>{location.name}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Map and Details Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeLocation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-xl overflow-hidden"
            >
              <div className="grid lg:grid-cols-2">
                {/* Map Section */}
                <div className="relative h-[400px] lg:h-full">
                  <div className="absolute inset-4">
                    <GoogleMap
                      center={activeLocation.coordinates}
                      zoom={15}
                      height="100%"
                      locationName={activeLocation.name}
                      address={activeLocation.address}
                    />
                    
                    {/* Get Directions Button */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${activeLocation.coordinates.lat},${activeLocation.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-6 left-6 right-6 px-6 py-3 bg-[#32b9e5] text-white rounded-xl shadow-lg hover:bg-[#ec7ec5] transition-all duration-300 flex items-center justify-center space-x-2 font-medium"
                    >
                      <Icon icon="solar:route-bold-duotone" className="w-5 h-5" />
                      <span>Get Directions</span>
                      <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-8 lg:p-10 relative">
                  {/* Book Appointment Button - Top Right */}
                  <button
                    onClick={() => openBookingModal(activeLocation.name)}
                    className="absolute top-8 right-8 px-4 py-2 bg-[#32b9e5] text-white rounded-lg hover:bg-[#2aa8d3] transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    <Icon icon="solar:calendar-add-bold-duotone" className="w-4 h-4" />
                    <span>Book</span>
                  </button>

                  <h3 className="text-2xl font-semibold text-gray-900 mb-8 pr-24">{activeLocation.name}</h3>
                  
                  {/* Contact Information */}
                  <div className="space-y-6 mb-8">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-[#32b9e5]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon icon="solar:map-point-bold-duotone" className="w-6 h-6 text-[#32b9e5]" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Address</h4>
                        <p className="text-gray-600">{activeLocation.address}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-[#32b9e5]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon icon="solar:phone-calling-bold-duotone" className="w-6 h-6 text-[#32b9e5]" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Phone</h4>
                        <a 
                          href={`tel:${activeLocation.phone.replace(/\s/g, '')}`}
                          className="text-[#32b9e5] hover:text-[#ec7ec5] transition-colors font-medium"
                        >
                          {activeLocation.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Office Hours */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-[#32b9e5] mr-2" />
                      Office Hours
                    </h4>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      {activeLocation.hours.map((schedule, index) => (
                        <div key={index} className="flex justify-between py-1">
                          <span className="text-gray-600">{schedule.day}</span>
                          <span className="text-gray-900 font-medium">{schedule.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Facilities & Services</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {['Free Parking', 'Wheelchair Access', 'Emergency Care', 'Digital X-Ray'].map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-[#32b9e5]" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default LocationMap;