import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: {
    value: number
    label: string
  }
  icon: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal'
  loading?: boolean
  onClick?: () => void
  sparkline?: ReactNode
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  icon,
  color,
  loading = false,
  onClick,
  sparkline
}: MetricCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
    teal: 'from-teal-500 to-teal-600'
  }

  const bgColorClasses = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50',
    orange: 'bg-orange-50',
    red: 'bg-red-50',
    indigo: 'bg-indigo-50',
    teal: 'bg-teal-50'
  }

  const iconColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    indigo: 'text-indigo-600',
    teal: 'text-teal-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={onClick ? { scale: 1.02 } : {}}
      className={`relative bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]}`} />

      <div className="p-6">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-20 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${bgColorClasses[color]}`}>
                <Icon icon={icon} className={`w-6 h-6 ${iconColorClasses[color]}`} />
              </div>
              {sparkline && (
                <div className="w-20 h-10">
                  {sparkline}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-gray-900">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </h3>
                {change && (
                  <span
                    className={`text-sm font-medium ${
                      change.value >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {change.value >= 0 ? '↑' : '↓'} {Math.abs(change.value)}%
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-gray-600">{title}</p>

              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}

              {change && (
                <p className="text-xs text-gray-500 mt-1">{change.label}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Hover effect overlay */}
      {onClick && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        />
      )}
    </motion.div>
  )
}

// Mini sparkline component for trends
export function MiniSparkline({ data, color }: { data: number[], color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${x},${y}`
    })
    .join(' ')

  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#${gradientId})`}
      />
    </svg>
  )
}