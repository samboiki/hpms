'use client'

import { Header } from '@/components/landing/Header'
import { HeroSection } from '@/components/landing/HeroSection'
import { BannerSection } from '@/components/landing/BannerSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { WorkflowSection } from '@/components/landing/WorkflowSection'
import { AISystemSection } from '@/components/landing/AISystemSection'
import { HumanCenteredSection } from '@/components/landing/HumanCenteredSection'
import { CommunicationSection } from '@/components/landing/CommunicationSection'
import { DeviceMockups } from '@/components/landing/DeviceMockups'
import { ComparisonTable } from '@/components/landing/ComparisonTable'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { IntegrationsSlider } from '@/components/landing/IntegrationsSlider'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'
import { ScrollProgress } from '@/components/landing/ScrollProgress'

export default function HomePage() {
  return (
    <>
      <ScrollProgress />
      <Header />
      
      <main className="min-h-screen">
        {/* Hero Section */}
        <HeroSection />
        
        {/* Banner Image Section */}
        <BannerSection />
        
        {/* Features Section - No sticky scroll */}
        <FeaturesSection />
        
        {/* Workflow Visualization */}
        <WorkflowSection />
        
        {/* AI System Section */}
        <AISystemSection />
        
        {/* Human-Centered Design */}
        <HumanCenteredSection />
        
        {/* Communication Channels */}
        <CommunicationSection />
        
        {/* Device Mockups */}
        <DeviceMockups />
        
        {/* Comparison Table */}
        <ComparisonTable />
        
        {/* Testimonials */}
        <TestimonialsSection />
        
        {/* Integrations */}
        <IntegrationsSlider />
        
        {/* CTA Section */}
        <CTASection />
      </main>

      <Footer />
    </>
  )
}