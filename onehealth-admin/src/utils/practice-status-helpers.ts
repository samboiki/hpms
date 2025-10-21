import type { PracticeStatus, KanbanColumn } from '../types/practice.types'

// Status configuration with colors and icons
export const statusConfig: Record<PracticeStatus, {
  label: string
  icon: string
  color: string
  bgColor: string
  textColor: string
  badgeBg: string
  badgeText: string
}> = {
  lead: {
    label: 'Lead',
    icon: 'solar:lightbulb-bolt-bold-duotone',
    color: 'rgb(59, 130, 246)', // blue-500
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800'
  },
  contacted: {
    label: 'Contacted',
    icon: 'solar:phone-calling-bold-duotone',
    color: 'rgb(168, 85, 247)', // purple-500
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800'
  },
  qualified: {
    label: 'Qualified',
    icon: 'solar:verified-check-bold-duotone',
    color: 'rgb(99, 102, 241)', // indigo-500
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800'
  },
  onboarding: {
    label: 'Onboarding',
    icon: 'solar:course-up-bold-duotone',
    color: 'rgb(249, 115, 22)', // orange-500
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800'
  },
  active: {
    label: 'Active',
    icon: 'solar:shield-check-bold-duotone',
    color: '#00c1d0',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800'
  },
  inactive: {
    label: 'Inactive',
    icon: 'solar:pause-circle-bold-duotone',
    color: 'rgb(107, 114, 128)', // gray-500
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-800'
  }
}

// Get status configuration
export function getStatusConfig(status: PracticeStatus) {
  return statusConfig[status] || statusConfig.lead
}

// Get status label
export function getStatusLabel(status: PracticeStatus): string {
  return statusConfig[status]?.label || status
}

// Get status color
export function getStatusColor(status: PracticeStatus): string {
  return statusConfig[status]?.color || 'rgb(107, 114, 128)'
}

// Get next possible statuses for a given status
export function getNextStatuses(currentStatus: PracticeStatus): PracticeStatus[] {
  // Allow all status transitions for Kanban flexibility
  const allStatuses: PracticeStatus[] = ['lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive']
  return allStatuses.filter(status => status !== currentStatus)
}

// Check if status transition is valid
export function isValidStatusTransition(from: PracticeStatus, to: PracticeStatus): boolean {
  // Allow all transitions except to the same status
  return from !== to
}

// Get action label for status transition
export function getTransitionActionLabel(from: PracticeStatus, to: PracticeStatus): string {
  const transitionLabels: Record<string, string> = {
    'lead-contacted': 'Mark as Contacted',
    'lead-qualified': 'Mark as Qualified',
    'lead-inactive': 'Mark as Inactive',
    'contacted-qualified': 'Mark as Qualified',
    'contacted-lead': 'Move to Lead',
    'contacted-inactive': 'Mark as Inactive',
    'qualified-onboarding': 'Start Onboarding',
    'qualified-contacted': 'Move to Contacted',
    'qualified-inactive': 'Mark as Inactive',
    'onboarding-active': 'Activate Practice',
    'onboarding-qualified': 'Move to Qualified',
    'onboarding-inactive': 'Mark as Inactive',
    'active-inactive': 'Deactivate Practice',
    'inactive-lead': 'Reactivate as Lead',
    'inactive-contacted': 'Reactivate as Contacted'
  }

  return transitionLabels[`${from}-${to}`] || `Move to ${getStatusLabel(to)}`
}

// Initialize Kanban columns
export function initializeKanbanColumns(): Omit<KanbanColumn, 'practices'>[] {
  return [
    {
      id: 'lead',
      title: 'Lead',
      icon: 'solar:lightbulb-bolt-bold-duotone',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'contacted',
      title: 'Contacted',
      icon: 'solar:phone-calling-bold-duotone',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'qualified',
      title: 'Qualified',
      icon: 'solar:verified-check-bold-duotone',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      id: 'onboarding',
      title: 'Onboarding',
      icon: 'solar:course-up-bold-duotone',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'active',
      title: 'Active',
      icon: 'solar:shield-check-bold-duotone',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    {
      id: 'inactive',
      title: 'Inactive',
      icon: 'solar:pause-circle-bold-duotone',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    }
  ]
}