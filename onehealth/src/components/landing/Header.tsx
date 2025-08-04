'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'

const navigation = [
  {
    name: 'Services',
    href: '#services',
    submenu: [
      { 
        name: 'Patient Management', 
        description: 'Complete patient lifecycle management.',
        href: '#patient-management', 
        bgColor: 'from-amber-400 to-orange-500',
        bgImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop'
      },
      { 
        name: 'Encounter Management', 
        description: 'Streamline clinical encounters.',
        href: '#encounter-management', 
        bgColor: 'from-rose-400 to-pink-500',
        bgImage: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400&h=300&fit=crop'
      },
      { 
        name: 'Patient Engagement', 
        description: 'Connect with patients seamlessly.',
        href: '#patient-engagement', 
        bgColor: 'from-purple-400 to-violet-500',
        bgImage: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=300&fit=crop'
      },
      { 
        name: 'Smart Billing', 
        description: 'Automated billing & claims.',
        href: '#smart-billing', 
        bgColor: 'from-emerald-400 to-teal-500',
        bgImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop'
      },
      { 
        name: 'Practice Analytics', 
        description: 'Data-driven insights.',
        href: '#analytics', 
        bgColor: 'from-blue-400 to-cyan-500',
        bgImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop'
      },
      { 
        name: 'Staff Management', 
        description: 'HR & payroll solutions.',
        href: '#staff', 
        bgColor: 'from-indigo-400 to-blue-500',
        bgImage: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&h=300&fit=crop'
      },
    ]
  },
  {
    name: 'Features',
    href: '#features',
    submenu: {
      tabs: [
        {
          id: 'all-features',
          title: 'All Features',
          badge: '20+',
          badgeColor: 'from-purple-600 to-blue-600',
          image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop',
          categories: [
            {
              title: 'Practice Management',
              items: [
                { name: 'Calendar Management', href: '#calendar', description: 'Smart scheduling & appointments' },
                { name: 'Client Management', href: '#clients', description: 'Complete patient records' },
                { name: 'Staff Management', href: '#staff', description: 'HR & payroll solutions' },
                { name: 'Multi-location Support', href: '#locations', description: 'Manage multiple branches' },
                { name: 'Practice Analytics', href: '#analytics', description: 'Real-time insights' },
                { name: 'Task Management', href: '#tasks', description: 'Team collaboration' },
              ]
            },
            {
              title: 'Clinical Tools',
              items: [
                { name: 'Clinical Notes', href: '#notes', description: 'SOAP notes & templates' },
                { name: 'Online Forms', href: '#forms', description: 'Digital intake & consent' },
                { name: 'Telehealth', href: '#telehealth', description: 'Video consultations' },
                { name: 'Medical Records', href: '#records', description: 'Secure EMR system' },
                { name: 'Lab Integration', href: '#lab', description: 'Lab results & ordering' },
                { name: 'Prescription Management', href: '#rx', description: 'E-prescriptions' },
              ]
            },
            {
              title: 'Financial & Communication',
              items: [
                { name: 'Invoicing & Payments', href: '#payments', description: 'Automated billing' },
                { name: 'Insurance Claims', href: '#claims', description: 'Medical aid processing' },
                { name: 'Financial Reports', href: '#reports', description: 'Analytics & insights' },
                { name: 'SMS & Email', href: '#communication', description: 'Automated reminders' },
                { name: 'Patient Portal', href: '#portal', description: 'Self-service booking' },
                { name: 'Reviews Management', href: '#reviews', description: 'Reputation tracking' },
              ]
            },
          ]
        },
        {
          id: 'professions',
          title: 'Professions We Serve',
          badge: '12',
          badgeColor: 'from-emerald-500 to-teal-600',
          image: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600&h=400&fit=crop',
          categories: [
            {
              title: 'Medical Practices',
              items: [
                { name: 'General Practice', href: '#gp', description: 'Family medicine & primary care' },
                { name: 'Specialists', href: '#specialists', description: 'Cardiology, dermatology & more' },
                { name: 'Pediatrics', href: '#pediatrics', description: 'Child healthcare services' },
                { name: 'Gynecology', href: '#gynecology', description: 'Women\'s health specialists' },
              ]
            },
            {
              title: 'Allied Health',
              items: [
                { name: 'Physiotherapy', href: '#physio', description: 'Physical rehabilitation' },
                { name: 'Psychology', href: '#psychology', description: 'Mental health services' },
                { name: 'Occupational Therapy', href: '#ot', description: 'Functional rehabilitation' },
                { name: 'Speech Therapy', href: '#speech', description: 'Communication disorders' },
              ]
            },
            {
              title: 'Dental & Wellness',
              items: [
                { name: 'Dentistry', href: '#dental', description: 'Oral health services' },
                { name: 'Optometry', href: '#optometry', description: 'Eye care services' },
                { name: 'Chiropractic', href: '#chiro', description: 'Spinal health' },
                { name: 'Dietetics', href: '#diet', description: 'Nutrition services' },
              ]
            },
          ]
        },
        {
          id: 'practice-types',
          title: 'Practice Types',
          badge: '3',
          badgeColor: 'from-orange-500 to-red-500',
          image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=400&fit=crop',
          categories: [
            {
              title: '',
              items: [
                { name: 'Solo Practices', href: '#solo', description: 'Individual practitioners with complete autonomy' },
                { name: 'Group Practices', href: '#group', description: 'Multiple practitioners sharing resources' },
                { name: 'Multi-location Clinics', href: '#multi', description: 'Practices with multiple branches' },
              ]
            }
          ]
        }
      ]
    }
  },
  { name: 'Pricing', href: '#pricing' },
  { name: 'About', href: '#about' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [activeFeatureTab, setActiveFeatureTab] = useState('all-features')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-lg py-3 border-b border-gray-200'
          : 'bg-white/80 backdrop-blur-md py-4 border-b border-dashed border-gray-300'
      }`}
    >
      <nav className="container mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo with subtle brushed effect */}
          <Link href="/" className="flex items-center group relative">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative"
            >
              {/* Brushed/chalk dust effect behind logo */}
              <div className="absolute -inset-x-6 -inset-y-3 opacity-30 group-hover:opacity-40 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-transparent to-blue-500 blur-2xl transform skew-x-12" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400 to-transparent blur-xl transform -skew-x-6" />
              </div>
              <Image
                src="/onehealthlogo-Photoroom.png"
                alt="OneHealth"
                width={100}
                height={30}
                className="h-7 w-auto relative z-10"
              />
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {navigation.map((item) => (
              <div
                key={item.name}
                className="relative"
                onMouseEnter={() => setActiveSubmenu(item.name)}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <Link
                  href={item.href}
                  className="font-rubik font-bold text-sm text-gray-700 hover:text-purple-600 transition-all duration-300 flex items-center gap-1 px-4 py-2.5 rounded-lg hover:bg-purple-50/50 relative"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  {item.name}
                  {item.submenu && (
                    <Icon 
                      icon="solar:alt-arrow-down-bold" 
                      className={`w-3.5 h-3.5 transition-transform duration-300 ${
                        activeSubmenu === item.name ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </Link>

                {/* Premium Services Dropdown with Full Width */}
                <AnimatePresence>
                  {item.name === 'Services' && item.submenu && Array.isArray(item.submenu) && activeSubmenu === item.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="fixed left-0 right-0 top-full mt-3"
                    >
                      <div className="mx-auto container px-6">
                        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-gray-200/50">
                          <div className="grid grid-cols-3 gap-6">
                            {item.submenu.map((subitem) => (
                              <Link
                                key={subitem.name}
                                href={subitem.href}
                                className="group"
                              >
                                <div className={`relative overflow-hidden rounded-2xl h-48 hover:scale-[1.02] hover:shadow-2xl transition-all duration-500 cursor-pointer`}>
                                  {/* Gradient overlay */}
                                  <div className={`absolute inset-0 bg-gradient-to-br ${subitem.bgColor} opacity-90`} />
                                  
                                  {/* Background image */}
                                  <div 
                                    className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-50 transition-opacity duration-500"
                                    style={{ backgroundImage: `url(${subitem.bgImage})` }}
                                  />
                                  
                                  {/* Content */}
                                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    <h3 className="font-rubik font-bold text-white text-xl mb-2 drop-shadow-lg" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                      {subitem.name}
                                    </h3>
                                    <p className="text-white/90 text-sm leading-relaxed drop-shadow">
                                      {subitem.description}
                                    </p>
                                  </div>
                                  
                                  {/* Hover effect */}
                                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Premium Tabbed Features Dropdown */}
                  {item.name === 'Features' && item.submenu && item.submenu.tabs && activeSubmenu === item.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="fixed left-0 right-0 top-full mt-3"
                    >
                      <div className="mx-auto container px-6">
                        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
                          <div className="flex">
                            {/* Tab Navigation - Left Side */}
                            <div className="w-64 bg-gray-50/50 p-6 border-r border-gray-200/50">
                              <h3 className="font-rubik font-bold text-gray-900 text-sm mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                Product
                              </h3>
                              <div className="space-y-2">
                                {item.submenu.tabs.map((tab) => (
                                  <button
                                    key={tab.id}
                                    onClick={() => setActiveFeatureTab(tab.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                                      activeFeatureTab === tab.id
                                        ? 'bg-white shadow-sm text-purple-600 font-medium'
                                        : 'text-gray-700 hover:bg-white/50'
                                    }`}
                                  >
                                    <span className="font-rubik text-sm flex items-center justify-between w-full" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                      <span className="flex items-center gap-2">
                                        {tab.title}
                                        {tab.badge && (
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${tab.badgeColor} text-white`}>
                                            {tab.badge}
                                          </span>
                                        )}
                                      </span>
                                      <Icon 
                                        icon="solar:alt-arrow-right-linear" 
                                        className={`w-4 h-4 transition-opacity ${
                                          activeFeatureTab === tab.id ? 'opacity-100' : 'opacity-0'
                                        }`}
                                      />
                                    </span>
                                  </button>
                                ))}
                              </div>
                              {/* Tab Image */}
                              {item.submenu.tabs.find(tab => tab.id === activeFeatureTab)?.image && (
                                <div className="mt-6 rounded-xl overflow-hidden shadow-lg">
                                  <img 
                                    src={item.submenu.tabs.find(tab => tab.id === activeFeatureTab)?.image}
                                    alt=""
                                    className="w-full h-32 object-cover"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Tab Content - Right Side */}
                            <div className="flex-1 p-8">
                              {item.submenu.tabs.map((tab) => (
                                <div
                                  key={tab.id}
                                  className={`${activeFeatureTab === tab.id ? 'block' : 'hidden'}`}
                                >
                                  <h3 className="font-rubik font-bold text-gray-900 text-lg mb-6" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                    {tab.title}
                                  </h3>
                                  <div className="grid grid-cols-3 gap-8">
                                    {tab.categories.map((category, idx) => (
                                      <div key={idx}>
                                        {category.title && (
                                          <h4 className="font-rubik font-semibold text-gray-800 text-sm mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                            {category.title}
                                          </h4>
                                        )}
                                        <div className="space-y-3">
                                          {category.items.map((item) => (
                                            <Link
                                              key={item.name}
                                              href={item.href}
                                              className="block group hover:translate-x-1 transition-all duration-200"
                                            >
                                              <h5 className="font-rubik font-medium text-gray-800 text-sm group-hover:text-purple-600 transition-colors" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                                {item.name}
                                              </h5>
                                              <p className="font-montserrat text-xs text-gray-500 mt-0.5 group-hover:text-gray-600 transition-colors" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                {item.description}
                                              </p>
                                            </Link>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
                                <Link href="/features" className="text-sm font-rubik font-medium text-purple-600 hover:text-purple-700 transition-colors inline-flex items-center gap-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                  View All Features
                                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                                </Link>
                                <Link href="/demo" className="text-sm font-rubik font-medium text-gray-600 hover:text-purple-600 transition-colors inline-flex items-center gap-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                  <Icon icon="solar:play-circle-linear" className="w-4 h-4" />
                                  Watch Demo
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/contact-sales">
              <Button
                variant="ghost"
                className="font-rubik font-semibold text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50/50 transition-all duration-300"
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                Contact Sales
              </Button>
            </Link>
            
            {/* Premium Auth Container */}
            <div className="flex items-center bg-white/50 backdrop-blur-xl rounded-xl p-0.5 shadow-sm border border-gray-200/30">
              <Link href="/auth/login">
                <button
                  className="font-rubik font-medium text-sm text-gray-700 hover:text-gray-900 rounded-lg px-4 py-1.5 transition-all duration-300 hover:bg-gray-50/50"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  Log In
                </button>
              </Link>
              <Link href="/auth/register">
                <button
                  className="font-rubik bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm px-4 py-1.5 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  Sign Up
                </button>
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Icon
              icon={mobileMenuOpen ? 'solar:close-bold' : 'solar:hamburger-menu-bold'}
              className="w-6 h-6"
            />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-gray-200/20 shadow-xl"
          >
            <div className="container mx-auto px-6 py-6 space-y-4">
              {navigation.map((item) => (
                <div key={item.name}>
                  <Link
                    href={item.href}
                    className="block text-gray-700 font-bold font-rubik py-2 hover:text-purple-600 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {item.name}
                  </Link>
                  {item.submenu && Array.isArray(item.submenu) && (
                    <div className="ml-4 mt-2 space-y-2">
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.name}
                          href={subitem.href}
                          className="flex items-center gap-2 text-gray-600 hover:text-purple-600 py-1 transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon icon={subitem.icon} className="w-4 h-4" />
                          {subitem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {item.submenu && item.submenu.tabs && (
                    <div className="ml-4 mt-2 space-y-2">
                      {item.submenu.tabs.map((tab) => (
                        <div key={tab.id}>
                          <h4 className="font-rubik font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                            {tab.title}
                          </h4>
                          <div className="ml-2 space-y-1">
                            {tab.categories.map((category, idx) => (
                              <div key={idx} className="space-y-1">
                                {category.items.slice(0, 2).map((feature) => (
                                  <Link
                                    key={feature.name}
                                    href={feature.href}
                                    className="block text-gray-600 hover:text-purple-600 py-1 transition-colors text-sm font-montserrat"
                                    onClick={() => setMobileMenuOpen(false)}
                                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                                  >
                                    {feature.name}
                                  </Link>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-4 space-y-3">
                <Link href="/contact-sales" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full font-rubik" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    Contact Sales
                  </Button>
                </Link>
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full font-rubik" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    Log In
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 font-rubik" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    Sign Up
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}