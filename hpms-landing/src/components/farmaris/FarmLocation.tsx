'use client';

import React from 'react';
import { MapPin, Navigation, Phone } from 'lucide-react';

function FarmLocation() {
  const farmCoordinates = "-19.195083, 18.311083"; // 19°11'42.3"S 18°18'39.9"E
  const googleMapsUrl = `https://www.google.com/maps?q=${farmCoordinates}`;
  const wazeUrl = `https://waze.com/ul?ll=${farmCoordinates}&navigate=yes`;

  return (
    <section id="location" className="py-16 bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-amber-800 mb-4">Find Us</h2>
          <p className="text-lg text-gray-700">
            Farm Aris is located in the heart of Grootfontein, Namibia
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Map Embed */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <iframe
              src={`https://maps.google.com/maps?q=${farmCoordinates}&z=15&output=embed`}
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Farm Aris Location"
              className="w-full h-96"
            />
            
            <div className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <MapPin className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-gray-800">GPS Coordinates:</span>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                19°11'42.3"S 18°18'39.9"E<br />
                Farm Aris, Grootfontein, Namibia
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Google Maps</span>
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Waze</span>
                </a>
              </div>
            </div>
          </div>

          {/* Directions and Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-green-800 mb-6">Getting There</h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">From Grootfontein Town</h4>
                    <p className="text-gray-600 text-sm">
                      Head north on the B8 highway for 15km, then turn right at the Farm Aris sign. 
                      Follow the farm road for 3km until you reach the main gate.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-yellow-100 p-2 rounded-full">
                    <Phone className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Need Directions?</h4>
                    <p className="text-gray-600 text-sm mb-2">
                      Call us if you get lost - we're happy to guide you!
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm text-green-600">Onesmus: +264 81 129 9623</p>
                      <p className="text-sm text-green-600">Maano: +264 81 294 5818</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-green-800 mb-4">Important Notes</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  <span className="text-sm">Parking available on-site - follow the signs</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  <span className="text-sm">Camping facilities available for overnight guests</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  <span className="text-sm">Bring safari-style clothing and comfortable walking shoes</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  <span className="text-sm">Please RSVP by September 15th for catering purposes</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FarmLocation;