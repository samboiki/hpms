import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PracticeStatus } from '../types/practice.types'
import { isValidStatusTransition } from '../utils/practice-status-helpers'

interface UsePracticeStatusUpdateReturn {
  updatePracticeStatus: (practiceId: string, newStatus: PracticeStatus, currentStatus?: PracticeStatus) => Promise<boolean>
  isUpdating: boolean
  error: string | null
}

export function usePracticeStatusUpdate(): UsePracticeStatusUpdateReturn {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updatePracticeStatus = async (
    practiceId: string,
    newStatus: PracticeStatus,
    currentStatus?: PracticeStatus
  ): Promise<boolean> => {
    try {
      setIsUpdating(true)
      setError(null)

      // Validate status transition (frontend validation only - no DB fetch)
      if (currentStatus && !isValidStatusTransition(currentStatus, newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`)
      }

      // Update practice status directly
      const { error: updateError } = await supabase
        .from('practices')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', practiceId)

      if (updateError) {
        throw updateError
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update practice status'
      setError(errorMessage)
      console.error('Error updating practice status:', err)
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    updatePracticeStatus,
    isUpdating,
    error
  }
}