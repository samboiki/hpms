import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface PracticeUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title: string;
  staff_title: string | null;
  hpcsa_number: string | null;
  avatar: string | null;
  practice_role: string;
}

export function usePracticeUsers(practiceId: string) {
  return useQuery<PracticeUser[]>({
    queryKey: ['practice-users', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role,
          job_title,
          staff_title,
          hpcsa_number,
          avatar,
          user_practice_assignments!inner(
            role
          )
        `)
        .eq('user_practice_assignments.practice_id', practiceId)
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;

      // Transform the data to flatten the practice role
      return (data || []).map(user => ({
        ...user,
        practice_role: user.user_practice_assignments?.[0]?.role || user.role,
        user_practice_assignments: undefined
      })).sort((a, b) => {
        // Sort by priority: owners/admins first, then doctors, then others
        const getPriority = (user: any) => {
          if (['owner', 'admin'].includes(user.practice_role)) return 1;
          if (user.role === 'doctor') return 2;
          return 3;
        };
        
        return getPriority(a) - getPriority(b);
      });
    },
    enabled: !!practiceId,
  });
}