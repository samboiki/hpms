import React from 'react';
import { Icon } from '@iconify/react';
import { Practice } from '@/lib/tenants';
import { Link } from 'react-scroll';

interface NewCharmFooterProps {
  practice: Practice;
}

const NewCharmFooter: React.FC<NewCharmFooterProps> = ({ practice }) => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: 'Services', to: 'services' },
    { name: 'About Us', to: 'about' },
    { name: 'Testimonials', to: 'testimonials' },
    { name: 'Contact', to: 'contact' },
  ];

  const services = [
    'General Dentistry',
    'Cosmetic Dentistry',
    'Orthodontics',
    'Oral Surgery',
    'Emergency Care',
    'Preventive Care'
  ];

  const contactInfo = {
    phone: '+264 61 234 5678',
    email: 'info@newcharmdental.com',
    address: '123 Independence Avenue, Windhoek, Namibia',
    hours: [
      { day: 'Monday - Friday', time: '8:00 AM - 6:00 PM' },
      { day: 'Saturday', time: '9:00 AM - 2:00 PM' },
      { day: 'Sunday', time: 'Closed' }
    ]
  };

  const socialLinks = [
    { 
      icon: 'ri:facebook-circle-fill', 
      href: 'https://www.facebook.com/profile.php?id=100095192419707', 
      label: 'Facebook'
    },
    { 
      icon: 'ri:instagram-fill', 
      href: 'https://www.instagram.com/newcharm_dentalpractice/', 
      label: 'Instagram'
    },
    { 
      icon: 'ri:whatsapp-fill', 
      href: 'https://wa.me/264812345678', 
      label: 'WhatsApp'
    },
    { 
      icon: 'ri:mail-fill', 
      href: 'mailto:info@newcharmdental.com', 
      label: 'Email'
    }
  ];

  return (
    <footer className="bg-gradient-to-br from-gray-50 to-white pt-16 pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Company Info */}
          <div>
            <div className="mb-6">
              {practice.logo_url ? (
                <img src={practice.logo_url} alt={practice.name} className="h-32 w-auto" />
              ) : (
                <>
                  <Icon icon="solar:tooth-bold-duotone" className="w-8 h-8 text-[#32b9e5]" />
                  <span className="text-xl font-medium text-gray-900">NewCharm Dental</span>
                </>
              )}
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Your trusted partner for comprehensive dental care in Windhoek. 
              Creating beautiful smiles with advanced technology and compassionate care.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target={social.href.startsWith('http') ? '_blank' : undefined}
                  rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  aria-label={social.label}
                  className="w-10 h-10 bg-gradient-to-br from-[#32b9e5]/10 to-[#2aa8d3]/10 rounded-full shadow-md hover:shadow-lg flex items-center justify-center transition-all duration-300 hover:-translate-y-1 group hover:from-[#32b9e5] hover:to-[#2aa8d3]"
                >
                  <Icon 
                    icon={social.icon} 
                    className="w-5 h-5 text-[#32b9e5] transition-colors duration-300 group-hover:text-white" 
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-8 lg:mt-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.to}
                    smooth={true}
                    duration={500}
                    offset={-80}
                    className="text-gray-600 hover:text-[#32b9e5] transition-colors duration-300 cursor-pointer flex items-center group"
                  >
                    <Icon icon="solar:arrow-right-bold-duotone" className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.name}
                  </Link>
                </li>
              ))}
              <li>
                <a href="#" className="text-gray-600 hover:text-[#32b9e5] transition-colors duration-300 flex items-center group">
                  <Icon icon="solar:arrow-right-bold-duotone" className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div className="mt-8 lg:mt-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Our Services</h3>
            <ul className="space-y-3">
              {services.map((service) => (
                <li key={service}>
                  <a href="#" className="text-gray-600 hover:text-[#32b9e5] transition-colors duration-300 flex items-center group">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2 text-[#32b9e5]" />
                    {service}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="mt-8 lg:mt-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Contact Info</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Icon icon="solar:map-point-bold-duotone" className="w-5 h-5 text-[#32b9e5] mt-1 flex-shrink-0" />
                <p className="text-gray-600 text-sm">{contactInfo.address}</p>
              </div>
              <div className="flex items-center space-x-3">
                <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-[#32b9e5] flex-shrink-0" />
                <a href={`tel:${contactInfo.phone.replace(/\s/g, '')}`} className="text-gray-600 hover:text-[#32b9e5] transition-colors text-sm">
                  {contactInfo.phone}
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-[#32b9e5] flex-shrink-0" />
                <a href={`mailto:${contactInfo.email}`} className="text-gray-600 hover:text-[#32b9e5] transition-colors text-sm">
                  {contactInfo.email}
                </a>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Office Hours</h4>
                {contactInfo.hours.map((schedule, index) => (
                  <div key={index} className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>{schedule.day}</span>
                    <span>{schedule.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Banner */}
        <div className="bg-[#32b9e5] rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Icon icon="solar:siren-bold-duotone" className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <h4 className="font-semibold text-lg">Dental Emergency?</h4>
                <p className="text-white/90 text-sm">We offer same-day emergency appointments</p>
              </div>
            </div>
            <a
              href={`tel:${contactInfo.phone.replace(/\s/g, '')}`}
              className="px-6 py-3 bg-white text-[#32b9e5] rounded-full font-medium hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <Icon icon="solar:phone-calling-bold-duotone" className="w-5 h-5" />
              <span>Call Now</span>
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-gray-600 mb-4 md:mb-0">
              © {currentYear} NewCharm Dental. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-sm">
              <a href="#" className="text-gray-600 hover:text-[#32b9e5] transition-colors">Terms of Service</a>
              <a href="#" className="text-gray-600 hover:text-[#32b9e5] transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-600 hover:text-[#32b9e5] transition-colors">Cookie Policy</a>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Powered by <a href="https://onehealthsystems.com" className="text-[#32b9e5] hover:underline" target="_blank" rel="noopener noreferrer">OneHealthSystems</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default NewCharmFooter;