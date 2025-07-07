import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr'
import { Database } from '@/types/database'

// Client-side Supabase instance
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Default client for use in client components
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side Supabase instance for Server Components
export function createServerComponentClient() {
  const { cookies } = require('next/headers')
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// Server-side Supabase instance for Route Handlers
export function createRouteHandlerClient() {
  const { cookies } = require('next/headers')
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

// Supabase Admin Client (for server-side operations that need elevated permissions)
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() {
          return undefined
        },
        set() {},
        remove() {},
      },
    }
  )
}

// Utility functions for common operations
export const supabaseQueries = {
  // Practices
  getPractices: () => ['practices'],
  getPractice: (id: string) => ['practices', id],
  
  // Users
  getUsers: () => ['users'],
  getUser: (id: string) => ['users', id],
  getUserProfile: (id: string) => ['user-profiles', id],
  
  // User Practice Assignments
  getUserPracticeAssignments: (userId: string) => ['user-practice-assignments', userId],
  getPracticeUsers: (practiceId: string) => ['practice-users', practiceId],
  
  // Tariffs
  getTariffs: (practiceId?: string) => practiceId ? ['tariffs', practiceId] : ['tariffs'],
  getTariff: (id: string) => ['tariffs', id],
  getTariffHistory: (tariffId: string) => ['tariff-history', tariffId],
  
  // Patients
  getPatients: (practiceId?: string) => practiceId ? ['patients', practiceId] : ['patients'],
  getPatient: (id: string) => ['patients', id],
  
  // Appointments
  getAppointments: (practiceId?: string) => practiceId ? ['appointments', practiceId] : ['appointments'],
  getAppointment: (id: string) => ['appointments', id],
  getUserAppointments: (userId: string) => ['appointments', 'user', userId],
  
  // Billing
  getBillingRecords: (practiceId?: string) => practiceId ? ['billing', practiceId] : ['billing'],
  getBillingRecord: (id: string) => ['billing', id],
  
  // Audit Logs
  getAuditLogs: (practiceId?: string) => practiceId ? ['audit-logs', practiceId] : ['audit-logs'],
  
  // Practice Settings
  getPracticeSettings: (practiceId: string) => ['practice-settings', practiceId],
  getPracticeSetting: (practiceId: string, category: string, key: string) => [
    'practice-settings', 
    practiceId, 
    category, 
    key
  ],
  
  // Dashboard
  getDashboardStats: (practiceId?: string) => practiceId ? ['dashboard-stats', practiceId] : ['dashboard-stats'],
}

// Common Supabase error types
export interface SupabaseError {
  message: string
  details?: string
  hint?: string
  code?: string
}

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any): SupabaseError {
  if (error?.message) {
    return {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }
  }
  
  return {
    message: 'An unexpected error occurred',
    details: 'Please try again later',
  }
}

// Type helpers for Supabase responses
export type SupabaseResponse<T> = {
  data: T | null
  error: SupabaseError | null
}

export type SupabaseListResponse<T> = {
  data: T[] | null
  error: SupabaseError | null
  count?: number | null
}