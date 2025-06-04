'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { User, Session } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type UserPracticeAssignment = Database['public']['Tables']['user_practice_assignments']['Row']
type Practice = Database['public']['Tables']['practices']['Row']

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  practices: Practice[]
  currentPractice: Practice | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<{ error: any }>
  signOut: () => Promise<void>
  switchPractice: (practiceId: string) => void
  refreshProfile: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null)
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get user profile
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  // Get user practice assignments
  const { data: practiceAssignments = [] } = useQuery({
    queryKey: ['user-practice-assignments', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      
      const { data, error } = await supabase
        .from('user_practice_assignments')
        .select(`
          *,
          practices (*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        
      if (error) throw error
      return data as (UserPracticeAssignment & { practices: Practice })[]
    },
    enabled: !!user?.id,
  })

  // Extract practices from assignments
  const practices = practiceAssignments.map(assignment => assignment.practices)
  
  // Get current practice
  const currentPractice = practices.find(p => p.id === currentPracticeId) || practices[0] || null

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)

      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        setCurrentPracticeId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, queryClient])

  // Set default practice when practices are loaded
  useEffect(() => {
    if (practices.length > 0 && !currentPracticeId) {
      // Use primary practice if available, otherwise first practice
      const primaryPractice = practiceAssignments.find(a => a.is_primary)
      setCurrentPracticeId(primaryPractice?.practice_id || practices[0].id)
    }
  }, [practices, practiceAssignments, currentPracticeId])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, userData: Partial<UserProfile>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) return { error }

    // Create user profile if signup was successful
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email,
          ...userData,
        })

      if (profileError) {
        console.error('Error creating user profile:', profileError)
      }
    }

    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    setCurrentPracticeId(null)
  }

  const switchPractice = (practiceId: string) => {
    if (practices.some(p => p.id === practiceId)) {
      setCurrentPracticeId(practiceId)
      // You might want to store this in localStorage for persistence
      localStorage.setItem('currentPracticeId', practiceId)
    }
  }

  const refreshProfile = () => {
    refetchProfile()
  }

  // Load saved practice preference on mount
  useEffect(() => {
    const savedPracticeId = localStorage.getItem('currentPracticeId')
    if (savedPracticeId && practices.some(p => p.id === savedPracticeId)) {
      setCurrentPracticeId(savedPracticeId)
    }
  }, [practices])

  const value: AuthContextType = {
    user,
    session,
    profile,
    practices,
    currentPractice,
    isLoading,
    signIn,
    signUp,
    signOut,
    switchPractice,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}