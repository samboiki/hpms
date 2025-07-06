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
import { SubService as NewCharmSubService, ServiceCategory as NewCharmServiceCategory } from '@/data/newcharm-services';

// NewCharm specific components
import NewCharmNavbar from '@/components/newcharm/NewCharmNavbar';
import NewCharmHero from '@/components/newcharm/NewCharmHero';
import NewCharmServices from '@/components/newcharm/NewCharmServices';
import NewCharmAbout from '@/components/newcharm/NewCharmAbout';
import NewCharmTestimonials from '@/components/newcharm/NewCharmTestimonials';
import NewCharmContact from '@/components/newcharm/NewCharmContact';

interface PageWrapperProps {
  practice: Practice;
}

export default function PageWrapper({ practice }: PageWrapperProps) {
  const [selectedService, setSelectedService] = useState<SubService | NewCharmSubService | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | NewCharmServiceCategory | undefined>();

  const handleBookService = (service: SubService | NewCharmSubService, category: ServiceCategory | NewCharmServiceCategory) => {
    setSelectedService(service);
    setSelectedCategory(category);
  };

  const isAesthetic = practice.slug === 'dr-polina-aesthetics';
  const isNewCharm = practice.slug === 'newcharm-dental';

  // NewCharm gets completely custom components
  if (isNewCharm) {
    return (
      <div className="min-h-screen bg-white">
        <NewCharmNavbar logo={practice.logo} />
        <NewCharmHero />
        <NewCharmServices />
        <NewCharmAbout />
        <NewCharmTestimonials />
        <NewCharmContact />
        <Footer practice={practice} />
      </div>
    );
  }

  // Default components for other practices
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