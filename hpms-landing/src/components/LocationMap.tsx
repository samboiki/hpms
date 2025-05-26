'use client';

import { useEffect, useRef } from 'react';
import { Practice } from '@/lib/tenants';
import { MapPin, Phone, Clock, Mail } from 'lucide-react';

interface LocationMapProps {
  practice: Practice;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export default function LocationMap({ practice }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const locations = [
    {
      id: 'windhoek',
      name: 'Windhoek Clinic',
      address: 'Feld Street 4, Ausspannplatz',
      city: 'Windhoek, Namibia',
      coords: { lat: -22.579147480398618, lng: 17.089405932402055 },
      phone: practice.contact_phone,
      hours: 'Mon-Fri: 9:00 AM - 6:00 PM',
      description: 'Our main clinic near Maerua Mall'
    },
    {
      id: 'oshikango',
      name: 'Oshikango Clinic',
      address: 'Freedom Square, Shop B3-first floor',
      city: 'Oshikango, Namibia',
      coords: { lat: -17.4, lng: 15.88 }, // Approximate coordinates for Oshikango
      phone: practice.contact_phone,
      hours: 'Mon-Fri: 9:00 AM - 6:00 PM',
      description: 'Opposite Standard Bank'
    }
  ];

  useEffect(() => {
    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCFCbp4Oz9D1DflDpl11xIfp7gey9bi_bA&callback=initMap`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      window.initMap = initializeMap;
    } else {
      initializeMap();
    }

    function initializeMap() {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Create map centered between the two locations
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 7,
        center: { lat: -20, lng: 16.5 }, // Center of Namibia
        styles: [
          {
            featureType: "all",
            elementType: "geometry",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#e9e9e9" }]
          },
          {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9e9e9e" }]
          }
        ],
        mapTypeControl: false,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true
      });

      mapInstanceRef.current = map;

      // Add markers for each location
      locations.forEach((location) => {
        const marker = new window.google.maps.Marker({
          position: location.coords,
          map: map,
          title: location.name,
          icon: {
            url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%2301b9d4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'%3E%3C/path%3E%3Ccircle cx='12' cy='10' r='3'%3E%3C/circle%3E%3C/svg%3E",
            scaledSize: new window.google.maps.Size(40, 40)
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; min-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 8px; color: #1a1a1a;">${location.name}</h3>
              <p style="margin: 4px 0; color: #666;">${location.address}</p>
              <p style="margin: 4px 0; color: #666;">${location.city}</p>
              <p style="margin: 8px 0 4px 0; font-weight: 500; color: #01b9d4;">${location.hours}</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      });

      // Fit bounds to show all markers
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(location => {
        bounds.extend(location.coords);
      });
      map.fitBounds(bounds);
    }

    return () => {
      // Cleanup
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [practice]);

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span 
            className="inline-block px-4 py-2 rounded-full text-white text-sm font-semibold mb-4"
            style={{ backgroundColor: practice.primary_color }}
          >
            Visit Us
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Our Clinic Locations
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Conveniently located in Windhoek and Oshikango to serve you better
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map */}
          <div className="lg:col-span-2">
            <div 
              ref={mapRef} 
              className="w-full h-[500px] rounded-2xl shadow-xl overflow-hidden"
              style={{ backgroundColor: '#f0f0f0' }}
            />
          </div>

          {/* Location Cards */}
          <div className="space-y-6">
            {locations.map((location) => (
              <div 
                key={location.id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: practice.primary_color }} />
                  {location.name}
                </h3>
                
                <div className="space-y-3 text-gray-600">
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: practice.primary_color }} />
                    <span>
                      {location.address}<br />
                      {location.city}
                    </span>
                  </p>
                  
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4" style={{ color: practice.primary_color }} />
                    <a 
                      href={`tel:${location.phone}`}
                      className="hover:underline"
                      style={{ color: practice.primary_color }}
                    >
                      {location.phone}
                    </a>
                  </p>
                  
                  <p className="flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: practice.primary_color }} />
                    {location.hours}
                  </p>
                  
                  <p className="text-sm italic pt-2">{location.description}</p>
                </div>

                {/* Get Directions Button */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${location.coords.lat},${location.coords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full px-4 py-2 rounded-xl text-white font-medium text-center block hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: practice.primary_color }}
                >
                  Get Directions
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}