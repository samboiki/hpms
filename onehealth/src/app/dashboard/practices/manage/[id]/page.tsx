'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { 
  Building2, 
  Users, 
  MessageSquare, 
  Mail, 
  Shield, 
  Calendar,
  DollarSign,
  Settings,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Zap
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

interface Practice {
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
  created_at: string
}

interface ServicePlan {
  id: string
  name: string
  description: string
  plan_type: string
  price_monthly: number
  limits: any
  features: string[]
  is_active: boolean
}

interface PracticeSubscription {
  id: string
  practice_id: string
  service_plan_id: string
  status: string
  current_usage: any
  billing_cycle_start: string
  billing_cycle_end: string
  auto_renew: boolean
  service_plan?: ServicePlan
}

interface PracticeFeature {
  id: string
  practice_id: string
  feature_key: string
  is_enabled: boolean
  limit_value: number
  current_usage: number
  settings: any
  expires_at: string
}

interface SMSSubscription {
  id: string
  practice_id: string
  monthly_limit: number
  current_usage: number
  additional_sms_purchased: number
  billing_cycle_start: string
  billing_cycle_end: string
  auto_renew: boolean
  is_active: boolean
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
}

export default function ManagePracticePage() {
  const params = useParams()
  const router = useRouter()
  const practiceId = params.id as string

  const [practice, setPractice] = useState<Practice | null>(null)
  const [servicePlans, setServicePlans] = useState<ServicePlan[]>([])
  const [practiceSubscriptions, setPracticeSubscriptions] = useState<PracticeSubscription[]>([])
  const [practiceFeatures, setPracticeFeatures] = useState<PracticeFeature[]>([])
  const [smsSubscription, setSmsSubscription] = useState<SMSSubscription | null>(null)
  const [emailSubscription, setEmailSubscription] = useState<EmailSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (practiceId) {
      loadPracticeData()
    }
  }, [practiceId])

  const loadPracticeData = async () => {
    try {
      setLoading(true)

      // Load practice details
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('*')
        .eq('id', practiceId)
        .single()

      if (practiceError) throw practiceError
      setPractice(practiceData)

      // Load available service plans
      const { data: plansData, error: plansError } = await supabase
        .from('service_plans')
        .select('*')
        .eq('is_active', true)
        .order('plan_type, name')

      if (plansError) throw plansError
      setServicePlans(plansData || [])

      // Load practice subscriptions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('practice_service_subscriptions')
        .select(`
          *,
          service_plan:service_plans(*)
        `)
        .eq('practice_id', practiceId)

      if (subscriptionsError) throw subscriptionsError
      setPracticeSubscriptions(subscriptionsData || [])

      // Load practice features
      const { data: featuresData, error: featuresError } = await supabase
        .from('practice_features')
        .select('*')
        .eq('practice_id', practiceId)

      if (featuresError) throw featuresError
      setPracticeFeatures(featuresData || [])

      // Load SMS subscription
      const { data: smsData, error: smsError } = await supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single()

      if (!smsError && smsData) {
        setSmsSubscription(smsData)
      }

      // Load email subscription
      const { data: emailData, error: emailError } = await supabase
        .from('practice_email_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single()

      if (!emailError && emailData) {
        setEmailSubscription(emailData)
      }

    } catch (error) {
      console.error('Error loading practice data:', error)
      toast.error('Failed to load practice data')
    } finally {
      setLoading(false)
    }
  }

  const updatePracticeStatus = async (newStatus: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('practices')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', practiceId)

      if (error) throw error

      setPractice(prev => prev ? { ...prev, status: newStatus } : null)
      toast.success(`Practice status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating practice status:', error)
      toast.error('Failed to update practice status')
    } finally {
      setSaving(false)
    }
  }

  const updatePracticeLimits = async (maxUsers: number, maxPatients: number) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('practices')
        .update({ 
          max_users: maxUsers, 
          max_patients: maxPatients,
          updated_at: new Date().toISOString() 
        })
        .eq('id', practiceId)

      if (error) throw error

      setPractice(prev => prev ? { ...prev, max_users: maxUsers, max_patients: maxPatients } : null)
      toast.success('Practice limits updated successfully')
    } catch (error) {
      console.error('Error updating practice limits:', error)
      toast.error('Failed to update practice limits')
    } finally {
      setSaving(false)
    }
  }

  const addServiceSubscription = async (servicePlanId: string) => {
    try {
      setSaving(true)
      const billingStart = new Date()
      const billingEnd = new Date()
      billingEnd.setMonth(billingEnd.getMonth() + 1)

      const { data, error } = await supabase
        .from('practice_service_subscriptions')
        .insert({
          practice_id: practiceId,
          service_plan_id: servicePlanId,
          status: 'active',
          current_usage: {},
          billing_cycle_start: billingStart.toISOString().split('T')[0],
          billing_cycle_end: billingEnd.toISOString().split('T')[0],
          auto_renew: true
        })
        .select(`
          *,
          service_plan:service_plans(*)
        `)
        .single()

      if (error) throw error

      setPracticeSubscriptions(prev => [...prev, data])
      toast.success('Service subscription added successfully')
    } catch (error) {
      console.error('Error adding service subscription:', error)
      toast.error('Failed to add service subscription')
    } finally {
      setSaving(false)
    }
  }

  const removeServiceSubscription = async (subscriptionId: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('practice_service_subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscriptionId)

      if (error) throw error

      setPracticeSubscriptions(prev => 
        prev.map(sub => 
          sub.id === subscriptionId 
            ? { ...sub, status: 'cancelled' }
            : sub
        )
      )
      toast.success('Service subscription cancelled')
    } catch (error) {
      console.error('Error removing service subscription:', error)
      toast.error('Failed to cancel service subscription')
    } finally {
      setSaving(false)
    }
  }

  const updateSMSLimits = async (monthlyLimit: number, additionalSMS: number = 0) => {
    try {
      setSaving(true)
      
      // Use API route for admin operations
      const response = await fetch('/api/admin/practices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateSMSLimits',
          practiceId: practiceId,
          data: {
            monthlyLimit,
            additionalSMS
          }
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update SMS limits')
      }

      setSmsSubscription(result.data)
      toast.success('SMS limits updated successfully')
      
      // Update state quietly without full page reload
      // Just refresh the SMS subscription data
      const { data: updatedSmsData } = await supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single()
      
      if (updatedSmsData) {
        setSmsSubscription(updatedSmsData)
      }
    } catch (error) {
      console.error('Error updating SMS limits:', error)
      toast.error('Failed to update SMS limits')
    } finally {
      setSaving(false)
    }
  }

  const updateEmailLimits = async (monthlyLimit: number, additionalEmails: number = 0) => {
    try {
      setSaving(true)
      
      // Use API route for admin operations
      const response = await fetch('/api/admin/practices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateEmailLimits',
          practiceId: practiceId,
          data: {
            monthlyLimit,
            additionalEmails
          }
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update email limits')
      }

      setEmailSubscription(result.data)
      toast.success('Email limits updated successfully')
      
      // Update state quietly without full page reload
      // Just refresh the email subscription data
      const { data: updatedEmailData } = await supabase
        .from('practice_email_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single()
      
      if (updatedEmailData) {
        setEmailSubscription(updatedEmailData)
      }
    } catch (error) {
      console.error('Error updating email limits:', error)
      toast.error('Failed to update email limits')
    } finally {
      setSaving(false)
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onehealth-600"></div>
      </div>
    )
  }

  if (!practice) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Practice not found</h3>
        <p className="mt-1 text-sm text-gray-500">The practice you're looking for doesn't exist.</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-poppins font-bold text-gray-900">{practice.name}</h1>
            <p className="text-sm font-montserrat text-gray-600">Manage practice settings and subscriptions</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(practice.status)}
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(practice.status)}`}>
            {practice.status.charAt(0).toUpperCase() + practice.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Practice Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Practice Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Practice Name</label>
                  <Input value={practice.name} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Slug</label>
                  <Input value={practice.slug} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  <Input value={practice.practice_type || ''} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">City</label>
                  <Input value={practice.city} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Email</label>
                  <Input value={practice.contact_email} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Phone</label>
                  <Input value={practice.contact_phone} disabled className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Practice Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Practice Limits
              </CardTitle>
              <CardDescription>
                Set maximum limits for users and patients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Max Users</label>
                  <Input 
                    type="number" 
                    value={practice.max_users || ''} 
                    onChange={(e) => setPractice(prev => prev ? {...prev, max_users: parseInt(e.target.value) || 0} : null)}
                    className="mt-1" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Max Patients</label>
                  <Input 
                    type="number" 
                    value={practice.max_patients || ''} 
                    onChange={(e) => setPractice(prev => prev ? {...prev, max_patients: parseInt(e.target.value) || 0} : null)}
                    className="mt-1" 
                  />
                </div>
              </div>
              <Button 
                onClick={() => updatePracticeLimits(practice.max_users || 0, practice.max_patients || 0)}
                disabled={saving}
                className="mt-4"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Limits
              </Button>
            </CardContent>
          </Card>

          {/* SMS Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                SMS Management
              </CardTitle>
              <CardDescription>
                Configure SMS limits and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {smsSubscription ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Monthly Limit</label>
                      <Input 
                        type="number" 
                        value={smsSubscription.monthly_limit} 
                        onChange={(e) => setSmsSubscription(prev => prev ? {...prev, monthly_limit: parseInt(e.target.value) || 0} : null)}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Current Usage</label>
                      <Input value={smsSubscription.current_usage} disabled className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Additional SMS</label>
                      <Input 
                        type="number" 
                        value={smsSubscription.additional_sms_purchased || 0} 
                        onChange={(e) => setSmsSubscription(prev => prev ? {...prev, additional_sms_purchased: parseInt(e.target.value) || 0} : null)}
                        className="mt-1" 
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Usage: {smsSubscription.current_usage} / {smsSubscription.monthly_limit + (smsSubscription.additional_sms_purchased || 0)}
                    </div>
                    <Button 
                      onClick={() => updateSMSLimits(smsSubscription.monthly_limit, smsSubscription.additional_sms_purchased || 0)}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Update SMS Limits
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-600 mt-2">No SMS subscription found</p>
                  <Button 
                    onClick={() => updateSMSLimits(500)} 
                    disabled={saving}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create SMS Subscription
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Email Management
              </CardTitle>
              <CardDescription>
                Configure email limits and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSubscription ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Monthly Limit</label>
                      <Input 
                        type="number" 
                        value={emailSubscription.monthly_limit} 
                        onChange={(e) => setEmailSubscription(prev => prev ? {...prev, monthly_limit: parseInt(e.target.value) || 0} : null)}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Current Usage</label>
                      <Input value={emailSubscription.current_usage} disabled className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Additional Emails</label>
                      <Input 
                        type="number" 
                        value={emailSubscription.additional_emails_purchased || 0} 
                        onChange={(e) => setEmailSubscription(prev => prev ? {...prev, additional_emails_purchased: parseInt(e.target.value) || 0} : null)}
                        className="mt-1" 
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Usage: {emailSubscription.current_usage} / {emailSubscription.monthly_limit + (emailSubscription.additional_emails_purchased || 0)}
                    </div>
                    <Button 
                      onClick={() => updateEmailLimits(emailSubscription.monthly_limit, emailSubscription.additional_emails_purchased || 0)}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Update Email Limits
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Mail className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-600 mt-2">No email subscription found</p>
                  <Button 
                    onClick={() => updateEmailLimits(1000)} 
                    disabled={saving}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Email Subscription
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => updatePracticeStatus(practice.status === 'active' ? 'suspended' : 'active')}
                disabled={saving}
              >
                <Shield className="h-4 w-4 mr-2" />
                {practice.status === 'active' ? 'Suspend Practice' : 'Activate Practice'}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Advanced Settings
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="h-4 w-4 mr-2" />
                Billing History
              </Button>
            </CardContent>
          </Card>

          {/* Service Subscriptions */}
          <Card>
            <CardHeader>
              <CardTitle>Service Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {practiceSubscriptions.map((subscription) => (
                  <div key={subscription.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{subscription.service_plan?.name}</div>
                      <div className="text-xs text-gray-500">{subscription.service_plan?.plan_type}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(subscription.status)}`}>
                        {subscription.status}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeServiceSubscription(subscription.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {servicePlans.length > 0 && (
                  <div className="pt-2 border-t">
                    <select 
                      className="w-full text-sm p-2 border rounded"
                      onChange={(e) => e.target.value && addServiceSubscription(e.target.value)}
                      value=""
                    >
                      <option value="">Add Service...</option>
                      {servicePlans
                        .filter(plan => !practiceSubscriptions.some(sub => sub.service_plan_id === plan.id && sub.status === 'active'))
                        .map(plan => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} (${plan.price_monthly}/mo)
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subscription Info */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tier:</span>
                <span className="text-sm font-medium">{practice.subscription_tier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Expires:</span>
                <span className="text-sm font-medium">
                  {practice.subscription_expires_at ? 
                    new Date(practice.subscription_expires_at).toLocaleDateString() : 
                    'Never'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Created:</span>
                <span className="text-sm font-medium">
                  {new Date(practice.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}