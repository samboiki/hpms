import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePractice } from '../contexts/PracticeContext';
import { useAuthStore } from '../stores/authStore';

// Import existing components
import FollowUpAutomationTab from '../components/encounters/FollowUpAutomationTab';
import { AdvancedEncountersDashboard } from '../components/encounters/AdvancedEncountersDashboard';
import { EncountersView } from '../components/encounters/EncountersView';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';
import { PageTabs } from '../components/ui/PageTabs';
import { UserAvatar } from '../components/layout/ProfileMenu';
import {
  diaryDayLink,
  encountersParams,
  encountersPath,
  ENCOUNTERS_TABS,
  readEncountersPlace,
  readVisitFocus,
  type EncountersPlace,
  type VisitFocus
} from '../utils/encounters/encounterLinks';

// Main Encounters Page Component
const Encounters: React.FC = () => {
  const { practiceId } = usePractice();
  const { user, logout } = useAuthStore();
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // The tab, the analytics view and the period live in the address (?tab=analytics&view=visits&period=30d), so the
  // screens a figure opens can link straight back to the same figures
  const place = readEncountersPlace(searchParams);
  const activeTab = place.tab;
  // The visits a figure on Analytics opened, kept with this history entry: Back from a patient finds the same list
  const visitFocus = useMemo(() => readVisitFocus(location.state), [location.state]);

  // A tab, view or period change replaces the entry (no Back step per click) and leaves a figure's list
  const showPlace = (next: Partial<EncountersPlace>) => setSearchParams(encountersParams({ ...place, ...next }), { replace: true });
  // A figure's visits in the encounters list: a new entry, so Back returns to the figures
  const openVisits = (focus: VisitFocus) => navigate(encountersPath({ ...place, tab: 'encounters' }), { state: { visitFocus: focus } });
  const analyticsPath = encountersPath({ ...place, tab: 'analytics' });

  const tabIcons = {
    analytics: "solar:chart-square-bold-duotone",
    encounters: "solar:document-text-bold-duotone",
    automations: "solar:settings-minimalistic-bold-duotone",
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header Section (aligned with the content below; stacks cleanly on phones) */}
        <div>
          <div className="py-1 md:py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex-none p-2.5 md:p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
                  <Icon icon="solar:clipboard-list-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-semibold text-gray-800">Encounters</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Real-time practice analytics and insights</p>
                </div>
              </div>

              {/* User Avatar with Dropdown - Same as Dashboard */}
              {user && (
                <div className="relative flex-none">
                  <button
                    ref={avatarButtonRef}
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                    aria-label="Open profile menu"
                  >
                    {/* Pulsating outer ring */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full opacity-50"></div>

                    {/* Avatar circle */}
                    <div className="relative h-12 w-12 md:h-16 md:w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                      {/* The user's photo, or their initials: never a stranger's stock photo standing in for them */}
                      <UserAvatar avatar={user.avatar} name={user.name} />
                    </div>
                  </button>

                  {/* Premium Dropdown Modal - Using Portal for maximum z-index control */}
                  {isAvatarDropdownOpen && createPortal(
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] animate-in fade-in duration-200"
                        onClick={() => setIsAvatarDropdownOpen(false)}
                      />

                      {/* Premium Modal Dropdown */}
                      <div
                        style={{
                          position: 'fixed',
                          top: avatarButtonRef.current ? avatarButtonRef.current.getBoundingClientRect().bottom + 16 : 0,
                          right: avatarButtonRef.current ? window.innerWidth - avatarButtonRef.current.getBoundingClientRect().right : 0,
                          zIndex: 99999
                        }}
                        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px] animate-in fade-in slide-in-from-top-3 duration-300"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
                          <button
                            onClick={() => setIsAvatarDropdownOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label="Close"
                          >
                            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>

                        {/* User Info Card */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
                          <div className="flex items-start gap-4">
                            <div className="relative flex-shrink-0">
                              <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <UserAvatar avatar={user.avatar} name={user.name} />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-base font-semibold text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>{user.email}</p>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white mt-1">
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Logout Button */}
                        <button
                          onClick={() => {
                            setIsAvatarDropdownOpen(false);
                            handleLogout();
                          }}
                          className="w-full px-4 py-3 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl transition-colors font-semibold hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:logout-3-bold-duotone" className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Tab Navigation - Professional Style */}
        <PageTabs
          tabs={ENCOUNTERS_TABS.map((tab) => ({
            key: tab,
            label: tab.charAt(0).toUpperCase() + tab.slice(1),
            icon: tabIcons[tab]
          }))}
          active={activeTab}
          onChange={(tab) => showPlace({ tab })}
          label="Encounters sections"
          activeClassName="bg-gradient-to-r from-cyan-500 to-blue-500"
        />

        {/* Tab Content */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AdvancedEncountersDashboard
                  view={place.view}
                  period={place.period}
                  onViewChange={(view) => showPlace({ view })}
                  onPeriodChange={(period) => showPlace({ period })}
                  onOpenVisits={openVisits}
                  onOpenDiaryDay={(dayKey) => navigate(diaryDayLink(dayKey, analyticsPath))}
                />
              </motion.div>
            )}

            {activeTab === 'encounters' && (
              <motion.div
                key="encounters"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EncountersView
                  focus={visitFocus}
                  onBackToAnalytics={() => navigate(analyticsPath)}
                  onShowAll={() => showPlace({ tab: 'encounters' })}
                />
              </motion.div>
            )}


            {activeTab === 'automations' && (
              <motion.div
                key="automations"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <FollowUpAutomationTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Visit Tracker - Same as Dashboard */}
      {practiceId && <FloatingVisitTracker practiceId={practiceId} selectedDate={new Date()} />}
    </div>
  );
};

export default Encounters;
