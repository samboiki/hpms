'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  MessageSquare,
  DollarSign,
  Users,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

interface SMSPlan {
  id: string
  name: string
  description: string
  monthly_limit: number
  price_per_email: number
  overage_rate: number
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
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

export default function SMSPlansPage() {
  const [smsPlans, setSmsPlans] = useState<SMSPlan[]>([])
  const [servicePlans, setServicePlans] = useState<ServicePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    monthly_limit: 0,
    price_monthly: 0,
    features: ['basic_templates', 'delivery_reports']
  })

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      setLoading(true)

      // Load SMS plans
      const { data: smsData, error: smsError } = await supabase
        .from('sms_plans')
        .select('*')
        .order('monthly_limit')

      if (smsError) throw smsError
      setSmsPlans(smsData || [])

      // Load service plans for SMS
      const { data: serviceData, error: serviceError } = await supabase
        .from('service_plans')
        .select('*')
        .eq('plan_type', 'sms')
        .order('price_monthly')

      if (serviceError) throw serviceError
      setServicePlans(serviceData || [])

    } catch (error) {
      console.error('Error loading plans:', error)
      toast.error('Failed to load SMS plans')
    } finally {
      setLoading(false)
    }
  }

  const createSMSPlan = async () => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('sms_plans')
        .insert({
          name: newPlan.name,
          description: newPlan.description,
          monthly_limit: newPlan.monthly_limit,
          price_per_email: newPlan.price_monthly / newPlan.monthly_limit,
          overage_rate: 0.05,
          features: newPlan.features,
          is_active: true
        })

      if (error) throw error

      toast.success('SMS plan created successfully')
      setShowAddForm(false)
      setNewPlan({
        name: '',
        description: '',
        monthly_limit: 0,
        price_monthly: 0,
        features: ['basic_templates', 'delivery_reports']
      })
      loadPlans()
    } catch (error) {
      console.error('Error creating SMS plan:', error)
      toast.error('Failed to create SMS plan')
    } finally {
      setSaving(false)
    }
  }

  const createServicePlan = async () => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('service_plans')
        .insert({
          name: newPlan.name,
          description: newPlan.description,
          plan_type: 'sms',
          price_monthly: newPlan.price_monthly,
          limits: { monthly_limit: newPlan.monthly_limit },
          features: newPlan.features,
          is_active: true
        })

      if (error) throw error

      toast.success('Service plan created successfully')
      setShowAddForm(false)
      setNewPlan({
        name: '',
        description: '',
        monthly_limit: 0,
        price_monthly: 0,
        features: ['basic_templates', 'delivery_reports']
      })
      loadPlans()
    } catch (error) {
      console.error('Error creating service plan:', error)
      toast.error('Failed to create service plan')
    } finally {
      setSaving(false)
    }
  }

  const updateServicePlan = async (planId: string, updates: Partial<ServicePlan>) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('service_plans')
        .update(updates)
        .eq('id', planId)

      if (error) throw error

      toast.success('Plan updated successfully')
      setEditingPlan(null)
      loadPlans()
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('Failed to update plan')
    } finally {
      setSaving(false)
    }
  }

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('service_plans')
        .update({ is_active: !currentStatus })
        .eq('id', planId)

      if (error) throw error

      toast.success(`Plan ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      loadPlans()
    } catch (error) {
      console.error('Error toggling plan status:', error)
      toast.error('Failed to update plan status')
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase
        .from('service_plans')
        .delete()
        .eq('id', planId)

      if (error) throw error

      toast.success('Plan deleted successfully')
      loadPlans()
    } catch (error) {
      console.error('Error deleting plan:', error)
      toast.error('Failed to delete plan')
    } finally {
      setSaving(false)
    }
  }

  const availableFeatures = [
    'basic_templates',
    'advanced_templates',
    'custom_templates',
    'delivery_reports',
    'read_receipts',
    'scheduling',
    'bulk_send',
    'automation',
    'analytics',
    'priority_support'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onehealth-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-poppins font-bold text-gray-900">SMS Plans Management</h1>
          <p className="text-sm font-montserrat text-gray-600 mt-1">
            Create and manage SMS service plans for practices
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add SMS Plan
        </Button>
      </div>

      {/* Add New Plan Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New SMS Plan</CardTitle>
            <CardDescription>Define a new SMS service plan for practices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Plan Name</label>
                <Input 
                  value={newPlan.name}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Professional SMS"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Monthly Price</label>
                <Input 
                  type="number"
                  value={newPlan.price_monthly}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, price_monthly: parseFloat(e.target.value) || 0 }))}
                  placeholder="29.99"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">SMS Limit</label>
                <Input 
                  type="number"
                  value={newPlan.monthly_limit}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, monthly_limit: parseInt(e.target.value) || 0 }))}
                  placeholder="1000"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Price per SMS</label>
                <Input 
                  value={newPlan.monthly_limit > 0 ? (newPlan.price_monthly / newPlan.monthly_limit).toFixed(4) : '0'}
                  disabled
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input 
                value={newPlan.description}
                onChange={(e) => setNewPlan(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the plan"
                className="mt-1"
              />
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700">Features</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {availableFeatures.map(feature => (
                  <label key={feature} className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      checked={newPlan.features.includes(feature)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewPlan(prev => ({ ...prev, features: [...prev.features, feature] }))
                        } else {
                          setNewPlan(prev => ({ ...prev, features: prev.features.filter(f => f !== feature) }))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{feature.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={createServicePlan} disabled={saving || !newPlan.name || !newPlan.monthly_limit}>
                <Save className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Plans (New System) */}
      <div>
        <h2 className="text-lg font-poppins font-semibold text-gray-900 mb-4">SMS Service Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicePlans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    {plan.is_active ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setEditingPlan(editingPlan === plan.id ? null : plan.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {editingPlan === plan.id ? (
                  <div className="space-y-3">
                    <Input 
                      value={plan.name}
                      onChange={(e) => setServicePlans(prev => 
                        prev.map(p => p.id === plan.id ? { ...p, name: e.target.value } : p)
                      )}
                      className="text-sm"
                    />
                    <Input 
                      value={plan.description}
                      onChange={(e) => setServicePlans(prev => 
                        prev.map(p => p.id === plan.id ? { ...p, description: e.target.value } : p)
                      )}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="number"
                        value={plan.price_monthly}
                        onChange={(e) => setServicePlans(prev => 
                          prev.map(p => p.id === plan.id ? { ...p, price_monthly: parseFloat(e.target.value) || 0 } : p)
                        )}
                        className="text-sm"
                        placeholder="Monthly price"
                      />
                      <Input 
                        type="number"
                        value={plan.limits?.monthly_limit || 0}
                        onChange={(e) => setServicePlans(prev => 
                          prev.map(p => p.id === plan.id ? { 
                            ...p, 
                            limits: { ...p.limits, monthly_limit: parseInt(e.target.value) || 0 }
                          } : p)
                        )}
                        className="text-sm"
                        placeholder="SMS limit"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm"
                        onClick={() => updateServicePlan(plan.id, {
                          name: plan.name,
                          description: plan.description,
                          price_monthly: plan.price_monthly,
                          limits: plan.limits
                        })}
                        disabled={saving}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingPlan(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-onehealth-600">
                        N${plan.price_monthly}
                      </span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {(plan.limits?.monthly_limit || 0).toLocaleString()} SMS/month
                      </span>
                    </div>

                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Features:</span>
                      <ul className="mt-1 space-y-1">
                        {plan.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                            {feature.replace(/_/g, ' ')}
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-xs text-gray-500">
                            +{plan.features.length - 3} more features
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="pt-3 border-t flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => togglePlanStatus(plan.id, plan.is_active)}
                        disabled={saving}
                        className="flex-1"
                      >
                        {plan.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deletePlan(plan.id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Legacy SMS Plans */}
      {smsPlans.length > 0 && (
        <div>
          <h2 className="text-lg font-poppins font-semibold text-gray-900 mb-4">Legacy SMS Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {smsPlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {plan.is_active ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Monthly Limit:</span>
                      <span className="text-sm font-medium">{plan.monthly_limit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Price per SMS:</span>
                      <span className="text-sm font-medium">N${plan.price_per_email.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Overage Rate:</span>
                      <span className="text-sm font-medium">N${plan.overage_rate.toFixed(4)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-sm text-gray-600 mb-2">Features:</div>
                    <div className="flex flex-wrap gap-1">
                      {plan.features.map((feature, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {feature.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {servicePlans.length === 0 && smsPlans.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No SMS plans found</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first SMS plan to get started.</p>
          <Button onClick={() => setShowAddForm(true)} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create SMS Plan
          </Button>
        </div>
      )}
    </div>
  )
}