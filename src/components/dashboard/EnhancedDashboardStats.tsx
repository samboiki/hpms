import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useVisitsStore } from '../../stores/visitsStore';
import { 
  Users, Calendar, Activity, AlertCircle, 
  CheckCircle, Clock, UserCheck, Play
} from 'lucide-react';

interface EnhancedDashboardStatsProps {
  practiceId?: string;
}

interface StatsData {
  totalPatients: number;
  todayVisits: number;
  unconfirmedBookings: number;
  checkedInPatients: number;
  readyPatients: number;
  inProgressVisits: number;
  completedToday: number;
  weeklyVisits: number;
  monthlyVisits: number;
}

const EnhancedDashboardStats: React.FC<EnhancedDashboardStatsProps> = ({ practiceId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData>({
    totalPatients: 0,
    todayVisits: 0,
    unconfirmedBookings: 0,
    checkedInPatients: 0,
    readyPatients: 0,
    inProgressVisits: 0,
    completedToday: 0,
    weeklyVisits: 0,
    monthlyVisits: 0
  });

  const { 
    unconfirmedCount, 
    checkedInCount, 
    readyCount, 
    inProgressCount, 
    todayCount,
    fetchTodayVisits,
    subscribeToVisitChanges
  } = useVisitsStore();

  useEffect(() => {
    fetchAllStats();
    fetchTodayVisits();
    
    if (practiceId) {
      subscribeToVisitChanges(practiceId);
    }

    // Set up real-time updates
    const subscription = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits' },
        () => fetchAllStats()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'patients' },
        () => fetchAllStats()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [practiceId]);

  const fetchAllStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const queries = await Promise.all([
        // Total patients
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .then(({ count }) => count || 0),

        // Today's visits
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .or(`scheduled_date.eq.${today},visit_date.eq.${today}`)
          .eq('is_cancelled', false)
          .then(({ count }) => count || 0),

        // Unconfirmed bookings
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('is_scheduled', true)
          .eq('is_confirmed', false)
          .eq('is_cancelled', false)
          .then(({ count }) => count || 0),

        // Checked in patients
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('is_checked_in', true)
          .eq('is_ready', false)
          .eq('is_cancelled', false)
          .neq('status', 'completed')
          .then(({ count }) => count || 0),

        // Ready patients
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('is_ready', true)
          .neq('status', 'in-progress')
          .neq('status', 'completed')
          .then(({ count }) => count || 0),

        // In progress visits
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in-progress')
          .then(({ count }) => count || 0),

        // Completed today
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .or(`scheduled_date.eq.${today},visit_date.eq.${today}`)
          .eq('status', 'completed')
          .then(({ count }) => count || 0),

        // Weekly visits
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_date', weekAgo)
          .eq('is_cancelled', false)
          .then(({ count }) => count || 0),

        // Monthly visits
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_date', monthAgo)
          .eq('is_cancelled', false)
          .then(({ count }) => count || 0),
      ]);

      setStats({
        totalPatients: queries[0],
        todayVisits: queries[1],
        unconfirmedBookings: queries[2],
        checkedInPatients: queries[3],
        readyPatients: queries[4],
        inProgressVisits: queries[5],
        completedToday: queries[6],
        weeklyVisits: queries[7],
        monthlyVisits: queries[8]
      });

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Patients',
      value: stats.totalPatients,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Unconfirmed Bookings',
      value: stats.unconfirmedBookings,
      icon: AlertCircle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      urgent: stats.unconfirmedBookings > 0
    },
    {
      title: "Today's Visits",
      value: stats.todayVisits,
      icon: Calendar,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Checked In',
      value: stats.checkedInPatients,
      icon: UserCheck,
      color: 'bg-teal-500',
      textColor: 'text-teal-600',
      bgColor: 'bg-teal-50'
    },
    {
      title: 'Ready for Doctor',
      value: stats.readyPatients,
      icon: Activity,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      pulse: stats.readyPatients > 0
    },
    {
      title: 'In Progress',
      value: stats.inProgressVisits,
      icon: Play,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Completed Today',
      value: stats.completedToday,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'This Week',
      value: stats.weeklyVisits,
      icon: Calendar,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 shadow-sm animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error Loading Stats</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchAllStats}
          className="mt-2 text-red-600 hover:text-red-700 text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Urgent Alerts */}
      {stats.unconfirmedBookings > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-medium text-orange-800">
              {stats.unconfirmedBookings} Booking{stats.unconfirmedBookings > 1 ? 's' : ''} Require{stats.unconfirmedBookings === 1 ? 's' : ''} Confirmation
            </h3>
          </div>
          <p className="text-orange-700 text-sm mt-1">
            New booking requests from your website need to be reviewed and confirmed.
          </p>
        </motion.div>
      )}

      {stats.readyPatients > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <h3 className="font-medium text-purple-800">
              {stats.readyPatients} Patient{stats.readyPatients > 1 ? 's' : ''} Ready for Doctor
            </h3>
          </div>
          <p className="text-purple-700 text-sm mt-1">
            Checked-in patients are waiting to see the doctor.
          </p>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const IconComponent = stat.icon;
          
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${
                stat.urgent ? 'ring-2 ring-orange-200' : ''
              } ${stat.pulse ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </p>
                  <p className={`text-3xl font-bold ${stat.textColor}`}>
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <IconComponent className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
              
              {/* Additional context for some stats */}
              {stat.title === "Today's Visits" && stats.completedToday > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    {stats.completedToday} completed ({Math.round((stats.completedToday / stats.todayVisits) * 100)}%)
                  </p>
                </div>
              )}
              
              {stat.title === 'Unconfirmed Bookings' && stat.value > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-orange-600 font-medium">
                    Action required
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Quick Summary */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Practice Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">This Week</span>
            <span className="font-semibold text-gray-900">{stats.weeklyVisits} visits</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">This Month</span>
            <span className="font-semibold text-gray-900">{stats.monthlyVisits} visits</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Active Patients</span>
            <span className="font-semibold text-gray-900">
              {stats.checkedInPatients + stats.readyPatients + stats.inProgressVisits}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboardStats;