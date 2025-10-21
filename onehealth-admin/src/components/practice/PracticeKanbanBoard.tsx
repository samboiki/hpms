import { useState, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { Icon } from '@iconify/react'
import type { Practice, PracticeStatus } from '../../types/practice.types'
import { KanbanColumn } from './KanbanColumn'
import { KanbanPracticeCard } from './KanbanPracticeCard'
import { initializeKanbanColumns } from '../../utils/practice-status-helpers'
import { usePracticeStatusUpdate } from '../../hooks/usePracticeStatusUpdate'
import { PracticeRegistrationModal } from './PracticeRegistrationModal'

interface PracticeKanbanBoardProps {
  practices: Practice[]
  onRefresh: () => void
}

export function PracticeKanbanBoard({ practices, onRefresh }: PracticeKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [optimisticPractices, setOptimisticPractices] = useState<Practice[]>(practices)
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const { updatePracticeStatus, isUpdating } = usePracticeStatusUpdate()

  // Sync optimistic state with props
  useEffect(() => {
    setOptimisticPractices(practices)
  }, [practices])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // Reduced from 8 for better responsiveness
      }
    })
  )

  // Filter practices by search query (use optimistic state)
  const filteredPractices = useMemo(() => {
    if (!searchQuery.trim()) return optimisticPractices

    const query = searchQuery.toLowerCase()
    return optimisticPractices.filter(
      (practice) =>
        practice.name?.toLowerCase().includes(query) ||
        practice.email?.toLowerCase().includes(query) ||
        practice.phone?.includes(query) ||
        practice.city?.toLowerCase().includes(query)
    )
  }, [optimisticPractices, searchQuery])

  // Group practices by status
  const columns = useMemo(() => {
    const baseColumns = initializeKanbanColumns()

    return baseColumns.map((column) => ({
      ...column,
      practices: filteredPractices.filter((practice) => practice.status === column.id)
    }))
  }, [filteredPractices])

  const activePractice = useMemo(
    () => optimisticPractices.find((practice) => practice.id === activeId),
    [activeId, optimisticPractices]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const practiceId = active.id as string

    // Check if we dropped on a column (status) or another card
    let newStatus: PracticeStatus

    // Check if over.id is a valid status
    const validStatuses: PracticeStatus[] = ['lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive']
    if (validStatuses.includes(over.id as PracticeStatus)) {
      newStatus = over.id as PracticeStatus
    } else {
      // Dropped on a card, find which column it belongs to
      const targetPractice = optimisticPractices.find((p) => p.id === over.id)
      if (targetPractice) {
        newStatus = targetPractice.status
      } else {
        setActiveId(null)
        return
      }
    }

    // Find the practice being dragged
    const practice = optimisticPractices.find((p) => p.id === practiceId)

    if (!practice) {
      setActiveId(null)
      return
    }

    // If status hasn't changed, do nothing
    if (practice.status === newStatus) {
      setActiveId(null)
      return
    }

    const oldStatus = practice.status

    // 🚀 OPTIMISTIC UPDATE: Update UI immediately
    setOptimisticPractices((prev) =>
      prev.map((p) =>
        p.id === practiceId ? { ...p, status: newStatus } : p
      )
    )

    setActiveId(null)

    // Update database in background
    const success = await updatePracticeStatus(practiceId, newStatus, oldStatus)

    if (!success) {
      // ⚠️ ROLLBACK: Revert to old status if update failed
      setOptimisticPractices((prev) =>
        prev.map((p) =>
          p.id === practiceId ? { ...p, status: oldStatus } : p
        )
      )
    }
    // No need to refresh - optimistic update already shows correct state
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleViewDetails = (practice: Practice) => {
    setSelectedPractice(practice)
    setShowDetailsModal(true)
  }

  const handleCloseModal = () => {
    setShowDetailsModal(false)
    setSelectedPractice(null)
    setIsEditMode(false)
  }

  const handleEditClick = () => {
    setShowDetailsModal(false)
    setIsEditMode(true)
  }

  const handleEditModalClose = () => {
    setIsEditMode(false)
    setSelectedPractice(null)
  }

  const handleEditSuccess = () => {
    setIsEditMode(false)
    setSelectedPractice(null)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Practice Pipeline</h2>
          <p className="text-gray-600 mt-1">Track practices from lead to active customer</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-80">
          <Icon
            icon="solar:magnifer-bold-duotone"
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search practices..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Subtle loading indicator - no blocking overlay */}
      {isUpdating && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 z-50 border border-gray-200">
          <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-gray-700 text-sm font-medium">Syncing...</span>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-6 gap-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              icon={column.icon}
              color={column.color}
              bgColor={column.bgColor}
              practices={column.practices}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>

        <DragOverlay>
          {activePractice ? (
            <div className="rotate-3 scale-105">
              <KanbanPracticeCard practice={activePractice} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty State */}
      {filteredPractices.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Icon icon="solar:magnifer-bug-bold-duotone" className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No practices found</h3>
          <p className="text-gray-500">Try adjusting your search query</p>
        </div>
      )}

      {practices.length === 0 && !searchQuery && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Icon icon="solar:buildings-3-bold-duotone" className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No practices yet</h3>
          <p className="text-gray-500">Register your first practice to get started</p>
        </div>
      )}

      {/* Practice Details Modal */}
      {showDetailsModal && selectedPractice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Icon icon="solar:buildings-3-bold-duotone" className="w-10 h-10" />
                <div>
                  <h2 className="text-2xl font-bold">{selectedPractice.name}</h2>
                  <p className="text-blue-100 capitalize">{selectedPractice.practice_type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              {/* Admin/Manager/Doctor Information - MOVED TO FIRST */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Icon icon="solar:user-id-bold-duotone" className="w-5 h-5 text-green-500" />
                  Practice Manager / Administrator
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Full Name</label>
                    <p className="text-gray-900 font-medium">{selectedPractice.admin_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Email Address</label>
                    <p className="text-gray-900 font-medium break-all">{selectedPractice.admin_email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Phone Number</label>
                    <p className="text-gray-900 font-medium">{selectedPractice.admin_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Role</label>
                    <p className="text-gray-900 font-medium capitalize">{selectedPractice.admin_role?.replace('_', ' ') || 'Administrator'}</p>
                  </div>
                  {selectedPractice.admin_job_title && (
                    <div>
                      <label className="text-xs text-gray-500">Job Title</label>
                      <p className="text-gray-900 font-medium">{selectedPractice.admin_job_title}</p>
                    </div>
                  )}
                  {selectedPractice.admin_hpcsa_number && (
                    <div>
                      <label className="text-xs text-gray-500">HPCSA Number</label>
                      <p className="text-gray-900 font-medium">{selectedPractice.admin_hpcsa_number}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-blue-500" />
                    Basic Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Registration Number</label>
                      <p className="text-gray-900 font-medium">{selectedPractice.registration_number || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Tax Number</label>
                      <p className="text-gray-900 font-medium">{selectedPractice.tax_number || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Status</label>
                      <p className="text-gray-900 font-medium capitalize">{selectedPractice.status}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Icon icon="solar:phone-calling-bold-duotone" className="w-5 h-5 text-purple-500" />
                    Contact Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Email</label>
                      <p className="text-gray-900 font-medium break-all">{selectedPractice.contact_email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <p className="text-gray-900 font-medium">{selectedPractice.contact_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Address</label>
                      <p className="text-gray-900 font-medium">
                        {[selectedPractice.address, selectedPractice.city, selectedPractice.country]
                          .filter(Boolean)
                          .join(', ') || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription & Pricing */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Icon icon="solar:crown-bold-duotone" className="w-5 h-5 text-amber-500" />
                  Subscription Details
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Tier</label>
                    <p className="text-gray-900 font-medium capitalize">{selectedPractice.subscription_tier || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Branches</label>
                    <p className="text-gray-900 font-medium">{selectedPractice.number_of_branches || 1}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Monthly Premium</label>
                    <p className="text-gray-900 font-medium">
                      R{(selectedPractice.total_monthly_premium || selectedPractice.monthly_premium || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedPractice.about_text && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-indigo-500" />
                    About
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{selectedPractice.about_text}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-8 py-4 rounded-b-2xl border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={handleEditClick}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium flex items-center gap-2"
              >
                <Icon icon="solar:pen-bold-duotone" className="w-5 h-5" />
                Edit Practice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Practice Modal - Using Registration Modal */}
      {isEditMode && selectedPractice && (
        <PracticeRegistrationModal
          isOpen={isEditMode}
          onClose={handleEditModalClose}
          onSuccess={handleEditSuccess}
          editMode={true}
          existingPractice={selectedPractice}
        />
      )}
    </div>
  )
}