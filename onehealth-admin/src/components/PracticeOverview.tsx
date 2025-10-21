import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { formatDistanceToNow } from 'date-fns'

interface Practice {
  id: string
  name: string
  patientCount: number
  visitCount: number
  revenue: number
  lastActivity: string
}

interface PracticeOverviewProps {
  practices: Practice[]
  loading?: boolean
  onPracticeClick?: (practiceId: string) => void
}

export function PracticeOverview({
  practices,
  loading = false,
  onPracticeClick
}: PracticeOverviewProps) {
  const formatCurrency = (value: number) => `R${value.toLocaleString()}`

  const getStatusColor = (lastActivity: string) => {
    const hoursSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60)
    if (hoursSinceActivity < 24) return 'bg-green-500'
    if (hoursSinceActivity < 72) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Practice Performance</h3>
          <p className="text-sm text-gray-500 mt-1">Overview of all practice metrics</p>
        </div>
        <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
          View All
          <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {practices.map((practice, index) => (
            <motion.div
              key={practice.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => onPracticeClick?.(practice.id)}
              className={`relative p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all ${
                onPracticeClick ? 'cursor-pointer' : ''
              }`}
            >
              {/* Status indicator */}
              <div className="absolute top-4 right-4">
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(practice.lastActivity)}`} />
                  <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor(practice.lastActivity)} animate-ping opacity-75`} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
                      <Icon icon="solar:buildings-bold-duotone" className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{practice.name}</h4>
                      <p className="text-xs text-gray-500">
                        Last active {formatDistanceToNow(new Date(practice.lastActivity), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Patients</p>
                      <div className="flex items-center gap-1">
                        <Icon icon="solar:users-group-rounded-bold-duotone" className="w-4 h-4 text-blue-500" />
                        <p className="text-sm font-semibold text-gray-900">{practice.patientCount}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Visits</p>
                      <div className="flex items-center gap-1">
                        <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4 text-green-500" />
                        <p className="text-sm font-semibold text-gray-900">{practice.visitCount}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Revenue</p>
                      <div className="flex items-center gap-1">
                        <Icon icon="solar:wallet-bold-duotone" className="w-4 h-4 text-purple-500" />
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(practice.revenue)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Performance</p>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (practice.visitCount / practice.patientCount) * 20)}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {practices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Icon icon="solar:buildings-bold-duotone" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No practice data available</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// Practice Quick Actions Component
export function PracticeQuickActions() {
  const actions = [
    {
      title: 'Add Practice',
      icon: 'solar:add-square-bold-duotone',
      color: 'bg-blue-600 hover:bg-blue-700',
      description: 'Register new practice'
    },
    {
      title: 'Manage Licenses',
      icon: 'solar:license-bold-duotone',
      color: 'bg-green-600 hover:bg-green-700',
      description: 'Update subscriptions'
    },
    {
      title: 'View Reports',
      icon: 'solar:chart-square-bold-duotone',
      color: 'bg-purple-600 hover:bg-purple-700',
      description: 'Analytics & insights'
    },
    {
      title: 'System Settings',
      icon: 'solar:settings-bold-duotone',
      color: 'bg-orange-600 hover:bg-orange-700',
      description: 'Configure system'
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.4 }}
      className="bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        <p className="text-sm text-gray-500 mt-1">Common administrative tasks</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((action, index) => (
          <motion.button
            key={action.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${action.color} text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors`}
          >
            <Icon icon={action.icon} className="w-8 h-8" />
            <span className="text-xs font-medium">{action.title}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}