'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Plus, 
  Mail, 
  Send, 
  Users, 
  TrendingUp,
  Calendar,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Practice {
  id: string
  name: string
  practice_type: string
  city: string
  email_limit: number
  email_used: number
}

interface EmailLog {
  id: string
  practice_id: string
  recipient_email: string
  subject: string
  message_content: string
  message_type: string
  status: string
  sent_at: string
  opened_at: string
  clicked_at: string
  cost: number
  practice?: Practice
}

interface EmailStats {
  totalSent: number
  totalCost: number
  openRate: number
  clickRate: number
  monthlyUsage: number
}

interface EmailSubscription {
  id: string
  practice_id: string
  monthly_limit: number
  current_usage: number
  additional_emails_purchased: number
  billing_cycle_start: string
  billing_cycle_end: string
  auto_renew: boolean
  is_active: boolean
  practice?: Practice
}

export default function EmailManagementPage() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [emailSubscriptions, setEmailSubscriptions] = useState<EmailSubscription[]>([])
  const [stats, setStats] = useState<EmailStats>({
    totalSent: 0,
    totalCost: 0,
    openRate: 0,
    clickRate: 0,
    monthlyUsage: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPractice, setSelectedPractice] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load practices with email data
      const { data: practicesData } = await supabase
        .from('practices')
        .select('id, name, practice_type, city')
        .order('name')

      if (practicesData) {
        setPractices(practicesData)
      }

      // Load email subscriptions
      const { data: subscriptionsData } = await supabase
        .from('practice_email_subscriptions')
        .select(`
          *,
          practice:practices(id, name, practice_type, city)
        `)
        .eq('is_active', true)
        .order('monthly_limit', { ascending: false })

      if (subscriptionsData) {
        setEmailSubscriptions(subscriptionsData)
      }

      // For demo purposes, let's create some mock email logs
      // In a real system, you'd have an email_logs table
      const mockEmailLogs: EmailLog[] = [
        {
          id: '1',
          practice_id: practicesData?.[0]?.id || '1',
          recipient_email: 'patient@example.com',
          subject: 'Appointment Reminder',
          message_content: 'Your appointment is scheduled for tomorrow at 2 PM.',
          message_type: 'appointment_reminder',
          status: 'delivered',
          sent_at: new Date().toISOString(),
          opened_at: new Date().toISOString(),
          clicked_at: '',
          cost: 0.05,
          practice: practicesData?.[0]
        },
        {
          id: '2',
          practice_id: practicesData?.[1]?.id || '2',
          recipient_email: 'patient2@example.com',
          subject: 'Lab Results Available',
          message_content: 'Your lab results are now available in the patient portal.',
          message_type: 'lab_results',
          status: 'delivered',
          sent_at: new Date(Date.now() - 86400000).toISOString(),
          opened_at: new Date(Date.now() - 86400000 + 3600000).toISOString(),
          clicked_at: new Date(Date.now() - 86400000 + 7200000).toISOString(),
          cost: 0.05,
          practice: practicesData?.[1]
        }
      ]

      setEmailLogs(mockEmailLogs)

      // Calculate stats
      const totalSent = mockEmailLogs.length
      const totalCost = mockEmailLogs.reduce((sum, email) => sum + (email.cost || 0), 0)
      const openedCount = mockEmailLogs.filter(email => email.opened_at).length
      const clickedCount = mockEmailLogs.filter(email => email.clicked_at).length
      const openRate = totalSent > 0 ? (openedCount / totalSent) * 100 : 0
      const clickRate = totalSent > 0 ? (clickedCount / totalSent) * 100 : 0
      
      // Monthly usage (current month)
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthlyUsage = mockEmailLogs.filter(email => {
        const emailDate = new Date(email.sent_at)
        return emailDate.getMonth() === currentMonth && emailDate.getFullYear() === currentYear
      }).length

      setStats({
        totalSent,
        totalCost,
        openRate,
        clickRate,
        monthlyUsage
      })
    } catch (error) {
      console.error('Error loading email data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmails = emailLogs.filter(email => {
    const matchesSearch = 
      email.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.message_type.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPractice = selectedPractice === 'all' || email.practice_id === selectedPractice
    const matchesStatus = selectedStatus === 'all' || email.status === selectedStatus
    const matchesType = selectedType === 'all' || email.message_type === selectedType

    return matchesSearch && matchesPractice && matchesStatus && matchesType
  })

  const messageTypes = [...new Set(emailLogs.map(email => email.message_type).filter(Boolean))]
  const statuses = [...new Set(emailLogs.map(email => email.status).filter(Boolean))]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onehealth-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-poppins font-bold text-gray-900">Email Management</h1>
          <p className="text-sm font-montserrat text-gray-600 mt-1">
            Monitor email communications and manage messaging limits across all practices
          </p>
        </div>
        <div className="flex space-x-3">
          <Link href="/dashboard/email/plans">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Manage Plans
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-onehealth-100 rounded-lg">
              <Mail className="h-5 w-5 text-onehealth-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Total Sent</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{stats.totalSent.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Open Rate</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{stats.openRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Click Rate</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{stats.clickRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">This Month</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{stats.monthlyUsage.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Send className="h-5 w-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Total Cost</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">N${stats.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Practice Email Limits Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-poppins font-semibold text-gray-900 mb-4">Practice Email Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {emailSubscriptions.map((subscription) => {
            const usagePercent = subscription.monthly_limit > 0 ? (subscription.current_usage / subscription.monthly_limit) * 100 : 0
            const isNearLimit = usagePercent > 80
            const isOverLimit = usagePercent > 100
            
            return (
              <Card key={subscription.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-montserrat font-medium text-gray-900 truncate">
                    {subscription.practice?.name}
                  </h4>
                  <span className="text-xs font-montserrat text-gray-500">
                    {subscription.practice?.practice_type}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-montserrat">
                    <span className="text-gray-600">Usage</span>
                    <span className={`font-medium ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {subscription.current_usage} / {subscription.monthly_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-onehealth-500'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs font-montserrat text-gray-500">
                    {usagePercent.toFixed(0)}% used • {subscription.practice?.city}
                  </div>
                  {subscription.additional_emails_purchased > 0 && (
                    <div className="text-xs font-montserrat text-blue-600">
                      +{subscription.additional_emails_purchased} additional emails
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
        {emailSubscriptions.length === 0 && (
          <div className="text-center py-8">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No email subscriptions found</h3>
            <p className="mt-1 text-sm text-gray-500">Practices need to set up email subscriptions to send emails.</p>
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by email, subject, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={selectedPractice}
            onChange={(e) => setSelectedPractice(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500"
          >
            <option value="all">All Practices</option>
            {practices.map((practice) => (
              <option key={practice.id} value={practice.id}>
                {practice.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500"
          >
            <option value="all">All Types</option>
            {messageTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500"
          >
            <option value="all">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Email Logs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Practice
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Engagement
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Sent At
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat font-medium text-gray-900">
                    {email.recipient_email}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-montserrat text-gray-900 max-w-xs truncate">
                      {email.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-montserrat font-medium text-gray-900">
                        {email.practice?.name}
                      </div>
                      <div className="text-sm font-montserrat text-gray-500">
                        {email.practice?.practice_type}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-montserrat font-medium bg-blue-100 text-blue-800 rounded-full">
                      {email.message_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(email.status)}
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-montserrat font-medium rounded-full ${getStatusColor(email.status)}`}>
                        {email.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat text-gray-900">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {email.opened_at ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-300" />
                        )}
                        <span className="text-xs">Opened</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {email.clicked_at ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-300" />
                        )}
                        <span className="text-xs">Clicked</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat text-gray-900">
                    {new Date(email.sent_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat font-medium text-gray-900">
                    N${(email.cost || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmails.length === 0 && (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-poppins font-medium text-gray-900">No emails found</h3>
            <p className="mt-1 text-sm font-montserrat text-gray-500">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}