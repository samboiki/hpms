import React, { useEffect, useRef } from 'react';

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom: number;
  height?: string;
  locationName: string;
  address: string;
}

const GoogleMap: React.FC<GoogleMapProps> = ({ 
  center, 
  zoom, 
  height = '400px',
  locationName,
  address 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Custom monochromatic silver style with brand accent
  const mapStyles = [
    {
      elementType: "geometry",
      stylers: [{ color: "#f5f5f5" }],
    },
    {
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#616161" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#f5f5f5" }],
    },
    {
      featureType: "administrative.land_parcel",
      elementType: "labels.text.fill",
      stylers: [{ color: "#bdbdbd" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#eeeeee" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#e5e5e5" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }],
    },
    {
      featureType: "road.arterial",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#dadada" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#616161" }],
    },
    {
      featureType: "road.local",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }],
    },
    {
      featureType: "transit.line",
      elementType: "geometry",
      stylers: [{ color: "#e5e5e5" }],
    },
    {
      featureType: "transit.station",
      elementType: "geometry",
      stylers: [{ color: "#eeeeee" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#c9c9c9" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }],
    },
  ];

  useEffect(() => {
    const initializeMap = async () => {
      if (mapRef.current && window.google && window.google.maps) {
        // Initialize the map
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          styles: mapStyles,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapId: 'DEMO_MAP_ID', // Required for Advanced Markers
        });

        googleMapRef.current = map;

        // Wait for the marker library to load
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        // Create custom marker content
        const markerContent = document.createElement('div');
        markerContent.style.width = '48px';
        markerContent.style.height = '48px';
        markerContent.innerHTML = `
          <div style="
            width: 48px;
            height: 48px;
            background: #32b9e5;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 3px solid white;
          ">
            <div style="
              width: 12px;
              height: 12px;
              background: white;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `;

        // Create the advanced marker
        const marker = new AdvancedMarkerElement({
          map,
          position: center,
          content: markerContent,
          title: locationName,
        });

        markerRef.current = marker;

        // Add click event to marker
        marker.addListener('click', () => {
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 16px; font-family: 'Lexend', sans-serif;">
                <h3 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 18px;">${locationName}</h3>
                <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${address}</p>
                <a 
                  href="https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: #32b9e5;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.3s ease;
                  "
                  onmouseover="this.style.background='#ec7ec5'"
                  onmouseout="this.style.background='#32b9e5'"
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,10H19V12H14V10M14,14H17V16H14V14M10,11L8,9L6,11L7,12L5.83,13.19L4.41,11.77L2,14.17L3.24,15.41L2.01,16.64L3.41,18.06L4.64,16.83L5.88,18.06L8.3,15.64L7,14.35L8,13.35L10,15.35L11,14.35L10,13.35L11,12.35L10,11M11,19A1,1 0 0,0 10,18A1,1 0 0,0 9,19A1,1 0 0,0 10,20A1,1 0 0,0 11,19M7,19A1,1 0 0,0 6,18A1,1 0 0,0 5,19A1,1 0 0,0 6,20A1,1 0 0,0 7,19Z"/>
                  </svg>
                  Get Directions
                </a>
              </div>
            `,
          });
          infoWindow.open(map, marker);
        });
      }
    };

    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyB4VcMzb2cJr1FuywXKgI6N58CfyC7o7_k&libraries=marker&v=beta&map_ids=DEMO_MAP_ID`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else {
      initializeMap();
    }

    // Cleanup
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [center, zoom, locationName, address]); // mapStyles is a constant, so we don't need it in deps

  return (
    <div 
      ref={mapRef} 
      style={{ 
        width: '100%', 
        height,
        borderRadius: '16px',
        overflow: 'hidden'
      }} 
    />
  );
};

export default GoogleMap;