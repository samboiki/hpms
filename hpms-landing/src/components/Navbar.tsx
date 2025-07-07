'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Phone, Calendar, ChevronDown, Globe, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { Practice } from '@/lib/tenants';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumButton from '@/components/ui/PremiumButton';
import { extractColorsFromLogo, ExtractedColors } from '@/utils/colorExtractor';

interface NavbarProps {
  practice: Practice;
}

export default function Navbar({ practice }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [colors, setColors] = useState<ExtractedColors | null>(null);

  // Extract colors from logo
  useEffect(() => {
    if (practice.logo_url) {
      extractColorsFromLogo(practice.logo_url).then(setColors);
    }
  }, [practice.logo_url]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      // Update active section based on scroll position
      const sections = ['hero', 'services', 'about', 'testimonials', 'booking', 'contact'];
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
    { label: 'About Us', href: '#about' },
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'Contact', href: '#contact' }
  ];

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80; // Height of navbar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-white/90 backdrop-blur-xl shadow-2xl border-b border-gray-100/50' 
            : 'bg-gradient-to-b from-black/20 to-transparent backdrop-blur-sm'
        }`}
        style={{
          background: scrolled 
            ? 'rgba(255, 255, 255, 0.95)' 
            : 'linear-gradient(to bottom, rgba(0, 0, 0, 0.3), transparent)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <motion.div 
              className="flex items-center"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link href="/" className="flex items-center space-x-3">
                {practice.logo_url ? (
                  <motion.img
                    src={practice.logo_url}
                    alt={practice.name}
                    className="h-16 w-auto object-contain"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  />
                ) : (
                  <>
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${practice.primary_color}20` }}
                    >
                      <Shield className="w-6 h-6" style={{ color: practice.primary_color }} />
                    </div>
                    <div>
                      <span 
                        className="text-2xl font-bold"
                        style={{ color: scrolled ? practice.primary_color : '#ffffff' }}
                      >
                        {practice.name}
                      </span>
                      <p className={`text-xs ${scrolled ? 'text-gray-600' : 'text-white/80'}`}>
                        Excellence in Healthcare
                      </p>
                    </div>
                  </>
                )}
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
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 relative group ${
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
              
              {/* Patient Portal Link */}
              <motion.a
                href={process.env.NEXT_PUBLIC_HPMS_URL || '#'}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'
                }`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Globe className="w-4 h-4" />
                Patient Portal
              </motion.a>

              {/* CTA Buttons */}
              <motion.div
                className="flex items-center gap-4 ml-6"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <PremiumButton
                  href={`tel:${practice.contact_phone}`}
                  variant={scrolled ? "outline" : "glass"}
                  size="small"
                  icon={<Phone className="w-4 h-4" />}
                  iconPosition="left"
                  className={scrolled ? 'border-gray-300 text-gray-700' : ''}
                >
                  <span className="hidden xl:inline">Call Now</span>
                  <span className="xl:hidden">Call</span>
                </PremiumButton>
                
                <PremiumButton
                  onClick={() => handleNavClick('#booking')}
                  variant="primary"
                  icon={
                    <motion.div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  }
                  gradient={colors?.gradients.primary || `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color || practice.primary_color} 100%)`}
                >
                  Book Appointment
                </PremiumButton>
              </motion.div>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center gap-3">
              <a
                href={`tel:${practice.contact_phone}`}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  scrolled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <Phone className="w-5 h-5" />
              </a>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  scrolled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5"
          style={{ 
            backgroundColor: practice.primary_color,
            scaleX: scrolled ? 1 : 0,
            transformOrigin: 'left'
          }}
          animate={{ scaleX: scrolled ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-20 left-0 right-0 bg-white shadow-xl z-40 lg:hidden overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="space-y-1">
                {navLinks.map((link, index) => (
                  <motion.button
                    key={link.label}
                    onClick={() => handleNavClick(link.href)}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors flex items-center justify-between group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    {link.label}
                    <ChevronDown className="w-4 h-4 -rotate-90 text-gray-400 group-hover:text-gray-600" />
                  </motion.button>
                ))}
                
                <motion.a
                  href={process.env.NEXT_PUBLIC_HPMS_URL || '#'}
                  className="w-full text-left px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors flex items-center justify-between group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: navLinks.length * 0.05 }}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Patient Portal
                  </span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-gray-400 group-hover:text-gray-600" />
                </motion.a>

                <motion.div
                  className="pt-4 mt-4 border-t border-gray-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: (navLinks.length + 1) * 0.05 }}
                >
                  <PremiumButton
                    onClick={() => handleNavClick('#booking')}
                    variant="primary"
                    fullWidth
                    icon={
                      <motion.div className="flex items-center gap-1">
                        <Sparkles className="w-5 h-5" />
                        <Calendar className="w-5 h-5" />
                      </motion.div>
                    }
                    gradient={colors?.gradients.primary || `linear-gradient(135deg, ${practice.primary_color} 0%, ${practice.secondary_color || practice.primary_color} 100%)`}
                  >
                    Book Premium Appointment
                  </PremiumButton>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}