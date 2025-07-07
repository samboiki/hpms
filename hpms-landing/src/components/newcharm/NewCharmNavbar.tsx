import React, { useState, useEffect } from 'react';
import { Link, Events, scrollSpy } from 'react-scroll';
import { Icon } from '@iconify/react';
import { Practice } from '@/lib/tenants';
import { useBookingModal } from '@/contexts/BookingModalContext';

interface NewCharmNavbarProps {
  practice: Practice;
}

const NewCharmNavbar: React.FC<NewCharmNavbarProps> = ({ practice }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const { openBookingModal } = useBookingModal();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    // Setup scroll spy for active section detection
    Events.scrollEvent.register('begin', (to) => {
      setActiveSection(to);
    });

    Events.scrollEvent.register('end', (to) => {
      setActiveSection(to);
    });

    scrollSpy.update();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      Events.scrollEvent.remove('begin');
      Events.scrollEvent.remove('end');
    };
  }, []);

  const navLinks = [
    { name: 'Services', to: 'services' },
    { name: 'About', to: 'about' },
    { name: 'Team', to: 'team' },
    { name: 'Testimonials', to: 'testimonials' },
    { name: 'Contact', to: 'contact' },
  ];

  return (
    <nav
      className={`fixed w-full top-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm py-4'
          : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            {practice.logo_url ? (
              <img src={practice.logo_url} alt={practice.name} className="h-24 md:h-28 w-auto" />
            ) : (
              <div className="flex items-center space-x-3">
                <Icon icon="solar:tooth-bold-duotone" className="w-16 h-16 md:w-20 md:h-20 text-[#32b9e5]" />
                <span className="text-2xl md:text-3xl font-light tracking-wide text-gray-900">
                  NewCharm <span className="font-normal">Dental</span>
                </span>
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-10">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                spy={true}
                smooth={true}
                duration={500}
                offset={-80}
                onSetActive={() => setActiveSection(link.to)}
                className={`relative text-sm font-medium tracking-wide cursor-pointer transition-all duration-300 ${
                  activeSection === link.to
                    ? 'text-[#32b9e5]'
                    : 'text-gray-700 hover:text-[#32b9e5]'
                }`}
              >
                {link.name}
                {activeSection === link.to && (
                  <span
                    className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#32b9e5] transition-all duration-300"
                  />
                )}
              </Link>
            ))}
            <button
              onClick={() => openBookingModal()}
              className="ml-6 px-6 py-2.5 bg-gradient-to-r from-[#32b9e5] to-[#2aa8d3] text-white rounded-xl hover:shadow-lg transition-all duration-300 text-sm font-medium transform hover:-translate-y-0.5"
            >
              Book Appointment
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2"
          >
            <Icon
              icon={mobileMenuOpen ? "solar:close-square-bold-duotone" : "solar:hamburger-menu-bold-duotone"}
              className="w-6 h-6 text-gray-900"
            />
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden absolute left-0 right-0 top-full bg-white shadow-lg transition-all duration-300 ${
            mobileMenuOpen
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          <div className="p-6 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                spy={true}
                smooth={true}
                duration={500}
                offset={-80}
                onClick={() => setMobileMenuOpen(false)}
                className={`block font-medium transition-colors duration-300 cursor-pointer ${
                  activeSection === link.to
                    ? 'text-[#32b9e5]'
                    : 'text-gray-700 hover:text-[#32b9e5]'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                openBookingModal();
              }}
              className="block w-full mt-4 px-6 py-3 bg-gradient-to-r from-[#32b9e5] to-[#2aa8d3] text-white rounded-xl text-center font-medium shadow-md"
            >
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NewCharmNavbar;