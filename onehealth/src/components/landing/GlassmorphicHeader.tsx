'use client'

import { useState, useEffect } from 'react'
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ServicesDropdown } from './ServicesDropdown'

const navItems = [
  { name: 'Templates', href: '#templates', hasDropdown: true },
  { name: 'Learn', href: '#learn', hasDropdown: true },
  { name: 'Gallery', href: '#gallery' },
  { name: 'Use cases', href: '#use-cases', hasDropdown: true },
  { name: 'Resources', href: '#resources', hasDropdown: true },
  { name: 'Support', href: '#support', hasDropdown: true },
  { name: 'Business', href: '#business' },
  { name: 'Pricing', href: '#pricing' },
]

export function GlassmorphicHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50)
  })

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <nav className={`
          w-full transition-all duration-300
          ${isScrolled ? 'py-3 bg-black/20 backdrop-blur-xl' : 'py-5 bg-white/10 backdrop-blur-md'}
        `}>
          <div className="w-full px-6 lg:px-8">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Image
                    src="/onehealthlogo-Photoroom.png"
                    alt="OneHealth"
                    width={100}
                    height={30}
                    className="h-6 md:h-7 w-auto"
                    priority
                  />
                </motion.div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative"
                    onMouseEnter={() => item.hasDropdown && setActiveDropdown(item.name)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <Link
                      href={item.href}
                      className="nav-item px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>{item.name}</span>
                      {item.hasDropdown && (
                        <Icon 
                          icon="solar:alt-arrow-down-linear" 
                          className="w-3 h-3 opacity-60" 
                        />
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* CTA Button */}
              <motion.div
                className="hidden lg:block"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link href="/auth/register">
                  <Button className="cta-button text-sm font-semibold px-5 py-2.5">
                    Start for free
                  </Button>
                </Link>
              </motion.div>

              {/* Mobile Menu Toggle */}
              <motion.button
                className="lg:hidden p-2 text-white"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                whileTap={{ scale: 0.95 }}
              >
                <Icon
                  icon={isMobileMenuOpen ? "solar:close-bold" : "solar:hamburger-menu-bold"}
                  className="w-6 h-6"
                />
              </motion.button>
            </div>
          </div>
        </nav>

        {/* Services Dropdown - moved outside nav for proper positioning */}
        <div 
          onMouseEnter={() => setActiveDropdown('Templates')} 
          onMouseLeave={() => setActiveDropdown(null)}
        >
          {activeDropdown === 'Templates' && (
            <ServicesDropdown 
              isOpen={true} 
              onClose={() => setActiveDropdown(null)} 
            />
          )}
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <motion.div
        className="fixed inset-0 z-40 lg:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: isMobileMenuOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: isMobileMenuOpen ? 'auto' : 'none' }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Menu Panel */}
        <motion.div
          className="absolute right-0 top-0 h-full w-80 max-w-full"
          initial={{ x: '100%' }}
          animate={{ x: isMobileMenuOpen ? 0 : '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="h-full bg-gray-900 shadow-2xl">
            <div className="p-6">
              {/* Close Button */}
              <div className="flex justify-end mb-8">
                <motion.button
                  className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon icon="solar:close-bold" className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Mobile Navigation Items */}
              <nav className="space-y-3">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      className="block px-4 py-3 rounded-lg text-white font-medium hover:bg-white/10 transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}

                {/* Mobile CTA Button */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="pt-4"
                >
                  <Link href="/auth/register" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button className="w-full cta-button">
                      Start for free
                    </Button>
                  </Link>
                </motion.div>
              </nav>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <style jsx global>{`
        .nav-item {
          position: relative;
        }

        .nav-item::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          width: 0;
          height: 2px;
          background: white;
          transform: translateX(-50%);
          transition: width 0.3s ease;
        }

        .nav-item:hover::after {
          width: 80%;
        }

        .cta-button {
          background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .cta-button:hover {
          background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
      `}</style>
    </>
  )
}