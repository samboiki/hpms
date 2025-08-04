'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon icon="solar:health-bold-duotone" className="w-8 h-8 text-onehealth-600" />
            <span className="text-2xl font-bold text-gray-900">OneHealth</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-700 hover:text-onehealth-600 transition">Features</Link>
            <Link href="#pricing" className="text-gray-700 hover:text-onehealth-600 transition">Pricing</Link>
            <Link href="#about" className="text-gray-700 hover:text-onehealth-600 transition">About</Link>
            <Link href="#contact" className="text-gray-700 hover:text-onehealth-600 transition">Contact</Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/auth/login" className="text-gray-700 hover:text-onehealth-600 transition">Login</Link>
            <Link href="/auth/register" className="bg-onehealth-600 text-white px-6 py-2 rounded-lg hover:bg-onehealth-700 transition">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-onehealth-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
            >
              Transform Your Healthcare Practice with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-onehealth-600 to-onehealth-700">
                OneHealth
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-gray-600 mb-8"
            >
              The most comprehensive healthcare management system designed for modern medical practices. 
              Streamline operations, enhance patient care, and grow your practice.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/auth/register" className="bg-onehealth-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-onehealth-700 transition flex items-center justify-center">
                Start Free Trial
                <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5 ml-2" />
              </Link>
              <Link href="#demo" className="bg-white border-2 border-onehealth-600 text-onehealth-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-onehealth-50 transition flex items-center justify-center">
                <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5 mr-2" />
                Watch Demo
              </Link>
            </motion.div>
          </div>

          {/* Hero Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 relative"
          >
            <div className="relative mx-auto max-w-6xl">
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10"></div>
              <div className="rounded-2xl shadow-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 p-8">
                <div className="aspect-video bg-white rounded-lg shadow-inner flex items-center justify-center">
                  <div className="text-center">
                    <Icon icon="solar:health-bold-duotone" className="w-24 h-24 text-onehealth-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-semibold text-gray-800 mb-2">OneHealth Dashboard</h3>
                    <p className="text-gray-600">Complete practice management at your fingertips</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Practice
            </h2>
            <p className="text-xl text-gray-600">
              Comprehensive tools designed by healthcare professionals, for healthcare professionals
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition"
            >
              <Icon icon="solar:calendar-bold-duotone" className="w-12 h-12 text-onehealth-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Scheduling</h3>
              <p className="text-gray-600">
                Intelligent appointment scheduling with automated reminders, conflict detection, and patient preferences.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition"
            >
              <Icon icon="solar:medical-kit-bold-duotone" className="w-12 h-12 text-onehealth-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Electronic Health Records</h3>
              <p className="text-gray-600">
                Complete EHR system with medical history, prescriptions, lab results, and imaging all in one place.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition"
            >
              <Icon icon="solar:money-bag-bold-duotone" className="w-12 h-12 text-onehealth-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Billing & Insurance</h3>
              <p className="text-gray-600">
                Streamlined billing with insurance claim processing, payment tracking, and automated invoicing.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition"
            >
              <Icon icon="solar:chat-line-bold-duotone" className="w-12 h-12 text-onehealth-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Patient Communication</h3>
              <p className="text-gray-600">
                Automated SMS and email reminders, secure messaging, and patient portal for better engagement.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition"
            >
              <Icon icon="solar:chart-bold-duotone" className="w-12 h-12 text-onehealth-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Analytics & Reports</h3>
              <p className="text-gray-600">
                Real-time insights into practice performance, patient demographics, and financial metrics.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition"
            >
              <Icon icon="solar:users-group-rounded-bold-duotone" className="w-12 h-12 text-onehealth-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Multi-Practice Support</h3>
              <p className="text-gray-600">
                Manage multiple locations, branches, and practitioners from a single unified platform.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-onehealth-600 to-onehealth-700">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of healthcare professionals who have already modernized their practices with OneHealth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register" className="bg-white text-onehealth-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition">
              Start Your Free Trial
            </Link>
            <Link href="#contact" className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Icon icon="solar:health-bold-duotone" className="w-6 h-6 text-white" />
                <span className="text-xl font-bold text-white">OneHealth</span>
              </div>
              <p className="text-gray-400">
                The future of healthcare management is here.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="#features" className="text-gray-400 hover:text-white transition">Features</Link></li>
                <li><Link href="#pricing" className="text-gray-400 hover:text-white transition">Pricing</Link></li>
                <li><Link href="#demo" className="text-gray-400 hover:text-white transition">Demo</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="#about" className="text-gray-400 hover:text-white transition">About</Link></li>
                <li><Link href="#contact" className="text-gray-400 hover:text-white transition">Contact</Link></li>
                <li><Link href="/privacy" className="text-gray-400 hover:text-white transition">Privacy</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Connect</h4>
              <div className="flex space-x-4">
                <Link href="#" className="text-gray-400 hover:text-white transition">
                  <Icon icon="solar:facebook-bold-duotone" className="w-6 h-6" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition">
                  <Icon icon="solar:twitter-bold-duotone" className="w-6 h-6" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition">
                  <Icon icon="solar:linkedin-bold-duotone" className="w-6 h-6" />
                </Link>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-400">
              © 2025 OneHealth Systems. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}