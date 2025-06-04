'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Plus, 
  MessageSquare, 
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
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Practice {
  id: string
  name: string
  practice_type: string
  city: string
  sms_limit: number
  sms_used: number
}

interface SMSLog {
  id: string
  practice_id: string
  recipient_phone: string
  message_content: string
  message_type: string
  status: string
  sent_at: string
  cost: number
  practice?: Practice
}

interface SMSStats {
  totalSent: number
  totalCost: number
  successRate: number
  monthlyUsage: number
}

export default function SMSManagementPage() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([])
  const [stats, setStats] = useState<SMSStats>({
    totalSent: 0,
    totalCost: 0,
    successRate: 0,
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
      // Load practices with SMS data
      const { data: practicesData } = await supabase
        .from('practices')
        .select('id, name, practice_type, city, sms_limit, sms_used')
        .order('name')

      if (practicesData) {
        setPractices(practicesData)
      }

      // Load SMS logs with practice info
      const { data: smsData } = await supabase
        .from('sms_logs')
        .select(`
          *,
          practice:practices(id, name, practice_type, city)
        `)
        .order('sent_at', { ascending: false })
        .limit(1000)

      if (smsData) {
        setSmsLogs(smsData)
        
        // Calculate stats
        const totalSent = smsData.length
        const totalCost = smsData.reduce((sum, sms) => sum + (sms.cost || 0), 0)
        const successCount = smsData.filter(sms => sms.status === 'delivered').length
        const successRate = totalSent > 0 ? (successCount / totalSent) * 100 : 0
        
        // Monthly usage (current month)
        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()
        const monthlyUsage = smsData.filter(sms => {
          const smsDate = new Date(sms.sent_at)
          return smsDate.getMonth() === currentMonth && smsDate.getFullYear() === currentYear
        }).length

        setStats({
          totalSent,
          totalCost,
          successRate,
          monthlyUsage
        })
      }
    } catch (error) {
      console.error('Error loading SMS data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSMS = smsLogs.filter(sms => {
    const matchesSearch = 
      sms.recipient_phone.includes(searchTerm) ||
      sms.message_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sms.message_type.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPractice = selectedPractice === 'all' || sms.practice_id === selectedPractice
    const matchesStatus = selectedStatus === 'all' || sms.status === selectedStatus
    const matchesType = selectedType === 'all' || sms.message_type === selectedType

    return matchesSearch && matchesPractice && matchesStatus && matchesType
  })

  const messageTypes = [...new Set(smsLogs.map(sms => sms.message_type).filter(Boolean))]
  const statuses = [...new Set(smsLogs.map(sms => sms.status).filter(Boolean))]

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
          <h1 className="text-2xl font-poppins font-bold text-gray-900">SMS Management</h1>
          <p className="text-sm font-montserrat text-gray-600 mt-1">
            Monitor SMS communications and manage messaging limits across all practices
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Send SMS
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-onehealth-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-onehealth-600" />
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
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Success Rate</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{stats.successRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">This Month</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{stats.monthlyUsage.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Send className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Total Cost</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">N${stats.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Practice SMS Limits Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-poppins font-semibold text-gray-900 mb-4">Practice SMS Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {practices.map((practice) => {
            const usagePercent = practice.sms_limit > 0 ? (practice.sms_used / practice.sms_limit) * 100 : 0
            const isNearLimit = usagePercent > 80
            const isOverLimit = usagePercent > 100
            
            return (
              <Card key={practice.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-montserrat font-medium text-gray-900 truncate">{practice.name}</h4>
                  <span className="text-xs font-montserrat text-gray-500">{practice.practice_type}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-montserrat">
                    <span className="text-gray-600">Usage</span>
                    <span className={`font-medium ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {practice.sms_used} / {practice.sms_limit}
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
                    {usagePercent.toFixed(0)}% used • {practice.city}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by phone, message, or type..."
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
                {type.charAt(0).toUpperCase() + type.slice(1)}
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

      {/* SMS Logs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Message
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
              {filteredSMS.map((sms) => (
                <tr key={sms.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat font-medium text-gray-900">
                    {sms.recipient_phone}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-montserrat text-gray-900 max-w-xs truncate">
                      {sms.message_content}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-montserrat font-medium text-gray-900">
                        {sms.practice?.name}
                      </div>
                      <div className="text-sm font-montserrat text-gray-500">
                        {sms.practice?.practice_type}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-montserrat font-medium bg-blue-100 text-blue-800 rounded-full">
                      {sms.message_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(sms.status)}
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-montserrat font-medium rounded-full ${getStatusColor(sms.status)}`}>
                        {sms.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat text-gray-900">
                    {new Date(sms.sent_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat font-medium text-gray-900">
                    N${(sms.cost || 0).toFixed(2)}
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

        {filteredSMS.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-poppins font-medium text-gray-900">No SMS messages found</h3>
            <p className="mt-1 text-sm font-montserrat text-gray-500">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}