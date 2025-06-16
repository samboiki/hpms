import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  BarChart3,
  User,
  FileText,
  Activity,
  TestTube,
  FolderOpen,
  Receipt,
  History,
  Sparkles
} from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
}

interface PatientModalTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  mode: 'list' | 'details';
  selectedPatient?: any;
  visits?: any[];
  vitals?: any[];
  labResults?: any[];
  documents?: any[];
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
    icon: User
  },
  {
    id: 'encounters',
    label: 'Encounters',
    icon: FileText
  },
  {
    id: 'vitals',
    label: 'Vitals',
    icon: Activity
  },
  {
    id: 'results',
    label: 'Lab Results',
    icon: TestTube
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FolderOpen
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: Receipt
  },
  {
    id: 'audit',
    label: 'Audit Log',
    icon: History
  }
];

const PatientModalTabs: React.FC<PatientModalTabsProps> = ({ 
  activeTab, 
  onTabChange, 
  mode,
  selectedPatient,
  visits = [],
  vitals = [],
  labResults = [],
  documents = []
}) => {
  const tabs = mode === 'list' ? listTabs : detailTabs;
  
  // Get count for tabs with data
  const getTabCount = (tabId: string) => {
    switch (tabId) {
      case 'encounters':
        return visits.length;
      case 'vitals':
        return vitals.length;
      case 'results':
        return labResults.length;
      case 'documents':
        return documents.length;
      default:
        return undefined;
    }
  };

  return (
    <div className={`${mode === 'list' ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-white border-b border-gray-200'} relative`}>
      <div className="px-6">
        <div className="flex w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = getTabCount(tab.id);
            
            return (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ 
                  scale: 1.02,
                  y: -2,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300 relative ${
                  isActive
                    ? mode === 'list' 
                      ? 'text-white border-white bg-gradient-to-t from-white/10 to-transparent'
                      : 'text-purple-600 border-purple-600 bg-gradient-to-t from-purple-50 to-transparent'
                    : mode === 'list'
                      ? 'text-white/80 border-transparent hover:text-white hover:bg-white/10'
                      : 'text-gray-500 border-transparent hover:text-purple-600 hover:bg-purple-50/50'
                }`}
              >
                <motion.div
                  animate={isActive ? { 
                    rotate: [0, 360], 
                    scale: [1, 1.1, 1],
                  } : { rotate: 0, scale: 1 }}
                  transition={{ 
                    duration: isActive ? 0.8 : 0.3, 
                    ease: "easeInOut",
                    repeat: isActive ? Infinity : 0,
                    repeatDelay: 3
                  }}
                >
                  <Icon className={`w-4 h-4 transition-all duration-300 ${
                    isActive ? (mode === 'list' ? 'text-white drop-shadow-sm' : 'text-purple-600 drop-shadow-sm') : ''
                  }`} />
                </motion.div>
                <span className="hidden sm:inline font-medium">{tab.label}</span>
                
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
                          : 'bg-gray-200 text-gray-700'
                      }
                    `}>
                    {count}
                  </motion.span>
                )}
                
                {/* Active tab glow effect with fuzzing */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: [0.3, 0.6, 0.3], 
                      scale: [0.95, 1.05, 0.95],
                      background: mode === 'list' 
                        ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.05)"]
                        : ["rgba(147,51,234,0.05)", "rgba(147,51,234,0.15)", "rgba(147,51,234,0.05)"]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 rounded-t-lg pointer-events-none"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
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