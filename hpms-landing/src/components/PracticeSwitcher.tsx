'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Building, Stethoscope, Sparkles, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PracticeOption {
  slug: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const practiceOptions: PracticeOption[] = [
  {
    slug: 'newcharm-dental',
    name: 'NewCharm Dental',
    description: 'Premium dental care in Windhoek',
    icon: Sparkles,
    color: '#00BCD4'
  },
  {
    slug: 'dr-polina-aesthetics',
    name: 'Dr. Polina Aesthetics',
    description: 'Advanced aesthetic treatments',
    icon: Heart,
    color: '#EC4899'
  },
  {
    slug: 'cityclinic',
    name: 'City Clinic',
    description: 'Comprehensive medical care',
    icon: Building,
    color: '#3B82F6'
  },
  {
    slug: 'coastalmed',
    name: 'Coastal Medical',
    description: 'Family healthcare services',
    icon: Stethoscope,
    color: '#10B981'
  }
];

interface PracticeSwitcherProps {
  currentPractice: string;
  className?: string;
}

export default function PracticeSwitcher({ currentPractice, className = "" }: PracticeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const current = practiceOptions.find(p => p.slug === currentPractice) || practiceOptions[0];

  const handleSwitch = (practiceSlug: string) => {
    // Use query parameter for immediate switching
    const url = new URL(window.location.href);
    url.searchParams.set('practice', practiceSlug);
    router.push(url.toString());
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Current Practice Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white hover:bg-white/20 transition-colors"
      >
        <current.icon className="w-5 h-5" />
        <span className="font-medium hidden sm:block">{current.name}</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-20"
            >
              <div className="p-3">
                <div className="text-sm font-medium text-gray-500 px-3 py-2">
                  Switch Practice
                </div>
                
                {practiceOptions.map((practice) => {
                  const Icon = practice.icon;
                  const isCurrent = practice.slug === currentPractice;
                  
                  return (
                    <motion.button
                      key={practice.slug}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSwitch(practice.slug)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        isCurrent 
                          ? 'bg-gray-50 border-2 border-gray-200' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: practice.color + '20' }}
                      >
                        <Icon 
                          className="w-5 h-5"
                          style={{ color: practice.color }}
                        />
                      </div>
                      
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900">
                          {practice.name}
                          {isCurrent && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {practice.description}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                  💡 Pro tip: Use <code className="bg-gray-200 px-1 rounded">?practice=newcharm-dental</code> in URL
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}