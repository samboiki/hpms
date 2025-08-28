'use client'
// Deployment trigger - Fixed build issues

import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
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
import FarmarisLanding from '@/components/farmaris/FarmarisLanding'

function HomeContent() {
  const searchParams = useSearchParams()
  const practice = searchParams.get('practice')
  
  // Show Farmaris landing if practice=farmaris
  if (practice === 'farmaris') {
    return <FarmarisLanding />
  }
  
  // Default OneHealth landing
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

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}