'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// Toast notifications will be handled by parent component

interface User {
  id: string
  full_name: string
  email: string
  role: string
  job_title: string
  department: string
  contact_number: string
  is_active: boolean
}

interface LeaveType {
  id: string
  name: string
  code: string
  days_per_year: number
  is_paid: boolean
  carryover_allowed: boolean
  max_carryover_days: number
  requires_approval: boolean
  accrual_rate: number
  accrual_frequency: string
}

interface SalaryComponent {
  id: string
  name: string
  type: 'earnings' | 'deductions'
  category: string
  is_recurring: boolean
  is_taxable: boolean
  enabled: boolean
}

interface BonusConfiguration {
  id: string
  name: string
  type: 'percentage' | 'fixed_amount'
  value: number
  period_type: 'yearly' | 'monthly' | 'quarterly'
  is_recurring: boolean
  enabled: boolean
}

const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'pharmacist', label: 'Pharmacist' }
]

const PRACTICE_TYPES = [
  { value: 'general', label: 'General Practice' },
  { value: 'dental', label: 'Dental Practice' },
  { value: 'specialist', label: 'Specialist Practice' },
  { value: 'clinic', label: 'Medical Clinic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'wellness', label: 'Wellness Center' }
]

const DEFAULT_LEAVE_TYPES: Omit<LeaveType, 'id'>[] = [
  {
    name: 'Annual Leave',
    code: 'ANNUAL',
    days_per_year: 21,
    is_paid: true,
    carryover_allowed: true,
    max_carryover_days: 10,
    requires_approval: true,
    accrual_rate: 1.75,
    accrual_frequency: 'monthly'
  },
  {
    name: 'Sick Leave',
    code: 'SICK',
    days_per_year: 10,
    is_paid: true,
    carryover_allowed: false,
    max_carryover_days: 0,
    requires_approval: true,
    accrual_rate: 0.83,
    accrual_frequency: 'monthly'
  },
  {
    name: 'Maternity Leave',
    code: 'MATERNITY',
    days_per_year: 90,
    is_paid: true,
    carryover_allowed: false,
    max_carryover_days: 0,
    requires_approval: true,
    accrual_rate: 0,
    accrual_frequency: 'none'
  },
  {
    name: 'Paternity Leave',
    code: 'PATERNITY',
    days_per_year: 10,
    is_paid: true,
    carryover_allowed: false,
    max_carryover_days: 0,
    requires_approval: true,
    accrual_rate: 0,
    accrual_frequency: 'none'
  },
  {
    name: 'Compassionate Leave',
    code: 'COMPASSIONATE',
    days_per_year: 5,
    is_paid: true,
    carryover_allowed: false,
    max_carryover_days: 0,
    requires_approval: true,
    accrual_rate: 0,
    accrual_frequency: 'none'
  }
]

const DEFAULT_SALARY_COMPONENTS: Omit<SalaryComponent, 'id'>[] = [
  // Earnings
  { name: 'Basic Salary', type: 'earnings', category: 'basic', is_recurring: true, is_taxable: true, enabled: true },
  { name: 'Housing Allowance', type: 'earnings', category: 'allowance', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Transport Allowance', type: 'earnings', category: 'allowance', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Medical Allowance', type: 'earnings', category: 'allowance', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Overtime Pay', type: 'earnings', category: 'overtime', is_recurring: false, is_taxable: true, enabled: true },
  { name: 'Night Shift Allowance', type: 'earnings', category: 'allowance', is_recurring: false, is_taxable: true, enabled: true },
  { name: 'Performance Bonus', type: 'earnings', category: 'bonus', is_recurring: false, is_taxable: true, enabled: true },
  
  // Deductions
  { name: 'PAYE Tax', type: 'deductions', category: 'tax', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Social Security', type: 'deductions', category: 'statutory', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Medical Insurance', type: 'deductions', category: 'insurance', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Pension Fund', type: 'deductions', category: 'retirement', is_recurring: true, is_taxable: false, enabled: true },
  { name: 'Staff Loan', type: 'deductions', category: 'loan', is_recurring: true, is_taxable: false, enabled: false },
  { name: 'Salary Advance', type: 'deductions', category: 'advance', is_recurring: false, is_taxable: false, enabled: false }
]

const DEFAULT_BONUS_CONFIGS: Omit<BonusConfiguration, 'id'>[] = [
  {
    name: '13th Cheque',
    type: 'percentage',
    value: 100,
    period_type: 'yearly',
    is_recurring: true,
    enabled: true
  },
  {
    name: 'Performance Bonus',
    type: 'percentage',
    value: 50,
    period_type: 'quarterly',
    is_recurring: true,
    enabled: true
  },
  {
    name: 'Year-End Bonus',
    type: 'fixed_amount',
    value: 5000,
    period_type: 'yearly',
    is_recurring: true,
    enabled: false
  }
]

export function PracticeSignupForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Practice Information
  const [practiceData, setPracticeData] = useState({
    name: '',
    practice_type: '',
    practice_number: '',
    tax_number: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: '',
    country: 'Namibia',
    postal_code: '',
    website: '',
    description: ''
  })

  // Branch Information
  const [branchData, setBranchData] = useState({
    name: 'Main Branch',
    address: '',
    city: '',
    phone: '',
    email: ''
  })

  // Users
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      full_name: '',
      email: '',
      role: 'admin',
      job_title: 'Practice Administrator',
      department: 'Administration',
      contact_number: '',
      is_active: true
    }
  ])

  // Leave Types
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(
    DEFAULT_LEAVE_TYPES.map((lt, index) => ({ ...lt, id: String(index + 1) }))
  )

  // Salary Components
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>(
    DEFAULT_SALARY_COMPONENTS.map((sc, index) => ({ ...sc, id: String(index + 1) }))
  )

  // Bonus Configurations
  const [bonusConfigs, setBonusConfigs] = useState<BonusConfiguration[]>(
    DEFAULT_BONUS_CONFIGS.map((bc, index) => ({ ...bc, id: String(index + 1) }))
  )

  const addUser = () => {
    const newUser: User = {
      id: String(users.length + 1),
      full_name: '',
      email: '',
      role: 'receptionist',
      job_title: '',
      department: '',
      contact_number: '',
      is_active: true
    }
    setUsers([...users, newUser])
  }

  const removeUser = (id: string) => {
    if (users.length > 1) {
      setUsers(users.filter(u => u.id !== id))
    }
  }

  const updateUser = (id: string, field: keyof User, value: any) => {
    setUsers(users.map(u => u.id === id ? { ...u, [field]: value } : u))
  }

  const updateLeaveType = (id: string, field: keyof LeaveType, value: any) => {
    setLeaveTypes(leaveTypes.map(lt => lt.id === id ? { ...lt, [field]: value } : lt))
  }

  const updateSalaryComponent = (id: string, field: keyof SalaryComponent, value: any) => {
    setSalaryComponents(salaryComponents.map(sc => sc.id === id ? { ...sc, [field]: value } : sc))
  }

  const updateBonusConfig = (id: string, field: keyof BonusConfiguration, value: any) => {
    setBonusConfigs(bonusConfigs.map(bc => bc.id === id ? { ...bc, [field]: value } : bc))
  }

  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      const signupData = {
        practice: practiceData,
        branch: branchData,
        users: users.filter(u => u.full_name && u.email),
        leave_types: leaveTypes,
        salary_components: salaryComponents.filter(sc => sc.enabled),
        bonus_configurations: bonusConfigs.filter(bc => bc.enabled)
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData)
      })

      const result = await response.json()

      if (result.success) {
        // Redirect to success page
        window.location.href = '/auth/signup-success'
      } else {
        throw new Error(result.error || 'Registration failed')
      }
      
    } catch (error) {
      console.error('Signup error:', error)
      alert('Failed to submit registration. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { number: 1, title: 'Practice Info', icon: 'solar:hospital-bold-duotone' },
    { number: 2, title: 'Branch Details', icon: 'solar:buildings-bold-duotone' },
    { number: 3, title: 'Staff Members', icon: 'solar:users-group-rounded-bold-duotone' },
    { number: 4, title: 'Leave Policies', icon: 'solar:calendar-mark-bold-duotone' },
    { number: 5, title: 'Payroll Setup', icon: 'solar:wallet-bold-duotone' },
    { number: 6, title: 'Review & Submit', icon: 'solar:check-read-bold-duotone' }
  ]

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Progress Bar */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 h-2">
        <div 
          className="bg-white h-full transition-all duration-500"
          style={{ width: `${(currentStep / 6) * 100}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="px-8 py-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          {steps.map((step) => (
            <div 
              key={step.number}
              className={`flex items-center gap-3 ${
                step.number === currentStep 
                  ? 'text-purple-600' 
                  : step.number < currentStep 
                    ? 'text-green-600' 
                    : 'text-gray-400'
              }`}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${step.number === currentStep 
                  ? 'bg-purple-100 ring-2 ring-purple-600' 
                  : step.number < currentStep 
                    ? 'bg-green-100' 
                    : 'bg-gray-100'
                }
              `}>
                {step.number < currentStep ? (
                  <Icon icon="solar:check-circle-bold" className="w-6 h-6" />
                ) : (
                  <Icon icon={step.icon} className="w-6 h-6" />
                )}
              </div>
              <span className="font-medium hidden md:block">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="p-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Practice Information */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6">Practice Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="practice-name">Practice Name*</Label>
                  <Input
                    id="practice-name"
                    value={practiceData.name}
                    onChange={(e) => setPracticeData({ ...practiceData, name: e.target.value })}
                    placeholder="OneHealth Medical Centre"
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="practice-type">Practice Type*</Label>
                  <Select 
                    value={practiceData.practice_type}
                    onValueChange={(value) => setPracticeData({ ...practiceData, practice_type: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select practice type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="practice-number">Practice Number</Label>
                  <Input
                    id="practice-number"
                    value={practiceData.practice_number}
                    onChange={(e) => setPracticeData({ ...practiceData, practice_number: e.target.value })}
                    placeholder="PR12345"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="tax-number">Tax Number</Label>
                  <Input
                    id="tax-number"
                    value={practiceData.tax_number}
                    onChange={(e) => setPracticeData({ ...practiceData, tax_number: e.target.value })}
                    placeholder="TX123456789"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-email">Contact Email*</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={practiceData.contact_email}
                    onChange={(e) => setPracticeData({ ...practiceData, contact_email: e.target.value })}
                    placeholder="admin@practice.com"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-phone">Contact Phone*</Label>
                  <Input
                    id="contact-phone"
                    value={practiceData.contact_phone}
                    onChange={(e) => setPracticeData({ ...practiceData, contact_phone: e.target.value })}
                    placeholder="+264 61 123 4567"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={practiceData.website}
                    onChange={(e) => setPracticeData({ ...practiceData, website: e.target.value })}
                    placeholder="https://www.practice.com"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City*</Label>
                  <Input
                    id="city"
                    value={practiceData.city}
                    onChange={(e) => setPracticeData({ ...practiceData, city: e.target.value })}
                    placeholder="Windhoek"
                    className="mt-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Physical Address*</Label>
                  <Textarea
                    id="address"
                    value={practiceData.address}
                    onChange={(e) => setPracticeData({ ...practiceData, address: e.target.value })}
                    placeholder="123 Medical Street, Health District"
                    className="mt-2"
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Practice Description</Label>
                  <Textarea
                    id="description"
                    value={practiceData.description}
                    onChange={(e) => setPracticeData({ ...practiceData, description: e.target.value })}
                    placeholder="Tell us about your practice..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Branch Details */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6">Branch Details</h2>
              <p className="text-gray-600 mb-6">Set up your main branch. You can add more branches later.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="branch-name">Branch Name*</Label>
                  <Input
                    id="branch-name"
                    value={branchData.name}
                    onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
                    placeholder="Main Branch"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="branch-phone">Branch Phone*</Label>
                  <Input
                    id="branch-phone"
                    value={branchData.phone}
                    onChange={(e) => setBranchData({ ...branchData, phone: e.target.value })}
                    placeholder="+264 61 123 4567"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="branch-email">Branch Email</Label>
                  <Input
                    id="branch-email"
                    type="email"
                    value={branchData.email}
                    onChange={(e) => setBranchData({ ...branchData, email: e.target.value })}
                    placeholder="branch@practice.com"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="branch-city">City*</Label>
                  <Input
                    id="branch-city"
                    value={branchData.city}
                    onChange={(e) => setBranchData({ ...branchData, city: e.target.value })}
                    placeholder="Windhoek"
                    className="mt-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="branch-address">Branch Address*</Label>
                  <Textarea
                    id="branch-address"
                    value={branchData.address}
                    onChange={(e) => setBranchData({ ...branchData, address: e.target.value })}
                    placeholder="123 Medical Street, Health District"
                    className="mt-2"
                    rows={2}
                  />
                </div>
              </div>

              <Card className="mt-6 bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600" />
                    Multi-Branch Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">
                    OneHealth supports unlimited branches. After setup, you can add more branches 
                    from your admin dashboard to manage multiple locations seamlessly.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Staff Members */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6">Staff Members</h2>
              <p className="text-gray-600 mb-6">Add your team members. The first user will be the practice administrator.</p>
              
              <div className="space-y-4">
                {users.map((user, index) => (
                  <Card key={user.id} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {index === 0 ? 'Practice Administrator' : `Staff Member ${index + 1}`}
                        </CardTitle>
                        {users.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUser(user.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Icon icon="solar:trash-bin-trash-bold" className="w-5 h-5" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Full Name*</Label>
                          <Input
                            value={user.full_name}
                            onChange={(e) => updateUser(user.id, 'full_name', e.target.value)}
                            placeholder="Dr. John Doe"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Email*</Label>
                          <Input
                            type="email"
                            value={user.email}
                            onChange={(e) => updateUser(user.id, 'email', e.target.value)}
                            placeholder="john.doe@practice.com"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Role*</Label>
                          <Select 
                            value={user.role}
                            onValueChange={(value) => updateUser(user.id, 'role', value)}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(role => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Job Title</Label>
                          <Input
                            value={user.job_title}
                            onChange={(e) => updateUser(user.id, 'job_title', e.target.value)}
                            placeholder="Lead Physician"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Department</Label>
                          <Input
                            value={user.department}
                            onChange={(e) => updateUser(user.id, 'department', e.target.value)}
                            placeholder="General Medicine"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Contact Number</Label>
                          <Input
                            value={user.contact_number}
                            onChange={(e) => updateUser(user.id, 'contact_number', e.target.value)}
                            placeholder="+264 81 123 4567"
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                onClick={addUser}
                variant="outline"
                className="mt-4 w-full"
              >
                <Icon icon="solar:add-circle-bold" className="w-5 h-5 mr-2" />
                Add Another Staff Member
              </Button>
            </motion.div>
          )}

          {/* Step 4: Leave Policies */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6">Leave Policies</h2>
              <p className="text-gray-600 mb-6">Configure your leave types and policies. You can adjust these anytime.</p>
              
              <div className="space-y-4">
                {leaveTypes.map((leaveType) => (
                  <Card key={leaveType.id}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        {leaveType.name}
                        <span className="text-sm font-normal text-gray-500">Code: {leaveType.code}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Days Per Year</Label>
                          <Input
                            type="number"
                            value={leaveType.days_per_year}
                            onChange={(e) => updateLeaveType(leaveType.id, 'days_per_year', parseInt(e.target.value))}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Accrual Rate (per month)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={leaveType.accrual_rate}
                            onChange={(e) => updateLeaveType(leaveType.id, 'accrual_rate', parseFloat(e.target.value))}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Max Carryover Days</Label>
                          <Input
                            type="number"
                            value={leaveType.max_carryover_days}
                            onChange={(e) => updateLeaveType(leaveType.id, 'max_carryover_days', parseInt(e.target.value))}
                            className="mt-2"
                            disabled={!leaveType.carryover_allowed}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={leaveType.is_paid}
                            onCheckedChange={(checked) => updateLeaveType(leaveType.id, 'is_paid', checked)}
                          />
                          <Label className="font-normal">Paid Leave</Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={leaveType.carryover_allowed}
                            onCheckedChange={(checked) => updateLeaveType(leaveType.id, 'carryover_allowed', checked)}
                          />
                          <Label className="font-normal">Allow Carryover</Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={leaveType.requires_approval}
                            onCheckedChange={(checked) => updateLeaveType(leaveType.id, 'requires_approval', checked)}
                          />
                          <Label className="font-normal">Requires Approval</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 5: Payroll Setup */}
          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6">Payroll Setup</h2>
              
              <Tabs defaultValue="components" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="components">Salary Components</TabsTrigger>
                  <TabsTrigger value="bonuses">Bonus Configurations</TabsTrigger>
                </TabsList>

                <TabsContent value="components" className="mt-6">
                  <p className="text-gray-600 mb-4">Select the salary components you want to use in your payroll.</p>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg mb-3">Earnings</h3>
                    {salaryComponents.filter(sc => sc.type === 'earnings').map((component) => (
                      <div key={component.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={component.enabled}
                            onCheckedChange={(checked) => updateSalaryComponent(component.id, 'enabled', checked)}
                          />
                          <div>
                            <p className="font-medium">{component.name}</p>
                            <p className="text-sm text-gray-500">
                              {component.category} • {component.is_recurring ? 'Recurring' : 'One-time'} • 
                              {component.is_taxable ? ' Taxable' : ' Non-taxable'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <h3 className="font-semibold text-lg mb-3 mt-6">Deductions</h3>
                    {salaryComponents.filter(sc => sc.type === 'deductions').map((component) => (
                      <div key={component.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={component.enabled}
                            onCheckedChange={(checked) => updateSalaryComponent(component.id, 'enabled', checked)}
                          />
                          <div>
                            <p className="font-medium">{component.name}</p>
                            <p className="text-sm text-gray-500">
                              {component.category} • {component.is_recurring ? 'Recurring' : 'One-time'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="bonuses" className="mt-6">
                  <p className="text-gray-600 mb-4">Configure automatic bonus calculations for your staff.</p>
                  
                  <div className="space-y-4">
                    {bonusConfigs.map((bonus) => (
                      <Card key={bonus.id} className={bonus.enabled ? 'border-purple-200' : ''}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{bonus.name}</CardTitle>
                            <Switch
                              checked={bonus.enabled}
                              onCheckedChange={(checked) => updateBonusConfig(bonus.id, 'enabled', checked)}
                            />
                          </div>
                        </CardHeader>
                        {bonus.enabled && (
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label>Type</Label>
                                <Select 
                                  value={bonus.type}
                                  onValueChange={(value) => updateBonusConfig(bonus.id, 'type', value as 'percentage' | 'fixed_amount')}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percentage">Percentage of Salary</SelectItem>
                                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>{bonus.type === 'percentage' ? 'Percentage (%)' : 'Amount'}</Label>
                                <Input
                                  type="number"
                                  value={bonus.value}
                                  onChange={(e) => updateBonusConfig(bonus.id, 'value', parseFloat(e.target.value))}
                                  className="mt-2"
                                />
                              </div>

                              <div>
                                <Label>Frequency</Label>
                                <Select 
                                  value={bonus.period_type}
                                  onValueChange={(value) => updateBonusConfig(bonus.id, 'period_type', value as 'yearly' | 'monthly' | 'quarterly')}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}

          {/* Step 6: Review & Submit */}
          {currentStep === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6">Review & Submit</h2>
              <p className="text-gray-600 mb-6">Please review your information before submitting.</p>
              
              <div className="space-y-6">
                {/* Practice Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-purple-600" />
                      Practice Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm text-gray-500">Practice Name</dt>
                        <dd className="font-medium">{practiceData.name || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Practice Type</dt>
                        <dd className="font-medium">
                          {PRACTICE_TYPES.find(t => t.value === practiceData.practice_type)?.label || 'Not selected'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Contact Email</dt>
                        <dd className="font-medium">{practiceData.contact_email || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Contact Phone</dt>
                        <dd className="font-medium">{practiceData.contact_phone || 'Not provided'}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Staff Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-blue-600" />
                      Staff Members ({users.filter(u => u.full_name && u.email).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {users.filter(u => u.full_name && u.email).map((user, index) => (
                        <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          <span className="text-sm font-medium text-purple-600">
                            {ROLES.find(r => r.value === user.role)?.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Configuration Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 text-green-600" />
                      Configuration Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{leaveTypes.length}</p>
                        <p className="text-sm text-gray-600">Leave Types</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {salaryComponents.filter(sc => sc.enabled).length}
                        </p>
                        <p className="text-sm text-gray-600">Salary Components</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                          {bonusConfigs.filter(bc => bc.enabled).length}
                        </p>
                        <p className="text-sm text-gray-600">Bonus Configs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Terms & Conditions */}
                <Card className="bg-gray-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 text-green-600 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <p className="mb-2">
                          By submitting this form, you agree to OneHealth's Terms of Service and Privacy Policy.
                        </p>
                        <p>
                          Your practice will be reviewed and approved within 24 hours. You'll receive an email
                          with your login credentials once approved.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <Icon icon="solar:arrow-left-bold" className="w-5 h-5" />
            Previous
          </Button>

          {currentStep < 6 ? (
            <Button
              onClick={nextStep}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            >
              Next Step
              <Icon icon="solar:arrow-right-bold" className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white min-w-[150px]"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="solar:hourglass-line-duotone" className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                  Submit Registration
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}