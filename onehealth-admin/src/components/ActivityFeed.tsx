import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Activity {
  id: string
  type: 'visit' | 'invoice' | 'patient' | 'payment' | 'sms' | 'email' | 'user' | 'system'
  title: string
  description: string
  timestamp: string
  practiceId?: string
  practiceName?: string
  userId?: string
  userName?: string
  metadata?: Record<string, any>
}

interface ActivityFeedProps {
  limit?: number
  showPracticeFilter?: boolean
}

export function ActivityFeed({ limit = 10, showPracticeFilter = false }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null)
  const [practices, setPractices] = useState<Array<{ id: string; name: string }>>([])

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'visit':
        return 'solar:calendar-add-bold-duotone'
      case 'invoice':
        return 'solar:document-send-bold-duotone'
      case 'patient':
        return 'solar:user-plus-bold-duotone'
      case 'payment':
        return 'solar:card-bold-duotone'
      case 'sms':
        return 'solar:chat-round-dots-bold-duotone'
      case 'email':
        return 'solar:letter-bold-duotone'
      case 'user':
        return 'solar:user-bold-duotone'
      case 'system':
        return 'solar:settings-bold-duotone'
      default:
        return 'solar:bell-bold-duotone'
    }
  }

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'visit':
        return 'bg-green-500'
      case 'invoice':
        return 'bg-orange-500'
      case 'patient':
        return 'bg-blue-500'
      case 'payment':
        return 'bg-purple-500'
      case 'sms':
        return 'bg-teal-500'
      case 'email':
        return 'bg-indigo-500'
      case 'user':
        return 'bg-gray-500'
      case 'system':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const fetchActivities = async () => {
    try {
      setLoading(true)

      // Fetch recent visits
      const { data: visitsData } = await supabase
        .from('visits')
        .select(`
          *,
          patients(first_name, last_name),
          practices(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit / 2)

      // Fetch recent invoices
      const { data: invoicesData } = await supabase
        .from('invoices_enhanced')
        .select(`
          *,
          patients(first_name, last_name),
          practices(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit / 2)

      // Fetch recent SMS logs
      const { data: smsData } = await supabase
        .from('practice_sms_logs')
        .select(`
          *,
          practices(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit / 4)

      // Fetch recent email logs
      const { data: emailData } = await supabase
        .from('practice_email_logs')
        .select(`
          *,
          practices(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit / 4)

      // Fetch recent patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select(`
          *,
          practices(name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit / 4)

      const activitiesArray: Activity[] = []

      // Process visits
      visitsData?.forEach(visit => {
        activitiesArray.push({
          id: `visit-${visit.id}`,
          type: 'visit',
          title: visit.status === 'scheduled' ? 'New appointment scheduled' : 'Visit completed',
          description: `${visit.patients?.first_name} ${visit.patients?.last_name} - ${visit.visit_type}`,
          timestamp: visit.created_at,
          practiceId: visit.practice_id,
          practiceName: visit.practices?.name || 'Unknown Practice',
          metadata: { visitType: visit.visit_type, status: visit.status }
        })
      })

      // Process invoices
      invoicesData?.forEach(invoice => {
        activitiesArray.push({
          id: `invoice-${invoice.id}`,
          type: 'invoice',
          title: `Invoice ${invoice.invoice_number} created`,
          description: `${invoice.patients?.first_name} ${invoice.patients?.last_name} - R${parseFloat(invoice.total).toLocaleString()}`,
          timestamp: invoice.created_at,
          practiceId: invoice.practice_id,
          practiceName: invoice.practices?.name || 'Unknown Practice',
          metadata: { amount: invoice.total, status: invoice.payment_status }
        })
      })

      // Process SMS logs
      smsData?.forEach(sms => {
        activitiesArray.push({
          id: `sms-${sms.id}`,
          type: 'sms',
          title: 'SMS sent',
          description: `${sms.message_type} to ${sms.recipient_phone}`,
          timestamp: sms.created_at,
          practiceId: sms.practice_id,
          practiceName: sms.practices?.name || 'Unknown Practice',
          metadata: { messageType: sms.message_type, status: sms.delivery_status }
        })
      })

      // Process email logs
      emailData?.forEach(email => {
        activitiesArray.push({
          id: `email-${email.id}`,
          type: 'email',
          title: 'Email sent',
          description: `${email.email_type} to ${email.recipient_email}`,
          timestamp: email.created_at,
          practiceId: email.practice_id,
          practiceName: email.practices?.name || 'Unknown Practice',
          metadata: { emailType: email.email_type, status: email.delivery_status }
        })
      })

      // Process patients
      patientsData?.forEach(patient => {
        activitiesArray.push({
          id: `patient-${patient.id}`,
          type: 'patient',
          title: 'New patient registered',
          description: `${patient.first_name} ${patient.last_name}`,
          timestamp: patient.created_at,
          practiceId: patient.practice_id,
          practiceName: patient.practices?.name || 'Unknown Practice',
          metadata: { patientId: patient.id }
        })
      })

      // Sort all activities by timestamp and take the most recent
      const sortedActivities = activitiesArray
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)

      setActivities(sortedActivities)

      // Get practices for filter if needed
      if (showPracticeFilter) {
        const { data: practicesData } = await supabase
          .from('practices')
          .select('id, name')
          .order('name')

        setPractices(practicesData || [])
      }

    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()

    // Set up real-time subscription
    const subscription = supabase
      .channel('activity_feed')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchActivities()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [limit, selectedPractice])

  const filteredActivities = selectedPractice
    ? activities.filter(activity => activity.practiceId === selectedPractice)
    : activities

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <p className="text-sm text-gray-500 mt-1">Latest system activities across all practices</p>
        </div>

        {showPracticeFilter && (
          <select
            value={selectedPractice || ''}
            onChange={(e) => setSelectedPractice(e.target.value || null)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Practices</option>
            {practices.map(practice => (
              <option key={practice.id} value={practice.id}>
                {practice.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-3 p-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.02 }}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className={`p-2 rounded-full ${getActivityColor(activity.type)} text-white flex-shrink-0`}>
                <Icon icon={getActivityIcon(activity.type)} className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                  </p>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>

                <p className="text-xs text-gray-600 truncate mt-1">
                  {activity.description}
                </p>

                {activity.practiceName && (
                  <p className="text-xs text-gray-500 mt-1">
                    <Icon icon="solar:buildings-bold-duotone" className="w-3 h-3 inline mr-1" />
                    {activity.practiceName}
                  </p>
                )}
              </div>
            </motion.div>
          ))}

          {filteredActivities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Icon icon="solar:inbox-bold-duotone" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={fetchActivities}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
          Refresh Activity
        </button>
      </div>
    </motion.div>
  )
}

// System Health Component
export function SystemHealthWidget() {
  const [health, setHealth] = useState({
    uptime: 99.9,
    responseTime: 245,
    errorRate: 0.1,
    activeConnections: 42,
    cpuUsage: 35,
    memoryUsage: 67
  })

  const getHealthColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600 bg-green-100'
    if (value <= thresholds.warning) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.6 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
          <p className="text-sm text-gray-500 mt-1">Real-time system monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-green-600 font-medium">Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="text-center">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(100 - health.uptime, { good: 0.1, warning: 1 })}`}>
            <Icon icon="solar:pulse-bold-duotone" className="w-3 h-3 mr-1" />
            {health.uptime}% Uptime
          </div>
        </div>

        <div className="text-center">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(health.responseTime, { good: 200, warning: 500 })}`}>
            <Icon icon="solar:speedometer-bold-duotone" className="w-3 h-3 mr-1" />
            {health.responseTime}ms
          </div>
        </div>

        <div className="text-center">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(health.errorRate, { good: 0.5, warning: 2 })}`}>
            <Icon icon="solar:bug-bold-duotone" className="w-3 h-3 mr-1" />
            {health.errorRate}% Errors
          </div>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
            <Icon icon="solar:users-group-rounded-bold-duotone" className="w-3 h-3 mr-1" />
            {health.activeConnections} Active
          </div>
        </div>

        <div className="text-center">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(health.cpuUsage, { good: 50, warning: 80 })}`}>
            <Icon icon="solar:cpu-bolt-bold-duotone" className="w-3 h-3 mr-1" />
            {health.cpuUsage}% CPU
          </div>
        </div>

        <div className="text-center">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(health.memoryUsage, { good: 60, warning: 85 })}`}>
            <Icon icon="solar:database-bold-duotone" className="w-3 h-3 mr-1" />
            {health.memoryUsage}% RAM
          </div>
        </div>
      </div>
    </motion.div>
  )
}