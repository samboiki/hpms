'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { User, Session } from '@supabase/supabase-js'
import { Database } from '@/types/database'

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
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [practices, setPractices] = useState<Practice[]>([])
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  // Get current practice
  const currentPractice = practices.find(p => p.id === currentPracticeId) || practices[0] || null

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    }
  }

  // Fetch user practices
  const fetchPractices = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_practice_assignments')
        .select(`
          *,
          practices (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error

      const practiceList = (data as (UserPracticeAssignment & { practices: Practice })[])
        .map(assignment => assignment.practices)

      setPractices(practiceList)
    } catch (error) {
      console.error('Error fetching practices:', error)
      setPractices([])
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchProfile(session.user.id)
        fetchPractices(session.user.id)
      }

      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchProfile(session.user.id)
        fetchPractices(session.user.id)
      } else {
        setProfile(null)
        setPractices([])
        setCurrentPracticeId(null)
      }

      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, userData: Partial<UserProfile>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const switchPractice = (practiceId: string) => {
    setCurrentPracticeId(practiceId)
  }

  const refreshProfile = () => {
    if (user?.id) {
      fetchProfile(user.id)
      fetchPractices(user.id)
    }
  }

  const value = {
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