'use client';

import { Practice } from '@/lib/tenants';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Heart, 
  Shield, 
  Award, 
  Stethoscope,
  ChevronRight,
  ExternalLink,
  ArrowUp
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface FooterProps {
  practice: Practice;
}

export default function Footer({ practice }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quickLinks = [
    { label: 'Services', href: '#services', icon: Stethoscope },
    { label: 'About Us', href: '#about', icon: Heart },
    { label: 'Book Appointment', href: '#booking', icon: Clock },
    { label: 'Contact', href: '#contact', icon: Phone }
  ];

  const services = [
    'General Consultation',
    'Emergency Care',
    'Specialist Services',
    'Laboratory Services',
    'Pharmacy',
    'Health Checkups'
  ];

  const certifications = [
    { icon: Shield, text: 'HIPAA Compliant' },
    { icon: Award, text: 'ISO Certified' },
    { icon: Heart, text: 'Patient First' }
  ];

  return (
    <footer className="relative text-white overflow-hidden">
      {/* Premium Gradient Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, 
            ${practice.primary_color}10 0%, 
            #0a0a0a 20%, 
            #000000 50%, 
            ${practice.secondary_color}05 100%
          )`,
        }}
      />
      
      {/* Animated Gradient Border */}
      <motion.div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, 
            transparent, 
            ${practice.primary_color}, 
            ${practice.secondary_color}, 
            ${practice.primary_color}, 
            transparent
          )`,
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      {/* Main Footer Content */}
      <div className="relative">
        {/* Upper Footer */}
        <div className="border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {/* Practice Info */}
              <motion.div 
                className="lg:col-span-1"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="mb-6">
                  <motion.h3 
                    className="text-3xl font-bold mb-2 bg-clip-text text-transparent"
                    style={{ 
                      backgroundImage: `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color} 100%)`,
                    }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {practice.name}
                  </motion.h3>
                  <p className="text-gray-400 text-sm">Excellence in Healthcare</p>
                </div>
                
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Dedicated to providing compassionate, quality healthcare services to our community. 
                  Your health is our priority.
                </p>

                {/* Certifications */}
                <div className="space-y-3">
                  {certifications.map((cert, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${practice.primary_color}20` }}
                      >
                        <cert.icon className="w-4 h-4" style={{ color: practice.primary_color }} />
                      </div>
                      <span className="text-sm text-gray-300">{cert.text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <h4 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <div className="w-8 h-1 rounded" style={{ backgroundColor: practice.primary_color }} />
                  Quick Links
                </h4>
                <ul className="space-y-3">
                  {quickLinks.map((link, index) => (
                    <motion.li
                      key={index}
                      whileHover={{ x: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link 
                        href={link.href}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                      >
                        <link.icon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span>{link.label}</span>
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                      </Link>
                    </motion.li>
                  ))}
                  <motion.li
                    whileHover={{ x: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <a 
                      href={process.env.NEXT_PUBLIC_HPMS_URL || '#'}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                      style={{ color: practice.primary_color }}
                    >
                      <Shield className="w-4 h-4" />
                      <span className="font-medium">Patient Portal</span>
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </a>
                  </motion.li>
                </ul>
              </motion.div>

              {/* Services */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h4 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <div className="w-8 h-1 rounded" style={{ backgroundColor: practice.primary_color }} />
                  Our Services
                </h4>
                <ul className="space-y-3">
                  {services.map((service, index) => (
                    <motion.li
                      key={index}
                      className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                      whileHover={{ x: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      {service}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              {/* Contact Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <h4 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <div className="w-8 h-1 rounded" style={{ backgroundColor: practice.primary_color }} />
                  Contact Info
                </h4>
                <ul className="space-y-4">
                  <li>
                    <a 
                      href={`tel:${practice.contact_phone}`}
                      className="flex items-start gap-3 text-gray-400 hover:text-white transition-colors group"
                    >
                      <Phone className="w-5 h-5 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" style={{ color: practice.primary_color }} />
                      <span>{practice.contact_phone || '+264 61 123 4567'}</span>
                    </a>
                  </li>
                  <li>
                    <a 
                      href={`mailto:${practice.contact_email}`}
                      className="flex items-start gap-3 text-gray-400 hover:text-white transition-colors group"
                    >
                      <Mail className="w-5 h-5 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" style={{ color: practice.primary_color }} />
                      <span>{practice.contact_email || 'info@practice.com'}</span>
                    </a>
                  </li>
                  <li className="flex items-start gap-3 text-gray-400">
                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: practice.primary_color }} />
                    <div>
                      <p>{practice.address || '123 Medical Plaza'}</p>
                      <p>{practice.city || 'City'}, {practice.country || 'Country'}</p>
                      {practice.postal_code && <p>{practice.postal_code}</p>}
                    </div>
                  </li>
                </ul>

                {/* Social Links */}
                {(practice.social_links?.facebook || practice.social_links?.twitter || practice.social_links?.instagram) && (
                  <div className="mt-6">
                    <p className="text-sm text-gray-500 mb-3">Follow us</p>
                    <div className="flex gap-3">
                      {practice.social_links?.facebook && (
                        <motion.a
                          href={practice.social_links.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span className="sr-only">Facebook</span>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </motion.a>
                      )}
                      {practice.social_links?.twitter && (
                        <motion.a
                          href={practice.social_links.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span className="sr-only">Twitter</span>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                          </svg>
                        </motion.a>
                      )}
                      {practice.social_links?.instagram && (
                        <motion.a
                          href={practice.social_links.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span className="sr-only">Instagram</span>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                          </svg>
                        </motion.a>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Lower Footer */}
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <p className="text-gray-400">
                  &copy; {currentYear} {practice.name}. All rights reserved.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2 text-sm">
                  <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">
                    Privacy Policy
                  </Link>
                  <span className="text-gray-600">•</span>
                  <Link href="/terms" className="text-gray-500 hover:text-gray-300 transition-colors">
                    Terms of Service
                  </Link>
                  <span className="text-gray-600">•</span>
                  <Link href="/accessibility" className="text-gray-500 hover:text-gray-300 transition-colors">
                    Accessibility
                  </Link>
                </div>
              </div>
              
              <div className="text-center md:text-right">
                <p className="text-sm text-gray-500">
                  Powered by{' '}
                  <a 
                    href="https://hpms.com" 
                    className="font-medium hover:text-white transition-colors inline-flex items-center gap-1"
                    style={{ color: practice.primary_color }}
                  >
                    HPMS
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Hospital Practice Management System
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <motion.button
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-50 text-white"
        style={{ backgroundColor: practice.primary_color }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: showScrollTop ? 1 : 0, 
          scale: showScrollTop ? 1 : 0 
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
    </footer>
  );
}