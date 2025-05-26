'use client';

import { Practice } from '@/lib/tenants';
import HeroSection from '@/components/HeroSection';
import EnhancedServicesSection from '@/components/EnhancedServicesSection';
import AboutSection from '@/components/AboutSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import BeforeAfterGallery from '@/components/BeforeAfterGallery';
import Gallery from '@/components/Gallery';
import EnhancedContactSection from '@/components/EnhancedContactSection';
import EnhancedBookingWidget from '@/components/EnhancedBookingWidget';
import PremiumNavbar from '@/components/PremiumNavbar';
import Footer from '@/components/Footer';
import LocationMap from '@/components/LocationMap';
import { useState } from 'react';
import { SubService, ServiceCategory } from '@/data/dr-polina-services';

interface PageWrapperProps {
  practice: Practice;
}

export default function PageWrapper({ practice }: PageWrapperProps) {
  const [selectedService, setSelectedService] = useState<SubService | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | undefined>();

  const handleBookService = (service: SubService, category: ServiceCategory) => {
    setSelectedService(service);
    setSelectedCategory(category);
  };

  const isAesthetic = practice.slug === 'dr-polina-aesthetics';

  return (
    <div 
      className="min-h-screen"
      style={{
        '--primary-color': practice.primary_color,
        '--secondary-color': practice.secondary_color,
      } as React.CSSProperties}
    >
      <PremiumNavbar practice={practice} />
      <div id="hero">
        <HeroSection practice={practice} />
      </div>
      <EnhancedServicesSection practice={practice} onBookService={handleBookService} />
      <AboutSection practice={practice} />
      {isAesthetic && (
        <>
          <Gallery practice={practice} />
          <BeforeAfterGallery practice={practice} />
        </>
      )}
      <TestimonialsSection practice={practice} />
      <EnhancedBookingWidget 
        practice={practice} 
        preSelectedService={selectedService}
        preSelectedCategory={selectedCategory}
      />
      {isAesthetic && <LocationMap practice={practice} />}
      <EnhancedContactSection practice={practice} />
      <Footer practice={practice} />
    </div>
  );
}