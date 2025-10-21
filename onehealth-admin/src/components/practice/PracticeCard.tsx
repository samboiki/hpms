import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import type { Practice } from '../../types/practice.types'

interface PracticeCardProps {
  practice: Practice
}

export function PracticeCard({ practice }: PracticeCardProps) {
  return (
    <motion.div
      key={practice.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{practice.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{practice.practice_type.replace('_', ' ')}</p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          practice.status === 'active'
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            : practice.status === 'pending'
            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
        }`}>
          {practice.status}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center space-x-2">
          <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 text-gray-400" />
          <span>{practice.email}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 text-gray-400" />
          <span>{practice.phone}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Icon icon="solar:map-point-bold-duotone" className="w-4 h-4 text-gray-400" />
          <span>{practice.city}, {practice.country}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(practice.created_at).toLocaleDateString()}
        </span>
        <div className="flex space-x-2">
          <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}