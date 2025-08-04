'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import Image from 'next/image'

const footerLinks = {
  product: {
    title: 'Product',
    links: [
      { name: 'Features', href: '#features' },
      { name: 'Pricing', href: '#pricing' },
      { name: 'Integrations', href: '#integrations' },
      { name: 'API', href: '#api' },
    ],
  },
  solutions: {
    title: 'Solutions',
    links: [
      { name: 'Clinics', href: '#clinics' },
      { name: 'Hospitals', href: '#hospitals' },
      { name: 'Dental Practices', href: '#dental' },
      { name: 'Multi-Branch', href: '#multi-branch' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { name: 'Documentation', href: '/docs' },
      { name: 'Blog', href: '/blog' },
      { name: 'Support Center', href: '/support' },
      { name: 'API Reference', href: '/api' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { name: 'About Us', href: '/about' },
      { name: 'Careers', href: '/careers' },
      { name: 'Contact', href: '/contact' },
      { name: 'Partners', href: '/partners' },
    ],
  },
}

const socialLinks = [
  { icon: 'mdi:facebook', href: '#', label: 'Facebook' },
  { icon: 'mdi:twitter', href: '#', label: 'Twitter' },
  { icon: 'mdi:linkedin', href: '#', label: 'LinkedIn' },
  { icon: 'mdi:instagram', href: '#', label: 'Instagram' },
]

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Logo and Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/onehealthlogo-Photoroom.png"
                alt="OneHealth"
                width={150}
                height={40}
                className="h-10 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-gray-400 mb-6 max-w-sm">
              Transforming healthcare practice management in Namibia with innovative technology and unparalleled support.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon icon={social.icon} className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h3 className="font-semibold text-white mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="hover:text-white transition-colors inline-flex items-center group"
                    >
                      <span>{link.name}</span>
                      <Icon 
                        icon="solar:arrow-right-linear" 
                        className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" 
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter Section */}
        <div className="mt-12 pt-12 border-t border-gray-800">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Stay updated</h3>
              <p className="text-gray-400">
                Get the latest updates on healthcare technology and OneHealth features.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
              >
                Subscribe
              </motion.button>
            </div>
          </div>
        </div>

        {/* Certifications and Compliance */}
        <div className="mt-12 pt-12 border-t border-gray-800">
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-gray-400">
              <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 text-green-500" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Icon icon="solar:lock-keyhole-bold-duotone" className="w-6 h-6 text-blue-500" />
              <span>SOC 2 Type II</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Icon icon="solar:verified-check-bold-duotone" className="w-6 h-6 text-purple-500" />
              <span>ISO 27001</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Icon icon="solar:safe-square-bold-duotone" className="w-6 h-6 text-orange-500" />
              <span>256-bit Encryption</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gray-950 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500">
              © 2025 OneHealth. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/cookies" className="hover:text-white transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}