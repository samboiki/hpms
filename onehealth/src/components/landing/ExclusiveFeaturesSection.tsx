'use client'

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useState, useRef } from 'react'
import Image from 'next/image'

const exclusiveFeatures = [
  {
    id: 1,
    title: "Ask Anything About Your Data",
    subtitle: "Natural Language Insights",
    description: "Query your practice data in plain English. No custom reports, no IT department needed. Get instant insights in under 10 seconds.",
    icon: 'solar:chat-dots-bold-duotone',
    color: 'from-purple-600 to-blue-600',
    bgColor: 'from-purple-100 to-blue-100',
    gradient: 'from-purple-500 via-purple-600 to-blue-600',
    shadowColor: 'shadow-purple-500/20',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    features: ['Natural language queries', 'Sub-10 second responses', 'No technical knowledge required']
  },
  {
    id: 2,
    title: "AI-Powered Remittance Processing",
    subtitle: "Automated Balance Updates",
    description: "Our AI engines automatically scan your emails, extract remittance advice, and update balances with built-in checks and reconciliation.",
    icon: 'solar:robot-bold-duotone',
    color: 'from-blue-600 to-cyan-600',
    bgColor: 'from-blue-100 to-cyan-100',
    gradient: 'from-blue-500 via-blue-600 to-cyan-600',
    shadowColor: 'shadow-blue-500/20',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
    features: ['Email scanning', 'Auto-reconciliation', 'Balance verification']
  },
  {
    id: 3,
    title: "One-Click Document Generation",
    subtitle: "Branded & E-Signature Ready",
    description: "Automatically generate branded prescriptions, invoices, and leave forms. No external providers, no manual work - just click and print.",
    icon: 'solar:document-bold-duotone',
    color: 'from-cyan-600 to-teal-600',
    bgColor: 'from-cyan-100 to-teal-100',
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
    features: ['Auto-generation', 'E-signature integration', 'Professional branding']
  },
  {
    id: 4,
    title: "Complete HR Suite Built-In",
    subtitle: "First-Ever Integrated HR",
    description: "Manage timesheets, leave, payslips - all automated. Give your team professional payslips while saving on outsourcing costs.",
    icon: 'solar:users-group-rounded-bold-duotone',
    color: 'from-teal-600 to-green-600',
    bgColor: 'from-teal-100 to-green-100',
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
    features: ['Electronic timesheets', 'Automated payslips', 'Leave management']
  },
  {
    id: 5,
    title: "In-App Team Messaging",
    subtitle: "Seamless Communication",
    description: "Stop shouting across hallways. Instant messaging between team members, right within your practice management system.",
    icon: 'solar:chat-square-text-bold-duotone',
    color: 'from-green-600 to-emerald-600',
    bgColor: 'from-green-100 to-emerald-100',
    image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=800&q=80',
    features: ['Instant messaging', 'Team collaboration', 'No external apps']
  },
  {
    id: 6,
    title: "One-Touch Medical Aid Batching",
    subtitle: "50+ Steps Reduced to 1",
    description: "Create invoices and let our engines handle the rest. Automatic batching by medical aid, sent at your preferred intervals.",
    icon: 'solar:layers-bold-duotone',
    color: 'from-emerald-600 to-lime-600',
    bgColor: 'from-emerald-100 to-lime-100',
    image: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&q=80',
    features: ['Auto-batching', 'Smart scheduling', 'Zero manual work']
  },
  {
    id: 7,
    title: "Any Device, Anywhere Access",
    subtitle: "Your Practice in Your Pocket",
    description: "The only solution that works seamlessly on PC, tablet, and mobile. Access your practice whether you're on the road, at home, or in the office.",
    icon: 'solar:devices-bold-duotone',
    color: 'from-lime-600 to-yellow-600',
    bgColor: 'from-lime-100 to-yellow-100',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80',
    features: ['Cross-platform', 'Mobile-optimized', 'Offline capable']
  },
  {
    id: 8,
    title: "Built-In Telemedicine Platform",
    subtitle: "Virtual Consultations",
    description: "The only practice management system with integrated video consultations. Schedule, call, and manage virtual appointments seamlessly.",
    icon: 'solar:video-camera-bold-duotone',
    color: 'from-yellow-600 to-orange-600',
    bgColor: 'from-yellow-100 to-orange-100',
    image: '/telehealth.jpg',
    features: ['Video consultations', 'Integrated scheduling', 'Secure platform']
  },
  {
    id: 9,
    title: "Professional Website & Email Hosting",
    subtitle: "Complete Digital Presence",
    description: "We create, host, and maintain your practice website. Professional emails, ample storage, all integrated with your portal - saving thousands in costs.",
    icon: 'solar:global-bold-duotone',
    color: 'from-orange-600 to-red-600',
    bgColor: 'from-orange-100 to-red-100',
    image: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&q=80',
    features: ['Custom website', 'Email hosting', 'Zero maintenance']
  },
  {
    id: 10,
    title: "Automated Marketing Communications",
    subtitle: "Built-In Campaign Engine",
    description: "No external marketing providers needed. Set up once, and our engines handle all patient communications automatically.",
    icon: 'solar:letter-bold-duotone',
    color: 'from-red-600 to-pink-600',
    bgColor: 'from-red-100 to-pink-100',
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80',
    features: ['Auto-campaigns', 'Patient engagement', 'Set and forget']
  },
  {
    id: 11,
    title: "5 Secret Game-Changing Features",
    subtitle: "Exclusive to OneHealth",
    description: "Revolutionary features designed for maximum practice growth and multiple income streams. Join us to unlock these industry-first capabilities.",
    icon: 'solar:magic-stick-3-bold-duotone',
    color: 'from-pink-600 to-purple-600',
    bgColor: 'from-pink-100 to-purple-100',
    features: ['Top secret', 'Revenue multipliers', 'Industry first'],
    isSecret: true
  }
]

// Feature Row Component with alternating layout
function FeatureRow({ feature, index, isReversed }: { feature: any, index: number, isReversed: boolean }) {
  const [isFlipped, setIsFlipped] = useState(false)
  
  const imageSection = (
    <motion.div
      initial={{ opacity: 0, x: isReversed ? 50 : -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      viewport={{ once: true }}
      className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 h-[400px] shadow-2xl group"
    >
      {feature.image ? (
        <>
          <Image
            src={feature.image}
            alt={feature.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Premium theme color overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 mix-blend-multiply" />
          
          {/* Subtle glassmorphic effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/5 via-transparent to-white/10 backdrop-blur-[1px]" />
          
          {/* Feature icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="relative"
            >
              <Icon icon={feature.icon} className="w-24 h-24 text-white/20 drop-shadow-2xl" />
            </motion.div>
          </div>
          
          {/* Number badge in corner */}
          <div className="absolute top-6 left-6 w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-lg">{feature.id < 10 ? `0${feature.id}` : feature.id}</span>
          </div>
        </>
      ) : (
        /* Fallback for features without images */
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="relative"
          >
            <Icon icon={feature.icon} className="w-32 h-32 text-purple-600/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 blur-3xl opacity-30" />
          </motion.div>
        </div>
      )}
    </motion.div>
  )
  
  const cardSection = (
    <motion.div
      initial={{ opacity: 0, x: isReversed ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      viewport={{ once: true }}
      className="relative h-[400px] preserve-3d cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="absolute inset-0 preserve-3d transition-transform duration-700"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of card */}
        <div className="absolute inset-0 backface-hidden">
          <div className="h-full bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200 p-10 flex flex-col relative overflow-hidden group hover:shadow-2xl transition-shadow">
            {/* Large number background */}
            <div className="absolute -top-20 -right-20 text-[250px] font-black text-gray-100 select-none">
              {feature.id < 10 ? `0${feature.id}` : feature.id}
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 font-semibold mb-4">
                {feature.subtitle}
              </p>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                {feature.description}
              </p>
              
              {/* Features preview */}
              <div className="space-y-2 mb-8">
                {feature.features.slice(0, 2).map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-700">
                    <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
              
              {/* Click to flip indicator */}
              <div className="flex items-center gap-2 text-purple-600 mt-auto">
                <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5" />
                <span className="text-sm font-medium">Click for more details</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Back of card */}
        <div className="absolute inset-0 backface-hidden rotate-y-180">
          <div className="h-full bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl p-10 flex flex-col text-white">
            <button
              className="absolute top-6 right-6 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setIsFlipped(false)
              }}
            >
              <Icon icon="solar:close-bold" className="w-5 h-5" />
            </button>
            
            <h4 className="text-2xl font-bold mb-6">Key Benefits</h4>
            <ul className="space-y-3 flex-grow">
              {feature.features.map((item: string, idx: number) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="flex items-center gap-3"
                >
                  <Icon icon="solar:verified-check-bold" className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-6 w-full py-3 rounded-xl bg-white text-purple-900 font-bold hover:shadow-lg transition-all"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
  
  return (
    <div className="grid lg:grid-cols-2 gap-8 items-center mb-16">
      {isReversed ? (
        <>
          {cardSection}
          {imageSection}
        </>
      ) : (
        <>
          {imageSection}
          {cardSection}
        </>
      )}
    </div>
  )
}

export function ExclusiveFeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  })
  
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <section ref={sectionRef} className="py-32 relative overflow-hidden bg-gray-50">
      {/* Light gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-100 via-transparent to-transparent" />
      </div>
      
      {/* Subtle floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{ duration: 25, repeat: Infinity }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
          className="mb-20"
        >
          {/* Title with number */}
          <div className="flex items-start gap-8 mb-12">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              transition={{ 
                duration: 0.8,
                type: "spring",
                bounce: 0.4
              }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="text-[150px] font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-blue-400 leading-none">
                10
              </div>
              <div className="absolute -bottom-4 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
            </motion.div>
            
            <div className="flex-1 pt-8">
              <motion.h2 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight"
              >
                Features only<br />
                <span className="text-gray-400">we provide.</span>
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-xl text-gray-600 max-w-2xl"
              >
                Setting the trend with innovations that transform how healthcare practices operate. 
                One seamless ecosystem, infinite possibilities.
              </motion.p>
            </div>
          </div>
        </motion.div>

        {/* Alternating Feature Rows */}
        <div className="space-y-16">
          {exclusiveFeatures.slice(0, 10).map((feature, index) => (
            <FeatureRow 
              key={feature.id} 
              feature={feature} 
              index={index} 
              isReversed={index % 2 === 1}
            />
          ))}
          
          {/* Special Secret Features Card */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-blue-600" />
              
              <div className="flex items-center justify-between gap-8">
                {/* Left content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center">
                      <Icon icon="solar:magic-stick-3-bold-duotone" className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      5 Secret Game-Changing Features
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 max-w-2xl">
                    Exclusive capabilities for exponential practice growth and multiple revenue streams.
                  </p>
                </div>
                
                {/* Right CTA */}
                <motion.a
                  href="/auth/register"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
                >
                  <Icon icon="solar:lock-unlocked-bold-duotone" className="w-5 h-5" />
                  Unlock Now
                  <Icon icon="solar:arrow-right-bold" className="w-5 h-5" />
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center relative mt-32"
        >
          <motion.p 
            className="text-2xl text-gray-600 mb-4 font-light"
          >
            Setting the trend. Leading the innovation.
          </motion.p>
          
          <motion.p 
            className="text-4xl md:text-5xl font-bold"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
            }}
            transition={{ duration: 5, repeat: Infinity }}
            style={{ 
              backgroundSize: "200% 200%",
              backgroundImage: "linear-gradient(to right, #a855f7, #ec4899, #3b82f6, #a855f7)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent"
            }}
          >
            The only complete practice management ecosystem.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}