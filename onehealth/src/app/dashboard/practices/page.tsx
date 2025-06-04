'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Plus, 
  Building2, 
  Users, 
  MapPin,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Edit,
  Eye,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Activity,
  AlertCircle,
  Zap,
  Shield,
  Crown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Practice {
  practice_id: string
  practice_name: string
  slug: string
  city: string
  contact_email: string
  contact_phone: string
  total_appointments: number
  completed_appointments: number
  cancelled_appointments: number
  no_show_appointments: number
  appointments_last_30_days: number
  appointments_last_7_days: number
  total_patients: number
  new_patients_30_days: number
  new_patients_7_days: number
  total_potential_revenue: number
  active_services: number
  sms_monthly_limit: number
  sms_current_usage: number
  sms_sent_last_30_days: number
  completion_rate_percentage: number
  sms_usage_percentage: number
  practice_created_at: string
}

interface PracticeDetails {
  id: string
  name: string
  slug: string
  city: string
  contact_email: string
  contact_phone: string
  practice_type: string
  practice_subtypes: string[]
  status: string
  subscription_tier: string
  subscription_expires_at: string
  max_users: number
  max_patients: number
  timezone: string
  currency: string
  business_hours: any
  sms_limit: number
  sms_used: number
  created_at: string
}

export default function PracticesManagementPage() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedTier, setSelectedTier] = useState<string>('all')

  useEffect(() => {
    loadPracticeData()
  }, [])

  const loadPracticeData = async () => {
    try {
      // Load practice performance data from the dashboard view
      const { data: performanceData, error: perfError } = await supabase
        .from('practice_performance_dashboard')
        .select('*')
        .order('practice_name')

      if (perfError) {
        console.error('Error loading performance data:', perfError)
      } else if (performanceData) {
        setPractices(performanceData)
      }

      // Load detailed practice information
      const { data: detailData, error: detailError } = await supabase
        .from('practices')
        .select('*')
        .order('name')

      if (detailError) {
        console.error('Error loading practice details:', detailError)
      } else if (detailData) {
        setPracticeDetails(detailData)
      }
    } catch (error) {
      console.error('Error loading practice data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPracticeDetail = (practiceId: string) => {
    return practiceDetails.find(p => p.id === practiceId)
  }

  const filteredPractices = practices.filter(practice => {
    const detail = getPracticeDetail(practice.practice_id)
    const matchesSearch = 
      practice.practice_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      practice.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      practice.contact_email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = selectedStatus === 'all' || detail?.status === selectedStatus
    const matchesTier = selectedTier === 'all' || detail?.subscription_tier === selectedTier

    return matchesSearch && matchesStatus && matchesTier
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'suspended':
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      case 'suspended':
        return 'bg-orange-100 text-orange-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'trial':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'standard':
        return <Star className="h-4 w-4 text-green-600" />
      case 'premium':
        return <Crown className="h-4 w-4 text-purple-600" />
      case 'enterprise':
        return <Shield className="h-4 w-4 text-orange-600" />
      default:
        return <Zap className="h-4 w-4 text-gray-600" />
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'trial':
        return 'bg-blue-100 text-blue-800'
      case 'standard':
        return 'bg-green-100 text-green-800'
      case 'premium':
        return 'bg-purple-100 text-purple-800'
      case 'enterprise':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NA', {
      style: 'currency',
      currency: 'NAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const totalPractices = practices.length
  const activePractices = practiceDetails.filter(p => p.status === 'active').length
  const totalRevenue = practices.reduce((sum, p) => sum + p.total_potential_revenue, 0)
  const totalPatients = practices.reduce((sum, p) => sum + p.total_patients, 0)

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
          <h1 className="text-2xl font-poppins font-bold text-gray-900">Practice Management</h1>
          <p className="text-sm font-montserrat text-gray-600 mt-1">
            Monitor and manage healthcare practices across the OneHealth network
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <TrendingUp className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Practice
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-onehealth-100 rounded-lg">
              <Building2 className="h-5 w-5 text-onehealth-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Total Practices</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{totalPractices}</p>
              <p className="text-xs font-montserrat text-green-600">{activePractices} active</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Total Patients</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{totalPatients.toLocaleString()}</p>
              <p className="text-xs font-montserrat text-blue-600">Across all practices</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Revenue Potential</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs font-montserrat text-green-600">Total tariff value</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">SMS Usage</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">
                {Math.round(practices.reduce((sum, p) => sum + p.sms_usage_percentage, 0) / practices.length)}%
              </p>
              <p className="text-xs font-montserrat text-purple-600">Average utilization</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search practices by name, city, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500 font-montserrat"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500 font-montserrat"
          >
            <option value="all">All Tiers</option>
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </Card>

      {/* Practices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPractices.map((practice) => {
          const detail = getPracticeDetail(practice.practice_id)
          return (
            <Card key={practice.practice_id} className="p-6 hover:shadow-lg transition-shadow duration-200">
              {/* Practice Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-poppins font-semibold text-gray-900 mb-1">
                    {practice.practice_name}
                  </h3>
                  <div className="flex items-center text-sm font-montserrat text-gray-600 mb-2">
                    <MapPin className="h-4 w-4 mr-1" />
                    {practice.city}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail && (
                      <div className="flex items-center">
                        {getStatusIcon(detail.status)}
                        <span className={`ml-1 inline-flex px-2 py-1 text-xs font-montserrat font-medium rounded-full ${getStatusColor(detail.status)}`}>
                          {detail.status}
                        </span>
                      </div>
                    )}
                    {detail && (
                      <div className="flex items-center">
                        {getTierIcon(detail.subscription_tier)}
                        <span className={`ml-1 inline-flex px-2 py-1 text-xs font-montserrat font-medium rounded-full ${getTierColor(detail.subscription_tier)}`}>
                          {detail.subscription_tier}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Practice
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <XCircle className="mr-2 h-4 w-4" />
                      Suspend Practice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Contact Information */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm font-montserrat text-gray-600">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  {practice.contact_email}
                </div>
                <div className="flex items-center text-sm font-montserrat text-gray-600">
                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                  {practice.contact_phone}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-poppins font-semibold text-gray-900">
                    {practice.total_patients}
                  </p>
                  <p className="text-xs font-montserrat text-gray-600">Patients</p>
                  {practice.new_patients_30_days > 0 && (
                    <p className="text-xs font-montserrat text-green-600">
                      +{practice.new_patients_30_days} this month
                    </p>
                  )}
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-poppins font-semibold text-gray-900">
                    {practice.appointments_last_30_days}
                  </p>
                  <p className="text-xs font-montserrat text-gray-600">Appointments</p>
                  <p className="text-xs font-montserrat text-blue-600">Last 30 days</p>
                </div>
              </div>

              {/* SMS Usage Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-montserrat text-gray-600">SMS Usage</span>
                  <span className="text-sm font-montserrat font-medium text-gray-900">
                    {practice.sms_current_usage} / {practice.sms_monthly_limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      practice.sms_usage_percentage > 80 ? 'bg-red-500' : 
                      practice.sms_usage_percentage > 60 ? 'bg-yellow-500' : 'bg-onehealth-500'
                    }`}
                    style={{ width: `${Math.min(practice.sms_usage_percentage, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs font-montserrat text-gray-500 mt-1">
                  {practice.sms_usage_percentage.toFixed(0)}% used
                </p>
              </div>

              {/* Revenue Potential */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-montserrat text-gray-600">Revenue Potential</span>
                  <span className="text-sm font-poppins font-semibold text-gray-900">
                    {formatCurrency(practice.total_potential_revenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-montserrat text-gray-500">Active Services</span>
                  <span className="text-xs font-montserrat text-gray-700">
                    {practice.active_services} services
                  </span>
                </div>
              </div>

              {/* Practice Type */}
              {detail && detail.practice_type && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-flex px-2 py-1 text-xs font-montserrat font-medium bg-blue-100 text-blue-800 rounded-full">
                      {detail.practice_type}
                    </span>
                    {detail.practice_subtypes && detail.practice_subtypes.slice(0, 2).map((subtype, index) => (
                      <span key={index} className="inline-flex px-2 py-1 text-xs font-montserrat font-medium bg-gray-100 text-gray-800 rounded-full">
                        {subtype}
                      </span>
                    ))}
                    {detail.practice_subtypes && detail.practice_subtypes.length > 2 && (
                      <span className="inline-flex px-2 py-1 text-xs font-montserrat font-medium bg-gray-100 text-gray-600 rounded-full">
                        +{detail.practice_subtypes.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {filteredPractices.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-poppins font-medium text-gray-900">No practices found</h3>
          <p className="mt-1 text-sm font-montserrat text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}
    </div>
  )
}