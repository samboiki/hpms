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
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? mode === 'list' 
                      ? 'text-white border-white'
                      : 'text-purple-600 border-purple-600'
                    : mode === 'list'
                      ? 'text-white/80 border-transparent hover:text-white'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                
                {/* Count badge */}
                {count !== undefined && count > 0 && (
                  <span 
                    className={`
                      px-2 py-0.5 text-xs font-bold rounded-full ml-1
                      ${mode === 'list'
                        ? 'bg-white/20 text-white border border-white/30'
                        : isActive 
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }
                    `}>
                    {count}
                  </span>
                )}
              </button>
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