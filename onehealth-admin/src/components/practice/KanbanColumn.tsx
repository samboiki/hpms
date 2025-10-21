import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Icon } from '@iconify/react'
import type { Practice, PracticeStatus } from '../../types/practice.types'
import { KanbanPracticeCard } from './KanbanPracticeCard'

interface KanbanColumnProps {
  id: PracticeStatus
  title: string
  icon: string
  color: string
  bgColor: string
  practices: Practice[]
  onViewDetails?: (practice: Practice) => void
}

export function KanbanColumn({
  id,
  title,
  icon,
  color,
  bgColor,
  practices,
  onViewDetails
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  // Calculate total monthly revenue for this status
  const totalRevenue = practices.reduce((sum, practice) => {
    // Use custom pricing if available, otherwise default to R1,600
    const monthlyPremium = practice.total_monthly_premium || practice.monthly_premium || 1600
    return sum + monthlyPremium
  }, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <div className={`${bgColor} rounded-t-xl p-4 border-b-2 ${color.replace('text-', 'border-')}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon icon={icon} className={`w-5 h-5 ${color}`} />
            <h3 className={`font-semibold ${color}`}>{title}</h3>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bgColor} ${color} border-2 ${color.replace('text-', 'border-')}`}>
            {practices.length}
          </span>
        </div>
        {/* Total Revenue */}
        <div className={`text-xs ${color} font-medium mt-1 flex items-center gap-1`}>
          <Icon icon="solar:wallet-money-bold-duotone" className="w-3.5 h-3.5" />
          <span>R{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-3 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100/50 rounded-b-xl ${
          isOver ? 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50' : ''
        }`}
        style={{
          minHeight: '500px',
          maxHeight: 'calc(100vh - 320px)'
        }}
      >
        <SortableContext
          items={practices.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {practices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Icon icon="solar:folder-open-bold-duotone" className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No practices</p>
            </div>
          ) : (
            practices.map((practice) => (
              <KanbanPracticeCard
                key={practice.id}
                practice={practice}
                onViewDetails={onViewDetails}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}