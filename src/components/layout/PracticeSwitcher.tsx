import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, Building2, Crown, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface PracticeSwitcherProps {
  className?: string;
}

const PracticeSwitcher: React.FC<PracticeSwitcherProps> = ({ className = '' }) => {
  const { 
    user, 
    selectedPracticeId, 
    switchPractice, 
    getUserPractices, 
    isSuperAdmin 
  } = useAuthStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [practices, setPractices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && (isSuperAdmin() || user.practice_id)) {
      loadPractices();
    }
  }, [user]);

  const loadPractices = async () => {
    setLoading(true);
    try {
      const userPractices = await getUserPractices();
      setPractices(userPractices);
    } catch (error) {
      console.error('Error loading practices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePracticeSwitch = async (practiceId: string) => {
    const success = await switchPractice(practiceId);
    if (success) {
      setIsOpen(false);
      // Optionally trigger a page refresh or data reload
      window.location.reload();
    }
  };

  const getCurrentPractice = () => {
    if (!selectedPracticeId && !user?.practice_id) {
      return isSuperAdmin() ? { name: 'All Practices', slug: 'admin-view' } : null;
    }
    
    const currentId = selectedPracticeId || user?.practice_id;
    return practices.find(p => p.id === currentId) || null;
  };

  const currentPractice = getCurrentPractice();

  // Don't show switcher if user has no access to multiple practices
  if (!isSuperAdmin() && practices.length <= 1) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent transition-colors"
      >
        <div className="flex items-center space-x-2">
          {isSuperAdmin() && !selectedPracticeId ? (
            <Crown className="w-4 h-4 text-yellow-500" />
          ) : (
            <Building2 className="w-4 h-4 text-gray-500" />
          )}
          <span className="max-w-32 truncate">
            {currentPractice?.name || 'Select Practice'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-2">
              {/* Super Admin View */}
              {isSuperAdmin() && (
                <>
                  <button
                    onClick={() => handlePracticeSwitch('')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors ${
                      !selectedPracticeId ? 'bg-[#01b9d4] text-white hover:bg-[#0196be]' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <div className="text-left">
                        <p className="font-medium">Admin View</p>
                        <p className="text-xs opacity-75">All Practices</p>
                      </div>
                    </div>
                    {!selectedPracticeId && <Check className="w-4 h-4" />}
                  </button>
                  
                  <div className="my-2 border-t border-gray-200" />
                </>
              )}

              {/* Practice List */}
              {loading ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  Loading practices...
                </div>
              ) : practices.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  No practices available
                </div>
              ) : (
                practices.map((practice) => (
                  <button
                    key={practice.id}
                    onClick={() => handlePracticeSwitch(practice.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors ${
                      selectedPracticeId === practice.id || (!selectedPracticeId && user?.practice_id === practice.id)
                        ? 'bg-[#01b9d4] text-white hover:bg-[#0196be]' 
                        : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4" />
                      <div className="text-left">
                        <p className="font-medium truncate">{practice.name}</p>
                        <p className="text-xs opacity-75">{practice.city}</p>
                      </div>
                    </div>
                    {(selectedPracticeId === practice.id || (!selectedPracticeId && user?.practice_id === practice.id)) && 
                      <Check className="w-4 h-4" />
                    }
                  </button>
                ))
              )}

              {/* Admin Settings Link */}
              {isSuperAdmin() && (
                <>
                  <div className="my-2 border-t border-gray-200" />
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      // Navigate to admin settings
                      window.location.href = '/admin/practices';
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Manage Practices</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PracticeSwitcher;