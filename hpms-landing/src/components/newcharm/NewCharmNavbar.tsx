import React, { useState, useEffect } from 'react';
import { Link } from 'react-scroll';
import { Icon } from '@iconify/react';

interface NewCharmNavbarProps {
  logo?: string;
}

const NewCharmNavbar: React.FC<NewCharmNavbarProps> = ({ logo }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Services', to: 'services' },
    { name: 'About', to: 'about' },
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
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            {logo ? (
              <img src={logo} alt="NewCharm Dental" className="h-10 w-auto" />
            ) : (
              <div className="flex items-center space-x-2">
                <Icon icon="solar:tooth-bold" className="w-8 h-8 text-[#7C3AED]" />
                <span className="text-2xl font-light tracking-wide text-gray-900">
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
                smooth={true}
                duration={500}
                offset={-80}
                className="text-gray-700 hover:text-[#7C3AED] transition-colors duration-300 cursor-pointer text-sm font-medium tracking-wide"
              >
                {link.name}
              </Link>
            ))}
            <button className="ml-6 px-6 py-2.5 bg-[#7C3AED] text-white rounded-full hover:bg-[#6B21A8] transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md">
              Book Appointment
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2"
          >
            <Icon
              icon={mobileMenuOpen ? "solar:close-square-bold" : "solar:hamburger-menu-bold"}
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
                smooth={true}
                duration={500}
                offset={-80}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-gray-700 hover:text-[#7C3AED] transition-colors duration-300 cursor-pointer font-medium"
              >
                {link.name}
              </Link>
            ))}
            <button className="w-full mt-4 px-6 py-3 bg-[#7C3AED] text-white rounded-full hover:bg-[#6B21A8] transition-all duration-300 font-medium">
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NewCharmNavbar;