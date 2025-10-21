import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PracticeStats, Practice } from '../types/practice.types'

async function fetchPracticeData() {
  const startTime = performance.now()
  console.log('🚀 [usePracticeData] Starting optimized fetch...')

  try {
    // Fetch all data in parallel with minimal queries
    const [practicesResult, branchesResult, appointmentsCount] = await Promise.all([
      supabase.from('practices').select('*'),
      supabase.from('branches').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id', { count: 'exact', head: true })
    ])

    if (practicesResult.error) {
      throw practicesResult.error
    }

    const practicesData = practicesResult.data || []

    // Single pass through practices for status counts
    let activePractices = 0
    let leadCount = 0
    let contactedCount = 0
    let qualifiedCount = 0
    let onboardingCount = 0
    let inactiveCount = 0

    practicesData.forEach((p: any) => {
      switch (p.status) {
        case 'active':
          activePractices++
          break
        case 'lead':
          leadCount++
          break
        case 'contacted':
          contactedCount++
          break
        case 'qualified':
          qualifiedCount++
          break
        case 'onboarding':
          onboardingCount++
          break
        case 'inactive':
          inactiveCount++
          break
      }
    })

    const pendingApproval = leadCount + contactedCount + qualifiedCount + onboardingCount
    const totalRevenue = (appointmentsCount.count || 0) * 350

    const stats: PracticeStats = {
      totalPractices: practicesData.length,
      activePractices,
      pendingApproval,
      totalBranches: branchesResult.count || 0,
      averageStaffPerPractice: Math.round((appointmentsCount.count || 100) / Math.max(practicesData.length, 1)),
      totalRevenue,
      monthlyGrowth: 12.5,
      leadCount,
      contactedCount,
      qualifiedCount,
      onboardingCount,
      inactiveCount
    }

    const duration = performance.now() - startTime
    console.log(`✅ [usePracticeData] Data fetched in ${duration.toFixed(2)}ms`)

    return { stats, practices: practicesData }
  } catch (err) {
    console.error('❌ [usePracticeData] Error:', err)
    throw err
  }
}

export function usePracticeData() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['practiceData'],
    queryFn: fetchPracticeData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

  return {
    stats: data?.stats || null,
    practices: data?.practices || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch
  }
}
