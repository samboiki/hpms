import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  BarChart3,
  User,
  FileText,
  Pill,
  Camera,
  FlaskConical,
  Scan,
  Wallet,
  History,
  Sparkles,
  Loader2,
  Bell,
  Menu,
  ChevronDown,
  X,
  MessageCircle,
  Mail,
  Edit
} from 'lucide-react';
import { Icon } from '@iconify/react';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
  hasNew?: boolean;
  loading?: boolean;
  tooltip?: string;
}

interface PatientModalTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  mode: 'list' | 'details';
  selectedPatient?: any;
  visits?: any[];
  medications?: any[];
  media?: any[];
  lab?: any[];
  imaging?: any[];
  billingData?: any[];
  loadingTabs?: string[];
  newDataTabs?: string[];
}

const listTabs: Tab[] = [
  {
    id: 'patients',
    label: 'Patients',
    icon: Users
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3
  }
];

const detailTabs: Tab[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: User,
    tooltip: 'Patient demographics and summary'
  },
  {
    id: 'encounters',
    label: 'Encounters',
    icon: FileText,
    tooltip: 'Visit history and clinical notes'
  },
  {
    id: 'medications',
    label: 'Medications',
    icon: Pill,
    tooltip: 'Prescribed medications and treatment plans'
  },
  {
    id: 'media',
    label: 'Media',
    icon: Camera,
    tooltip: 'Photos, videos, and media files'
  },
  {
    id: 'lab',
    label: 'Laboratory',
    icon: FlaskConical,
    tooltip: 'Lab tests and results'
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: Scan,
    tooltip: 'X-rays, CT scans, and imaging studies'
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: Wallet,
    tooltip: 'Insurance and payment information'
  },
  {
    id: 'audit',
    label: 'Audit Log',
    icon: History,
    tooltip: 'Access history and changes'
  }
];

const PatientModalTabs: React.FC<PatientModalTabsProps> = ({ 
  activeTab, 
  onTabChange, 
  mode,
  selectedPatient,
  visits = [],
  medications = [],
  media = [],
  lab = [],
  imaging = [],
  billingData = [],
  loadingTabs = [],
  newDataTabs = []
}) => {
  const tabs = mode === 'list' ? listTabs : detailTabs;
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys in a text field, notes box or dropdown move the cursor there; they used to
      // switch tabs instead (and the patient search box disappeared mid-typing)
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return;
      }
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      
      if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
        e.preventDefault();
        const nextTab = tabs[currentIndex + 1];
        onTabChange(nextTab.id);
        tabRefs.current[nextTab.id]?.focus();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        const prevTab = tabs[currentIndex - 1];
        onTabChange(prevTab.id);
        tabRefs.current[prevTab.id]?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabs, onTabChange]);
  
  // Touch/swipe support for mobile
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    
    if (isLeftSwipe && currentIndex < tabs.length - 1) {
      onTabChange(tabs[currentIndex + 1].id);
    }
    if (isRightSwipe && currentIndex > 0) {
      onTabChange(tabs[currentIndex - 1].id);
    }
  };
  
  // Get count for tabs with data
  const getTabCount = (tabId: string) => {
    switch (tabId) {
      case 'encounters':
        return visits.length;
      case 'medications':
        return medications.length;
      case 'media':
        return media.length;
      case 'lab':
        return lab.length;
      case 'imaging':
        return imaging.length;
      case 'billing':
        return billingData.length;
      default:
        return undefined;
    }
  };

  // Find active tab for mobile menu display
  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const ActiveIcon = activeTabData?.icon || User;



  return (
    <div 
      className={`${mode === 'list' ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-white border-b border-gray-200/50'} relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Horizontal Tabs for All Screen Sizes */}
      <div>
        <div className="px-4 sm:px-6">
          <div className="flex overflow-x-auto scrollbar-none sm:overflow-x-visible" role="tablist">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = getTabCount(tab.id);
            const isLoading = loadingTabs.includes(tab.id);
            const hasNewData = newDataTabs.includes(tab.id);
            const isHovered = hoveredTab === tab.id;
            
            return (
              <motion.button
                ref={el => tabRefs.current[tab.id] = el}
                key={tab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: 1, 
                  y: 0
                }}
                transition={{ 
                  opacity: { delay: index * 0.05, duration: 0.2 },
                  y: { delay: index * 0.05, duration: 0.2 }
                }}
                whileHover={{ 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isLoading && onTabChange(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className={`
                  flex-shrink-0 sm:flex-1 
                  flex items-center justify-center gap-2 
                  px-3 sm:px-4 py-4 
                  min-w-[100px] sm:min-w-0
                  min-h-[48px]
                  text-xs sm:text-sm font-medium 
                  border-b-2 transition-all duration-200 
                  relative group
                  touch-manipulation
                  ${
                  isActive
                    ? mode === 'list' 
                      ? 'text-white border-white bg-gradient-to-t from-white/20 to-white/5'
                      : 'text-purple-600 border-purple-600 bg-gradient-to-t from-purple-50/50 to-transparent'
                    : mode === 'list'
                      ? 'text-white/80 border-transparent hover:text-white hover:bg-white/10'
                      : 'text-gray-500 border-transparent hover:text-purple-600 hover:bg-purple-50/30'
                } ${isLoading ? 'cursor-wait' : 'cursor-pointer'}`}
                aria-label={tab.label}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
              >
                {/* Tooltip */}
                {tab.tooltip && isHovered && !isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none"
                  >
                    {tab.tooltip}
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                  </motion.div>
                )}
                
                {/* Loading state */}
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className={`w-4 h-4 transition-all duration-200 ${
                    isActive ? (mode === 'list' ? 'text-white' : 'text-purple-600') : ''
                  }`} />
                )}
                
                <span className="font-medium whitespace-nowrap text-xs sm:text-sm">{tab.label}</span>
                
                {/* New data indicator */}
                {hasNewData && !isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
                  />
                )}
                
                {/* Count badge */}
                {count !== undefined && count > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className={`
                      px-2 py-0.5 text-xs font-bold rounded-full ml-1
                      ${mode === 'list'
                        ? 'bg-white/20 text-white border border-white/30'
                        : isActive 
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-gray-200/70 text-gray-700'
                      }
                    `}>
                    {count}
                  </motion.span>
                )}
                
                {/* Active indicator */}
                {isActive && (
                  <>
                    {/* Bottom border shadow/glow */}
                    <motion.div
                      className="absolute -bottom-0.5 left-0 right-0 h-3 shadow-lg shadow-purple-500/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                    
                    {/* White rounded indicator */}
                    <motion.div
                      className="absolute -bottom-1.5 left-0 right-0 mx-auto w-8 h-1 bg-white rounded-full"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 32, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                    
                    {/* Simple active line indicator */}
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </>
                )}
              </motion.button>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hamburger Menu Component for Header Integration
interface HamburgerMenuProps {
  onSendMessage?: () => void;
  onSendEmail?: () => void;
  onEditProfile?: () => void;
  /** When set, Message is shown disabled with this reason (e.g. no cell number on file) */
  messageDisabledReason?: string | null;
  /** When set, Email is shown disabled with this reason (e.g. no email address on file) */
  emailDisabledReason?: string | null;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  onSendMessage,
  onSendEmail,
  onEditProfile,
  messageDisabledReason,
  emailDisabledReason
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!onSendMessage && !onSendEmail && !onEditProfile) {
    return null;
  }

  return (
    <>
      {/* Hamburger Menu Button */}
      <motion.button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="p-3 rounded-lg transition-all bg-white/20 text-white hover:bg-white/30"
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        title="Patient actions"
        aria-label="Patient actions"
      >
        <Icon 
          icon="solar:hamburger-menu-bold-duotone" 
          className="w-6 h-6"
        />
      </motion.button>

      {/* Slide-out Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Background Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, type: 'spring', damping: 25 }}
              className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-indigo-600">
                <h3 className="text-lg font-semibold text-white">Actions</h3>
                <motion.button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                  whileTap={{ scale: 0.95 }}
                  title="Close actions"
                  aria-label="Close actions"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Action Buttons Section */}
              <div className="py-4">
                {onSendMessage && (
                  <motion.button
                    initial={{ opacity: 0, x: 50 }}
                    // Dimmed when unavailable (an opacity class would be overridden by this animation)
                    animate={{ opacity: messageDisabledReason ? 0.6 : 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => {
                      onSendMessage();
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={!!messageDisabledReason}
                    className={`w-full flex items-center gap-3 px-4 py-4 transition-colors text-gray-700 border-b border-gray-100 ${
                      messageDisabledReason ? 'cursor-not-allowed' : 'hover:bg-purple-50'
                    }`}
                    whileHover={messageDisabledReason ? undefined : { x: 4 }}
                    whileTap={messageDisabledReason ? undefined : { scale: 0.98 }}
                  >
                    <MessageCircle className="w-6 h-6 text-purple-500" />
                    <div className="text-left">
                      <span className="font-medium text-lg">Message</span>
                      <p className="text-sm text-gray-500 mt-0.5">{messageDisabledReason || 'Send SMS to patient'}</p>
                    </div>
                  </motion.button>
                )}
                
                {onSendEmail && (
                  <motion.button
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: emailDisabledReason ? 0.6 : 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    onClick={() => {
                      onSendEmail();
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={!!emailDisabledReason}
                    className={`w-full flex items-center gap-3 px-4 py-4 transition-colors text-gray-700 border-b border-gray-100 ${
                      emailDisabledReason ? 'cursor-not-allowed' : 'hover:bg-blue-50'
                    }`}
                    whileHover={emailDisabledReason ? undefined : { x: 4 }}
                    whileTap={emailDisabledReason ? undefined : { scale: 0.98 }}
                  >
                    <Mail className="w-6 h-6 text-blue-500" />
                    <div className="text-left">
                      <span className="font-medium text-lg">Email</span>
                      <p className="text-sm text-gray-500 mt-0.5">{emailDisabledReason || 'Send email to patient'}</p>
                    </div>
                  </motion.button>
                )}
                
                {onEditProfile && (
                  <motion.button
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => {
                      onEditProfile();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-green-50 transition-colors text-gray-700"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Edit className="w-6 h-6 text-green-500" />
                    <div className="text-left">
                      <span className="font-medium text-lg">Edit</span>
                      <p className="text-sm text-gray-500 mt-0.5">Edit patient profile</p>
                    </div>
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default PatientModalTabs;

// Add scrollbar hide utility
const style = `
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
`;

if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = style;
  document.head.appendChild(styleElement);
}