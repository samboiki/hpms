'use client'
// Deployment trigger - Fixed build issues

import { motion } from 'framer-motion'
import { Header } from '@/components/landing/Header'
import { HeroSection } from '@/components/landing/HeroSection'
import { BannerSection } from '@/components/landing/BannerSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { WorkflowSection } from '@/components/landing/WorkflowSection'
import { AISystemSection } from '@/components/landing/AISystemSection'
import { ExclusiveFeaturesSection } from '@/components/landing/ExclusiveFeaturesSection'
import { HumanCenteredSection } from '@/components/landing/HumanCenteredSection'
import { CommunicationSection } from '@/components/landing/CommunicationSection'
import { ComparisonTable } from '@/components/landing/ComparisonTable'
import { IntegrationsSlider } from '@/components/landing/IntegrationsSlider'
import { Footer } from '@/components/landing/Footer'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { redirect } from 'next/navigation'

export default function HomePage() {
  // Check if this is admin mode
  if (process.env.NEXT_PUBLIC_APP_MODE === 'admin') {
    redirect('/dashboard')
  }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
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
        
        {/* Exclusive Features - Only We Provide */}
        <ExclusiveFeaturesSection />
        
        {/* Human-Centered Design */}
        <HumanCenteredSection />
        
        {/* Communication Channels */}
        <CommunicationSection />
        
        {/* Comparison Table */}
        <ComparisonTable />
        
        {/* Integrations */}
        <IntegrationsSlider />
      </main>

      <Footer />
    </motion.div>
  )
}