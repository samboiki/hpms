'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Phone, Calendar, ChevronDown, Globe, Shield, Sparkles } from 'lucide-react';
import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';

interface PremiumNavbarProps {
  practice: Practice;
}

export default function PremiumNavbar({ practice }: PremiumNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['hero', 'services', 'about', 'gallery', 'testimonials', 'booking', 'contact'];
      const current = sections.find(section => {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          return rect.top <= 100 && rect.bottom >= 100;
        }
        return false;
      });
      setActiveSection(current || '');
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Services', href: '#services' },
    { label: 'About', href: '#about' },
    ...(practice.slug === 'dr-polina-aesthetics' ? [{ label: 'Gallery', href: '#gallery' }] : []),
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'Contact', href: '#contact' }
  ];

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const isAesthetic = practice.slug === 'dr-polina-aesthetics';

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-lg shadow-lg py-2' 
            : 'bg-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <motion.div 
              className="flex items-center"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link href="/" className="flex items-center space-x-2">
                <motion.div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${practice.primary_color}20` }}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  {isAesthetic ? (
                    <Sparkles className="w-5 h-5" style={{ color: practice.primary_color }} />
                  ) : (
                    <Shield className="w-5 h-5" style={{ color: practice.primary_color }} />
                  )}
                </motion.div>
                <div>
                  <span 
                    className="text-xl font-bold"
                    style={{ color: scrolled ? practice.primary_color : '#ffffff' }}
                  >
                    {practice.name}
                  </span>
                  {isAesthetic && (
                    <p className={`text-xs ${scrolled ? 'text-gray-600' : 'text-white/80'}`}>
                      Beauty & Aesthetics
                    </p>
                  )}
                </div>
              </Link>
            </motion.div>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <button
                    onClick={() => handleNavClick(link.href)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                      activeSection === link.href.replace('#', '')
                        ? scrolled ? 'text-gray-900' : 'text-white'
                        : scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {link.label}
                    {activeSection === link.href.replace('#', '') && (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ backgroundColor: practice.primary_color }}
                        layoutId="activeSection"
                      />
                    )}
                  </button>
                </motion.div>
              ))}

              {/* CTA Buttons */}
              <motion.div
                className="flex items-center gap-2 ml-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <motion.a
                  href={`tel:${practice.contact_phone}`}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    scrolled 
                      ? 'text-gray-700 hover:bg-gray-100' 
                      : 'text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Phone className="w-4 h-4" />
                </motion.a>
                
                <motion.button
                  onClick={() => handleNavClick('#booking')}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 flex items-center gap-1.5 animate-heartbeat"
                  style={{ backgroundColor: practice.primary_color }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Book Now
                </motion.button>
              </motion.div>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center gap-2">
              <a
                href={`tel:${practice.contact_phone}`}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  scrolled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <Phone className="w-4 h-4" />
              </a>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  scrolled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <motion.div
                  animate={isOpen ? { rotate: 180 } : { rotate: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </motion.div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-16 left-0 right-0 bg-white shadow-xl z-40 lg:hidden overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="space-y-1">
                {navLinks.map((link, index) => (
                  <motion.button
                    key={link.label}
                    onClick={() => handleNavClick(link.href)}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    {link.label}
                  </motion.button>
                ))}
                
                <motion.div
                  className="pt-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: navLinks.length * 0.05 }}
                >
                  <button
                    onClick={() => handleNavClick('#booking')}
                    className="w-full px-4 py-3 rounded-lg text-white font-medium transition-all duration-300"
                    style={{ backgroundColor: practice.primary_color }}
                  >
                    Book Appointment
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}