import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import type { StatsCardProps  } from '../../types/practice.types'

export function StatsCard({ title, value, subtitle, icon, trend, loading }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="premium-card rounded-2xl p-6 relative overflow-hidden group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-white/80 to-white/60 rounded-xl shadow-sm">
            <Icon icon={icon} className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            )}
          </div>
        </div>
        {trend && !loading && (
          <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${
            trend.isPositive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <Icon
              icon={trend.isPositive ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'}
              className="w-3 h-3"
            />
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mt-3">{subtitle}</p>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-blue-500/50" />
    </motion.div>
  )
}