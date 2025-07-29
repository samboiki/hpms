'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  Calendar,
  MessageSquare,
  Mail,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react'

interface AnalyticsData {
  totalPractices: number
  activePractices: number
  totalPatients: number
  totalAppointments: number
  totalRevenue: number
  smsMetrics: {
    totalSent: number
    averageUsage: number
    topPractices: Array<{name: string, usage: number}>
  }
  emailMetrics: {
    totalSent: number
    averageOpenRate: number
    averageClickRate: number
  }
  growthMetrics: {
    practiceGrowth: number
    patientGrowth: number
    appointmentGrowth: number
    revenueGrowth: number
  }
  practicesByTier: Array<{tier: string, count: number}>
  monthlyTrends: Array<{
    month: string
    practices: number
    patients: number
    appointments: number
    revenue: number
  }>
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Load practices data
      const { data: practicesData, error: practicesError } = await supabase
        .from('practices')
        .select('*')

      if (practicesError) throw practicesError

      // Load patients data
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, created_at, practice_id')

      if (patientsError) throw patientsError

      // Load appointments data
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, created_at, practice_id, status')

      if (appointmentsError) throw appointmentsError

      // Load SMS subscriptions
      const { data: smsData, error: smsError } = await supabase
        .from('practice_sms_subscriptions')
        .select(`
          *,
          practice:practices(name)
        `)
        .eq('is_active', true)

      if (smsError) throw smsError

      // Load email subscriptions
      const { data: emailData, error: emailError } = await supabase
        .from('practice_email_subscriptions')
        .select('*')
        .eq('is_active', true)

      if (emailError) throw emailError

      // Calculate analytics
      const totalPractices = practicesData?.length || 0
      const activePractices = practicesData?.filter(p => p.status === 'active').length || 0
      const totalPatients = patientsData?.length || 0
      const totalAppointments = appointmentsData?.length || 0

      // Calculate revenue (example calculation)
      const totalRevenue = practicesData?.reduce((sum, practice) => {
        // Mock revenue calculation based on practice tier
        const tierMultiplier = {
          trial: 0,
          standard: 99,
          premium: 199,
          enterprise: 499
        }[practice.subscription_tier as keyof typeof tierMultiplier] || 0
        return sum + tierMultiplier
      }, 0) || 0

      // Calculate growth metrics (comparing with previous period)
      const currentDate = new Date()
      const previousPeriodStart = new Date()
      
      switch (timeRange) {
        case '7d':
          previousPeriodStart.setDate(currentDate.getDate() - 14)
          break
        case '30d':
          previousPeriodStart.setDate(currentDate.getDate() - 60)
          break
        case '90d':
          previousPeriodStart.setDate(currentDate.getDate() - 180)
          break
        case '1y':
          previousPeriodStart.setFullYear(currentDate.getFullYear() - 2)
          break
      }

      const currentPeriodStart = new Date()
      switch (timeRange) {
        case '7d':
          currentPeriodStart.setDate(currentDate.getDate() - 7)
          break
        case '30d':
          currentPeriodStart.setDate(currentDate.getDate() - 30)
          break
        case '90d':
          currentPeriodStart.setDate(currentDate.getDate() - 90)
          break
        case '1y':
          currentPeriodStart.setFullYear(currentDate.getFullYear() - 1)
          break
      }

      const currentPeriodPractices = practicesData?.filter(p => 
        new Date(p.created_at) >= currentPeriodStart
      ).length || 0

      const previousPeriodPractices = practicesData?.filter(p => {
        const createdAt = new Date(p.created_at)
        return createdAt >= previousPeriodStart && createdAt < currentPeriodStart
      }).length || 0

      const practiceGrowth = previousPeriodPractices > 0 
        ? ((currentPeriodPractices - previousPeriodPractices) / previousPeriodPractices) * 100 
        : 0

      // Similar calculations for other growth metrics
      const currentPeriodPatients = patientsData?.filter(p => 
        new Date(p.created_at) >= currentPeriodStart
      ).length || 0

      const previousPeriodPatients = patientsData?.filter(p => {
        const createdAt = new Date(p.created_at)
        return createdAt >= previousPeriodStart && createdAt < currentPeriodStart
      }).length || 0

      const patientGrowth = previousPeriodPatients > 0 
        ? ((currentPeriodPatients - previousPeriodPatients) / previousPeriodPatients) * 100 
        : 0

      // SMS metrics
      const totalSMSSent = smsData?.reduce((sum, sub) => sum + (sub.current_usage || 0), 0) || 0
      const avgSMSUsage = smsData?.length ? 
        smsData.reduce((sum, sub) => {
          const usage = sub.monthly_limit > 0 ? (sub.current_usage / sub.monthly_limit) * 100 : 0
          return sum + usage
        }, 0) / smsData.length : 0

      const topSMSPractices = smsData?.sort((a, b) => b.current_usage - a.current_usage)
        .slice(0, 5)
        .map(sub => ({
          name: sub.practice?.name || 'Unknown',
          usage: sub.current_usage || 0
        })) || []

      // Email metrics (mock data for now)
      const totalEmailSent = emailData?.reduce((sum, sub) => sum + (sub.current_usage || 0), 0) || 0

      // Practices by tier
      const practicesByTier = Object.entries(
        practicesData?.reduce((acc: Record<string, number>, practice) => {
          const tier = practice.subscription_tier || 'trial'
          acc[tier] = (acc[tier] || 0) + 1
          return acc
        }, {}) || {}
      ).map(([tier, count]) => ({ tier, count }))

      // Monthly trends (mock data for demo)
      const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          practices: Math.max(0, totalPractices - i * 2),
          patients: Math.max(0, totalPatients - i * 50),
          appointments: Math.max(0, totalAppointments - i * 100),
          revenue: Math.max(0, totalRevenue - i * 1000)
        }
      }).reverse()

      const analyticsData: AnalyticsData = {
        totalPractices,
        activePractices,
        totalPatients,
        totalAppointments,
        totalRevenue,
        smsMetrics: {
          totalSent: totalSMSSent,
          averageUsage: avgSMSUsage,
          topPractices: topSMSPractices
        },
        emailMetrics: {
          totalSent: totalEmailSent,
          averageOpenRate: 68.5, // Mock data
          averageClickRate: 12.3  // Mock data
        },
        growthMetrics: {
          practiceGrowth,
          patientGrowth,
          appointmentGrowth: 15.2, // Mock data
          revenueGrowth: 8.7 // Mock data
        },
        practicesByTier,
        monthlyTrends
      }

      setAnalytics(analyticsData)

    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadAnalytics()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NA', {
      style: 'currency',
      currency: 'NAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0
    return (
      <span className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onehealth-600"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <Activity className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load analytics</h3>
        <p className="mt-1 text-sm text-gray-500">Please try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-poppins font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-sm font-montserrat text-gray-600 mt-1">
            Comprehensive analytics across all practices in the OneHealth network
          </p>
        </div>
        <div className="flex space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Practices</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalPractices}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.activePractices} active • {formatPercentage(analytics.growthMetrics.practiceGrowth)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalPatients.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(analytics.growthMetrics.patientGrowth)} from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalAppointments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(analytics.growthMetrics.appointmentGrowth)} from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(analytics.growthMetrics.revenueGrowth)} from last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Communication Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMS Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              SMS Analytics
            </CardTitle>
            <CardDescription>SMS usage and performance across practices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-2xl font-bold text-onehealth-600">
                  {analytics.smsMetrics.totalSent.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600">Total SMS Sent</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-onehealth-600">
                  {analytics.smsMetrics.averageUsage.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-600">Average Usage</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Top SMS Users</h4>
              <div className="space-y-2">
                {analytics.smsMetrics.topPractices.map((practice, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 truncate">{practice.name}</span>
                    <span className="text-sm font-medium text-gray-900">{practice.usage}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Email Analytics
            </CardTitle>
            <CardDescription>Email engagement and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-2xl font-bold text-onehealth-600">
                  {analytics.emailMetrics.totalSent.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600">Emails Sent</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-onehealth-600">
                  {analytics.emailMetrics.averageOpenRate}%
                </div>
                <p className="text-sm text-gray-600">Open Rate</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-onehealth-600">
                  {analytics.emailMetrics.averageClickRate}%
                </div>
                <p className="text-sm text-gray-600">Click Rate</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Industry Average Open Rate</span>
                <span className="text-sm text-gray-400">21.3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Industry Average Click Rate</span>
                <span className="text-sm text-gray-400">2.6%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Practice Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Practices by Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Practices by Subscription Tier
            </CardTitle>
            <CardDescription>Distribution of practices across subscription tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.practicesByTier.map((tier, index) => {
                const percentage = analytics.totalPractices > 0 
                  ? (tier.count / analytics.totalPractices) * 100 
                  : 0
                const colors = {
                  trial: 'bg-blue-500',
                  standard: 'bg-green-500',
                  premium: 'bg-purple-500',
                  enterprise: 'bg-orange-500'
                }
                
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${colors[tier.tier as keyof typeof colors] || 'bg-gray-500'}`}></div>
                      <span className="text-sm text-gray-700 capitalize">{tier.tier}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{tier.count}</span>
                      <span className="text-sm text-gray-500">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Growth Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Growth Trends
            </CardTitle>
            <CardDescription>Key metrics growth over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {formatPercentage(analytics.growthMetrics.practiceGrowth)}
                  </div>
                  <p className="text-sm text-gray-600">Practice Growth</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {formatPercentage(analytics.growthMetrics.patientGrowth)}
                  </div>
                  <p className="text-sm text-gray-600">Patient Growth</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">
                    {formatPercentage(analytics.growthMetrics.appointmentGrowth)}
                  </div>
                  <p className="text-sm text-gray-600">Appointment Growth</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-600">
                    {formatPercentage(analytics.growthMetrics.revenueGrowth)}
                  </div>
                  <p className="text-sm text-gray-600">Revenue Growth</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
          <CardDescription>Historical performance over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Practices</th>
                  <th className="text-right py-2">Patients</th>
                  <th className="text-right py-2">Appointments</th>
                  <th className="text-right py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.monthlyTrends.slice(-6).map((month, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-medium">{month.month}</td>
                    <td className="text-right py-2">{month.practices}</td>
                    <td className="text-right py-2">{month.patients.toLocaleString()}</td>
                    <td className="text-right py-2">{month.appointments.toLocaleString()}</td>
                    <td className="text-right py-2">{formatCurrency(month.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}