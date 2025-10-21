import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import type { Practice } from '../../types/practice.types'
import { getStatusConfig } from '../../utils/practice-status-helpers'

interface KanbanPracticeCardProps {
  practice: Practice
  onViewDetails?: (practice: Practice) => void
}

export const KanbanPracticeCard = memo(function KanbanPracticeCard({ practice, onViewDetails }: KanbanPracticeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: practice.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const statusConfig = getStatusConfig(practice.status)

  const handleCardClick = () => {
    if (!isDragging && onViewDetails) {
      onViewDetails(practice)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderColor: statusConfig.color,
        borderStyle: 'dashed',
        borderWidth: '1px'
      }}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm mb-1 truncate">
            {practice.name}
          </h4>
          <p className="text-xs text-gray-600 capitalize">
            {practice.practice_type.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Drag handle icon */}
        <div className="ml-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Icon icon="solar:hamburger-menu-bold-duotone" className="w-4 h-4" />
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Icon icon="solar:letter-bold-duotone" className="w-3.5 h-3.5 text-gray-400" />
          <span className="truncate">{practice.contact_email || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Icon icon="solar:phone-bold-duotone" className="w-3.5 h-3.5 text-gray-400" />
          <span>{practice.contact_phone || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Icon icon="solar:map-point-bold-duotone" className="w-3.5 h-3.5 text-gray-400" />
          <span className="truncate">{practice.city}, {practice.country}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {new Date(practice.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })}
        </span>

        <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
          <span>Click to view</span>
          <Icon icon="solar:arrow-right-bold-duotone" className="w-3 h-3" />
        </div>
      </div>

      {/* Subscription Tier Badge */}
      <div className="mt-2 pt-2 border-t border-gray-100">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
          <Icon icon="solar:crown-bold-duotone" className="w-3 h-3" />
          {practice.subscription_tier}
        </span>
      </div>
    </div>
  )
})