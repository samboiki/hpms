import { useState } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TabType } from '../types/practice.types'
import { usePracticeData } from '../hooks/usePracticeData'
import { StatsCard } from '../components/practice/StatsCard'
import { PracticeCard } from '../components/practice/PracticeCard'
import { PracticeRegistrationModal } from '../components/practice/PracticeRegistrationModal'
import { PracticeKanbanBoard } from '../components/practice/PracticeKanbanBoard'
import { PracticeSearchFilters } from '../components/practice/PracticeSearchFilters'
import { PracticeStatistics } from '../components/practice/PracticeStatistics'
import { PracticeProfileModal } from '../components/practice/PracticeProfileModal'
import { PracticeTableView } from '../components/practice/PracticeTableView'
import type { Practice } from '../types/practice.types'

export function PracticeManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('manage')
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const { stats, practices, loading, refetch } = usePracticeData()

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [practiceTypeFilter, setPracticeTypeFilter] = useState('')
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // View mode state (default to list/table)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const handleRegistrationSuccess = () => {
    refetch()
    setShowRegistrationForm(false)
  }

  const handleViewPractice = (practice: Practice) => {
    setSelectedPractice(practice)
    setIsProfileModalOpen(true)
  }

  const handleExportCSV = () => {
    console.log('Exporting to CSV...')
  }

  const handleExportExcel = () => {
    console.log('Exporting to Excel...')
  }

  // Filter practices
  const filteredPractices = practices.filter(practice => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        practice.name?.toLowerCase().includes(searchLower) ||
        practice.email?.toLowerCase().includes(searchLower) ||
        practice.city?.toLowerCase().includes(searchLower) ||
        practice.country?.toLowerCase().includes(searchLower) ||
        practice.phone?.toLowerCase().includes(searchLower)

      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter && practice.status !== statusFilter) {
      return false
    }

    // Practice type filter
    if (practiceTypeFilter && practice.practice_type !== practiceTypeFilter) {
      return false
    }

    return true
  })

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 relative" style={{
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)',
      backgroundSize: '20px 20px'
    }}>
      <div className="px-0 sm:px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Icon icon="solar:buildings-3-bold-duotone" className="w-8 h-8 text-white" />
              </div>
              Practice Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage healthcare practices and registrations</p>
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 border-x-0 sm:border-x overflow-hidden mx-0 sm:mx-0">
          <div className="grid grid-cols-3 gap-0 w-full">
            {[
              { id: 'overview', icon: 'solar:chart-bold-duotone', label: 'Overview' },
              { id: 'manage', icon: 'solar:buildings-bold-duotone', label: 'Manage' },
              { id: 'pipeline', icon: 'solar:course-up-bold-duotone', label: 'Pipeline' }
            ].map((tab, index) => {
              const isActive = activeTab === tab.id
              const isFirst = index === 0
              const isLast = index === 2

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize ${
                    isFirst ? 'rounded-l-xl' : ''
                  } ${
                    isLast ? 'rounded-r-xl' : ''
                  } ${
                    !isFirst ? '-ml-px' : ''
                  } flex-1 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg z-10'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon icon={tab.icon} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="text-[10px] sm:text-sm">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-6">
                  {/* Statistics */}
                  <PracticeStatistics stats={stats} />

                  {/* Additional Stats Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <StatsCard
                      title="Avg Staff/Practice"
                      value={stats?.averageStaffPerPractice || 0}
                      subtitle="Healthcare professionals"
                      icon="solar:users-group-rounded-bold-duotone"
                      loading={loading}
                    />
                    <StatsCard
                      title="Total Revenue"
                      value={`R${(stats?.totalRevenue || 0).toLocaleString()}`}
                      subtitle="Monthly recurring revenue"
                      icon="solar:wallet-money-bold-duotone"
                      trend={{ value: stats?.monthlyGrowth || 0, isPositive: true }}
                      loading={loading}
                    />
                    <StatsCard
                      title="Growth Rate"
                      value={`${stats?.monthlyGrowth || 0}%`}
                      subtitle="Month-over-month growth"
                      icon="solar:graph-up-bold-duotone"
                      trend={{ value: stats?.monthlyGrowth || 0, isPositive: true }}
                      loading={loading}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Manage Tab with Table/Grid View */}
            {activeTab === 'manage' && (
              <motion.div
                key="manage"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  {/* Search and Filters */}
                  <PracticeSearchFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    onAddPractice={() => setShowRegistrationForm(true)}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    practiceTypeFilter={practiceTypeFilter}
                    onPracticeTypeChange={setPracticeTypeFilter}
                    filteredPractices={filteredPractices}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onExportCSV={handleExportCSV}
                    onExportExcel={handleExportExcel}
                  />

                  {/* Table or Grid View */}
                  {viewMode === 'list' ? (
                    <PracticeTableView
                      practices={filteredPractices}
                      onViewPractice={handleViewPractice}
                      loading={loading}
                    />
                  ) : (
                    <div className="p-6">
                      {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {[...Array(6)].map((_, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                              <div className="animate-pulse">
                                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : filteredPractices.length === 0 ? (
                        <div className="text-center py-12">
                          <Icon icon="solar:buildings-3-bold-duotone" className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            {searchTerm || statusFilter || practiceTypeFilter ? 'No practices found' : 'No practices registered yet'}
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mb-4">
                            {searchTerm || statusFilter || practiceTypeFilter
                              ? 'Try adjusting your filters'
                              : 'Get started by registering your first healthcare practice.'}
                          </p>
                          <button
                            onClick={() => setShowRegistrationForm(true)}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all font-medium"
                          >
                            <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                            Register Practice
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredPractices.map((practice) => (
                            <div key={practice.id} onClick={() => handleViewPractice(practice)} className="cursor-pointer">
                              <PracticeCard practice={practice} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Pipeline Tab */}
            {activeTab === 'pipeline' && (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <PracticeKanbanBoard practices={practices} onRefresh={refetch} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Registration Form Modal */}
      <PracticeRegistrationModal
        isOpen={showRegistrationForm}
        onClose={() => setShowRegistrationForm(false)}
        onSuccess={handleRegistrationSuccess}
      />

      {/* Practice Profile Modal */}
      <PracticeProfileModal
        practice={selectedPractice}
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false)
          setSelectedPractice(null)
        }}
      />
    </div>
  )
}

export default PracticeManagement
