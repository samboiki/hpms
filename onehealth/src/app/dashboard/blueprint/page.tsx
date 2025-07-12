'use client'

import React, { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Database, Zap, Info, CheckCircle, FileText, Hash, Calendar, GitBranch, Server, User, ArrowRight } from 'lucide-react'
import { Rubik } from 'next/font/google'

const rubik = Rubik({ subsets: ['latin'] })

interface TableField {
  name: string
  dataType: string
  description: string
  required?: boolean
  isUnique?: boolean
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  references?: string
  defaultValue?: string
  constraints?: string[]
  example?: string
}

interface DataFlow {
  step: number
  action: string
  description: string
  type: 'user' | 'system' | 'database' | 'trigger' | 'edge-function'
}

interface FormWorkflow {
  formName: string
  description: string
  dataFlow: DataFlow[]
}

interface DatabaseTable {
  name: string
  purpose: string
  keyRelations: string[]
  timestamps: string[]
  fields?: TableField[]
  triggers?: string[]
  forms?: string[]
  usedBy?: string[]
  referencedTables?: string[]
  functions?: string[]
  edgeFunctions?: string[]
  formWorkflows?: FormWorkflow[]
}

interface Section {
  id: string
  title: string
  icon: string
  lastUpdated: string
  description: string
  tables: DatabaseTable[]
  color: string
  bgGradient: string
}

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string
  itemCount?: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
}> = ({ title, itemCount, isExpanded, onToggle, children, className = '' }) => {
  return (
    <div className={`border rounded-lg ${className}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <h4 className={`font-semibold text-gray-800 ${rubik.className}`}>{title}</h4>
        <div className="flex items-center gap-2">
          {itemCount !== undefined && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Data Journey Visualization Component
const DataJourneyVisualization: React.FC<{ workflow: FormWorkflow }> = ({ workflow }) => {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4" />
      case 'system':
        return <Server className="w-4 h-4" />
      case 'database':
        return <Database className="w-4 h-4" />
      case 'trigger':
        return <Zap className="w-4 h-4" />
      case 'edge-function':
        return <GitBranch className="w-4 h-4" />
      default:
        return <ArrowRight className="w-4 h-4" />
    }
  }

  const getStepColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'system':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'database':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'trigger':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'edge-function':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  return (
    <div className="space-y-3">
      {workflow.dataFlow.map((step, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getStepColor(step.type)}`}>
              {getStepIcon(step.type)}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-gray-900">{step.action}</span>
              <Badge variant="outline" className="text-xs">
                Step {step.step}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{step.description}</p>
          </div>
          {index < workflow.dataFlow.length - 1 && (
            <div className="absolute left-7 top-10 w-0.5 h-12 bg-gray-200" />
          )}
        </div>
      ))}
    </div>
  )
}

export default function SystemBlueprintPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('patients')
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [expandedSubsections, setExpandedSubsections] = useState<Record<string, boolean>>({})

  const toggleSubsection = (key: string) => {
    setExpandedSubsections(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Initialize default expanded subsections for better UX
  React.useEffect(() => {
    if (expandedTable) {
      setExpandedSubsections({
        [`${expandedTable}-fields`]: true
      })
    }
  }, [expandedTable])

  // Generate consistent colors for table names
  const tableColorMap = useMemo(() => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
      'bg-indigo-100 text-indigo-700',
      'bg-red-100 text-red-700',
      'bg-yellow-100 text-yellow-700',
      'bg-cyan-100 text-cyan-700',
      'bg-orange-100 text-orange-700',
      'bg-teal-100 text-teal-700',
      'bg-lime-100 text-lime-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-violet-100 text-violet-700',
      'bg-fuchsia-100 text-fuchsia-700',
    ]
    
    const tables = [
      'patients', 'practices', 'branches', 'users', 'visits', 'medical_aid_details',
      'next_of_kin', 'patient_documents', 'patient_media', 'vitals', 'medical_records',
      'lab_requests', 'imaging_requests', 'practice_sms_logs', 'practice_email_logs',
      'automation_templates', 'automation_executions', 'automation_queue', 'invoices_enhanced',
      'invoice_services', 'payments', 'batch_headers', 'practice_tariffs',
      'medical_aid_providers'
    ]
    
    const map: Record<string, string> = {}
    tables.forEach((table, index) => {
      map[table] = colors[index % colors.length]
    })
    return map
  }, [])

  const getTableColor = (tableName: string) => {
    return tableColorMap[tableName] || 'bg-gray-100 text-gray-700'
  }

  const formatRelation = (relation: string) => {
    const parts = relation.split(' → ')
    if (parts.length === 2) {
      const [field, target] = parts
      const [targetTable] = target.split('.')
      return (
        <span>
          <span className="font-mono text-xs">{field}</span>
          <span className="mx-1">→</span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${getTableColor(targetTable)}`}>
            {target}
          </span>
        </span>
      )
    }
    return relation
  }

  // Table numbering system
  const tableNumbering: Record<string, string> = {
    patients: 'P.1',
    medical_aid_details: 'P.2',
    next_of_kin: 'P.3',
    patient_documents: 'P.4',
    patient_media: 'P.5',
    visits: 'E.1',
    vitals: 'E.2',
    medical_records: 'E.3',
    lab_requests: 'E.4',
    imaging_requests: 'E.5',
    practice_sms_logs: 'C.1',
    practice_email_logs: 'C.2',
    automation_templates: 'C.3',
    automation_queue: 'C.4',
    invoices_enhanced: 'F.1',
    invoice_services: 'F.2',
    payments: 'F.3',
    batch_headers: 'F.4',
    practices: 'S.1',
    branches: 'S.2',
    users: 'S.3',
    practice_tariffs: 'S.4',
  }

  const sections: Section[] = [
    {
      id: 'patients',
      title: 'Patients',
      icon: 'solar:users-group-rounded-bold-duotone',
      lastUpdated: '2025-07-11 11:00:00 UTC',
      description: 'Handles all aspects of patient management, from registration and demographic data to document and media storage. Foundation for most other system modules.',
      color: 'purple',
      bgGradient: 'from-purple-500 to-indigo-600',
      tables: [
        {
          name: 'patients',
          purpose: 'Core patient records with demographics and identification',
          keyRelations: ['practice_id → practices.id', 'branch_id → branches.id', 'created_by → users.id', 'updated_by → users.id'],
          timestamps: ['created_at', 'updated_at'],
          fields: [
            { 
              name: 'id', 
              dataType: 'UUID', 
              description: 'Primary key, unique identifier for the patient',
              isPrimaryKey: true,
              defaultValue: 'gen_random_uuid()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            { 
              name: 'system_patient_reference_number', 
              dataType: 'TEXT', 
              description: 'Auto-generated patient reference number',
              isUnique: true,
              defaultValue: 'Generated by trigger',
              example: 'P000001'
            },
            { 
              name: 'government_id_number', 
              dataType: 'TEXT', 
              description: 'National identification number',
              constraints: ['Namibian ID format validation'],
              example: '92041000123'
            },
            { 
              name: 'first_name', 
              dataType: 'TEXT', 
              description: 'Patient\'s first name', 
              required: true,
              constraints: ['NOT NULL'],
              example: 'John'
            },
            { 
              name: 'middle_name', 
              dataType: 'TEXT', 
              description: 'Patient\'s middle name',
              example: 'Michael'
            },
            { 
              name: 'last_name', 
              dataType: 'TEXT', 
              description: 'Patient\'s last name', 
              required: true,
              constraints: ['NOT NULL'],
              example: 'Doe'
            },
            { 
              name: 'date_of_birth', 
              dataType: 'DATE', 
              description: 'Patient\'s birth date',
              example: '1990-05-15'
            },
            { 
              name: 'gender', 
              dataType: 'TEXT', 
              description: 'Gender classification',
              constraints: ['CHECK (gender IN (\'male\', \'female\', \'other\'))'],
              example: 'male'
            },
            { 
              name: 'phone', 
              dataType: 'TEXT', 
              description: 'Primary contact number',
              example: '+264811234567'
            },
            { 
              name: 'email', 
              dataType: 'TEXT', 
              description: 'Email address',
              example: 'john.doe@example.com'
            },
            { 
              name: 'address', 
              dataType: 'TEXT', 
              description: 'Physical address',
              example: '123 Independence Avenue'
            },
            { 
              name: 'city', 
              dataType: 'TEXT', 
              description: 'City of residence',
              example: 'Windhoek'
            },
            { 
              name: 'country', 
              dataType: 'TEXT', 
              description: 'Country of residence',
              defaultValue: 'Namibia',
              example: 'Namibia'
            },
            { 
              name: 'occupation', 
              dataType: 'TEXT', 
              description: 'Patient\'s occupation',
              example: 'Teacher'
            },
            { 
              name: 'emergency_contact_name', 
              dataType: 'TEXT', 
              description: 'Emergency contact person',
              example: 'Jane Doe'
            },
            { 
              name: 'emergency_contact_phone', 
              dataType: 'TEXT', 
              description: 'Emergency contact number',
              example: '+264812345678'
            },
            { 
              name: 'blood_type', 
              dataType: 'TEXT', 
              description: 'Blood type classification',
              constraints: ['Common values: A+, A-, B+, B-, O+, O-, AB+, AB-'],
              example: 'O+'
            },
            { 
              name: 'allergies', 
              dataType: 'TEXT', 
              description: 'Known allergies (comma-separated)',
              example: 'Penicillin, Peanuts'
            },
            { 
              name: 'chronic_conditions', 
              dataType: 'TEXT', 
              description: 'Chronic medical conditions',
              example: 'Hypertension, Diabetes Type 2'
            },
            { 
              name: 'practice_id', 
              dataType: 'UUID', 
              description: 'Associated practice ID',
              isForeignKey: true,
              references: 'practices.id',
              example: '456e7890-e89b-12d3-a456-426614174000'
            },
            { 
              name: 'branch_id', 
              dataType: 'UUID', 
              description: 'Associated branch ID',
              isForeignKey: true,
              references: 'branches.id',
              example: '789e0123-e89b-12d3-a456-426614174000'
            },
            { 
              name: 'created_at', 
              dataType: 'TIMESTAMPTZ', 
              description: 'Record creation timestamp',
              defaultValue: 'NOW()',
              example: '2025-01-11 14:30:00+00'
            },
            { 
              name: 'updated_at', 
              dataType: 'TIMESTAMPTZ', 
              description: 'Last update timestamp',
              defaultValue: 'NOW()',
              example: '2025-01-11 15:45:00+00'
            },
            { 
              name: 'created_by', 
              dataType: 'UUID', 
              description: 'User who created the record',
              isForeignKey: true,
              references: 'users.id',
              example: '901e2345-e89b-12d3-a456-426614174000'
            },
            { 
              name: 'updated_by', 
              dataType: 'UUID', 
              description: 'User who last updated the record',
              isForeignKey: true,
              references: 'users.id',
              example: '012e3456-e89b-12d3-a456-426614174000'
            }
          ],
          triggers: [
            'assign_system_patient_reference_number_trigger - Auto-generates patient reference numbers',
            'update_patients_updated_at - Updates timestamp on record modification',
            'audit_patients_trigger - Creates audit trail for all changes'
          ],
          forms: [
            'ModernPatientRegistrationForm.tsx - Primary registration form',
            'EditPatientForm.tsx - Patient profile editing',
            'PatientSearchSelect.tsx - Patient search component',
            'QuickPatientRegistration.tsx - Quick registration modal'
          ],
          usedBy: [
            'visits - Links patient to appointments/visits',
            'medical_aid_details - Patient insurance information',
            'next_of_kin - Emergency contacts',
            'patient_documents - Document storage',
            'patient_media - Images and files',
            'vitals - Vital signs records',
            'medical_records - Clinical notes',
            'lab_requests - Laboratory orders',
            'imaging_requests - Imaging orders',
            'invoices_enhanced - Billing records',
            'practice_sms_logs - SMS communications',
            'practice_email_logs - Email communications'
          ],
          referencedTables: [
            'practices - Organization this patient belongs to',
            'branches - Specific branch location',
            'users - User who created/updated the record'
          ],
          functions: [
            'get_next_system_patient_reference_number() - Generates unique patient ID',
            'validate_namibian_id(id_number) - Validates ID format',
            'calculate_age(date_of_birth) - Calculates current age',
            'get_patient_balance(patient_id) - Gets outstanding balance'
          ],
          edgeFunctions: [
            'patient-search - Advanced patient search API',
            'patient-merge - Merge duplicate patients',
            'patient-export - Export patient data'
          ],
          formWorkflows: [
            {
              formName: 'ModernPatientRegistrationForm.tsx',
              description: 'Primary patient registration workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'User Input',
                  description: 'Receptionist enters patient details (name, ID, contact)',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Validation',
                  description: 'Frontend validates ID format, required fields, phone number',
                  type: 'system'
                },
                {
                  step: 3,
                  action: 'Submit Form',
                  description: 'Data sent to Supabase via INSERT query',
                  type: 'system'
                },
                {
                  step: 4,
                  action: 'Before Insert Trigger',
                  description: 'assign_system_patient_reference_number_trigger fires',
                  type: 'trigger'
                },
                {
                  step: 5,
                  action: 'Generate ID',
                  description: 'get_next_system_patient_reference_number() generates P000123',
                  type: 'database'
                },
                {
                  step: 6,
                  action: 'Insert Record',
                  description: 'Patient record created with auto-generated ID',
                  type: 'database'
                },
                {
                  step: 7,
                  action: 'After Insert Trigger',
                  description: 'audit_patients_trigger logs the creation',
                  type: 'trigger'
                },
                {
                  step: 8,
                  action: 'Real-time Update',
                  description: 'Supabase broadcasts change to all connected clients',
                  type: 'system'
                },
                {
                  step: 9,
                  action: 'UI Update',
                  description: 'Patient list refreshes, success toast shown',
                  type: 'system'
                },
                {
                  step: 10,
                  action: 'Optional SMS',
                  description: 'Welcome SMS sent via centralized-sms-gateway if enabled',
                  type: 'edge-function'
                }
              ]
            }
          ]
        },
        {
          name: 'medical_aid_details',
          purpose: 'Insurance/medical aid information',
          keyRelations: ['patient_id → patients.id', 'medical_aid_id → medical_aid_providers.id'],
          timestamps: ['created_at', 'updated_at'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key, unique identifier',
              isPrimaryKey: true,
              defaultValue: 'gen_random_uuid()',
              example: 'abc12345-e89b-12d3-a456-426614174000'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Reference to patient',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['NOT NULL'],
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'medical_aid_id',
              dataType: 'UUID',
              description: 'Reference to medical aid provider',
              isForeignKey: true,
              references: 'medical_aid_providers.id',
              example: 'def45678-e89b-12d3-a456-426614174000'
            },
            {
              name: 'member_number',
              dataType: 'TEXT',
              description: 'Medical aid member number',
              required: true,
              constraints: ['NOT NULL'],
              example: 'MED123456789'
            },
            {
              name: 'plan_name',
              dataType: 'TEXT',
              description: 'Medical aid plan name',
              example: 'Comprehensive Gold'
            },
            {
              name: 'is_primary',
              dataType: 'BOOLEAN',
              description: 'Is this the primary medical aid',
              defaultValue: 'true',
              example: 'true'
            }
          ],
          forms: [
            'MedicalAidForm.tsx - Medical aid management',
            'PatientRegistrationForm.tsx - Includes medical aid section'
          ],
          usedBy: [
            'invoices_enhanced - Links to medical aid for claims',
            'batch_headers - Medical aid batch processing'
          ]
        },
        {
          name: 'next_of_kin',
          purpose: 'Emergency contacts and relationships',
          keyRelations: ['patient_id → patients.id'],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'patient_documents',
          purpose: 'Document metadata and storage',
          keyRelations: ['patient_id → patients.id', 'uploaded_by → users.id'],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'patient_media',
          purpose: 'Images and media files',
          keyRelations: ['patient_id → patients.id', 'uploaded_by → users.id'],
          timestamps: ['created_at', 'uploaded_at']
        }
      ]
    },
    {
      id: 'encounters',
      title: 'Encounters',
      icon: 'solar:clipboard-heart-bold-duotone',
      lastUpdated: '2025-07-11 11:00:00 UTC',
      description: 'Encompasses all patient interactions including appointments, visits, clinical documentation, and medical procedures.',
      color: 'cyan',
      bgGradient: 'from-cyan-500 to-blue-500',
      tables: [
        {
          name: 'visits',
          purpose: 'Primary appointment/visit table',
          keyRelations: ['patient_id → patients.id', 'doctor_id → users.id', 'practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at', 'completed_at']
        },
        {
          name: 'vitals',
          purpose: 'Vital signs records',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id'],
          timestamps: ['recorded_at', 'created_at', 'updated_at']
        },
        {
          name: 'medical_records',
          purpose: 'Clinical notes and documentation',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id'],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'lab_requests',
          purpose: 'Laboratory order requests',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id'],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'imaging_requests',
          purpose: 'Imaging order requests',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id'],
          timestamps: ['created_at', 'updated_at']
        }
      ]
    },
    {
      id: 'communications',
      title: 'Communications',
      icon: 'solar:chat-round-dots-bold-duotone',
      lastUpdated: '2025-07-11 11:00:00 UTC',
      description: 'Centralized communication system handling all SMS, email, and automated messaging with full tracking and compliance.',
      color: 'amber',
      bgGradient: 'from-amber-500 to-orange-600',
      tables: [
        {
          name: 'practice_sms_logs',
          purpose: 'SMS tracking and delivery logs',
          keyRelations: ['practice_id → practices.id', 'patient_id → patients.id'],
          timestamps: ['created_at', 'sent_at', 'delivered_at']
        },
        {
          name: 'practice_email_logs',
          purpose: 'Email tracking and delivery logs',
          keyRelations: ['practice_id → practices.id', 'patient_id → patients.id'],
          timestamps: ['created_at', 'sent_at', 'delivered_at']
        },
        {
          name: 'automation_templates',
          purpose: 'Message templates for automation',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'automation_queue',
          purpose: 'Scheduled messages queue',
          keyRelations: ['execution_id → automation_executions.id'],
          timestamps: ['created_at', 'scheduled_for', 'processed_at']
        }
      ]
    },
    {
      id: 'finance',
      title: 'Finance & Operations',
      icon: 'solar:wallet-money-bold-duotone',
      lastUpdated: '2025-07-11 11:00:00 UTC',
      description: 'Complete financial management including invoicing, payments, medical aid claims, HR/payroll, and operational reporting.',
      color: 'emerald',
      bgGradient: 'from-emerald-500 to-teal-600',
      tables: [
        {
          name: 'invoices_enhanced',
          purpose: 'Invoice management with enhanced features',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id', 'practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at', 'paid_at']
        },
        {
          name: 'invoice_services',
          purpose: 'Invoice line items and services',
          keyRelations: ['invoice_id → invoices_enhanced.id'],
          timestamps: ['created_at']
        },
        {
          name: 'payments',
          purpose: 'Payment records and transactions',
          keyRelations: ['invoice_id → invoices_enhanced.id'],
          timestamps: ['created_at', 'processed_at']
        },
        {
          name: 'batch_headers',
          purpose: 'Medical aid batch submissions',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'submitted_at']
        }
      ]
    },
    {
      id: 'settings',
      title: 'Settings & Configuration',
      icon: 'solar:settings-bold-duotone',
      lastUpdated: '2025-07-11 11:00:00 UTC',
      description: 'System configuration, practice management, user administration, and integration settings.',
      color: 'slate',
      bgGradient: 'from-slate-500 to-gray-700',
      tables: [
        {
          name: 'practices',
          purpose: 'Practice information and settings',
          keyRelations: [],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'branches',
          purpose: 'Multi-location branch management',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at']
        },
        {
          name: 'users',
          purpose: 'User accounts and profiles',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at', 'last_login_at']
        },
        {
          name: 'practice_tariffs',
          purpose: 'Service pricing and tariffs',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at']
        }
      ]
    }
  ]

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
    setExpandedTable(null)
  }

  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName)
  }

  const getSectionColorClasses = (color: string) => {
    const colorMap = {
      purple: 'bg-purple-500 text-white',
      cyan: 'bg-cyan-500 text-white',
      amber: 'bg-amber-500 text-white',
      emerald: 'bg-emerald-500 text-white',
      slate: 'bg-slate-500 text-white'
    }
    return colorMap[color as keyof typeof colorMap] || 'bg-gray-500 text-white'
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-onehealth-600 to-purple-700 text-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Icon icon="solar:blueprint-bold-duotone" className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-4xl font-bold font-poppins">OneHealth System Blueprint</h1>
              <p className="text-white/80 mt-2 font-montserrat">Version 5.0 • Last Updated: 2025-07-11 12:00:00 UTC</p>
              <p className="text-white/90 mt-1 text-lg font-montserrat">
                Master blueprint for system architecture, workflows, and components
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-poppins">Quick Navigation</CardTitle>
            <CardDescription className="font-montserrat">Jump to any section of the blueprint</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {sections.map((section, index) => (
                <motion.button
                  key={section.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => toggleSection(section.id)}
                  className={`p-4 rounded-xl transition-all duration-200 hover:scale-105 ${
                    expandedSection === section.id 
                      ? `${getSectionColorClasses(section.color)} shadow-lg` 
                      : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <Icon icon={section.icon} className={`w-8 h-8 mx-auto mb-2 ${
                    expandedSection === section.id ? 'text-white' : `text-${section.color}-500`
                  }`} />
                  <p className={`text-sm font-medium font-montserrat ${
                    expandedSection === section.id ? 'text-white' : 'text-gray-700'
                  }`}>{section.title}</p>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {sections.map((section) => (
          <motion.div
            key={section.id}
            layout
            className="bg-white rounded-xl shadow-lg overflow-hidden"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 bg-gradient-to-br ${section.bgGradient} rounded-xl text-white`}>
                  <Icon icon={section.icon} className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-gray-800 font-poppins">{section.title}</h2>
                  <p className="text-sm text-gray-500 font-montserrat">Last updated: {section.lastUpdated}</p>
                </div>
              </div>
              {expandedSection === section.id ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {/* Section Content */}
            <AnimatePresence>
              {expandedSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-gray-100"
                >
                  <div className="p-6">
                    <p className="text-gray-600 mb-6 font-montserrat">{section.description}</p>

                    {/* Tables Overview */}
                    <Card className="mb-6">
                      <CardHeader className="bg-gray-50">
                        <CardTitle className="text-lg font-poppins flex items-center gap-2">
                          <Database className="w-5 h-5" />
                          Database Tables Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                  #
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                  Table Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                  Purpose
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                  Key Relations
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                  Forms
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                  Timestamps
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {section.tables.map((table) => (
                                <tr key={table.name} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleTable(table.name)}>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {tableNumbering[table.name] || 'X.0'}
                                    </Badge>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                      className={`${rubik.className} text-sm px-2 py-1 rounded flex items-center gap-1 ${getTableColor(table.name)}`}
                                    >
                                      {table.name}
                                      {table.fields && (
                                        <Info className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600 font-montserrat">{table.purpose}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                      {table.keyRelations.map((relation, idx) => (
                                        <div key={idx} className="text-xs">
                                          {formatRelation(relation)}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {table.forms && table.forms.length > 0 ? (
                                      <Badge variant="secondary" className="text-xs">
                                        {table.forms.length} forms
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-xs text-gray-500">
                                    {table.timestamps.map((ts) => (
                                      <div key={ts} className="font-mono flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {ts}
                                      </div>
                                    ))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Expanded Table Details */}
                    <AnimatePresence>
                      {expandedTable && section.tables.find(t => t.name === expandedTable)?.fields && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <Card className="bg-blue-50 border-blue-200">
                            <CardHeader>
                              <CardTitle className="text-lg font-poppins flex items-center gap-2">
                                <Database className="w-5 h-5" />
                                Table: <code className="bg-white px-2 py-1 rounded text-onehealth-600">{expandedTable}</code>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {/* Collapsible Section Component */}
                              {(() => {
                                const currentTable = section.tables.find(t => t.name === expandedTable)
                                
                                const CollapsibleSection = ({ 
                                  title, 
                                  icon, 
                                  count, 
                                  children, 
                                  sectionKey,
                                  colorClass = "bg-gray-50"
                                }: { 
                                  title: string
                                  icon: React.ReactNode
                                  count: number
                                  children: React.ReactNode
                                  sectionKey: string
                                  colorClass?: string
                                }) => {
                                  const isExpanded = expandedSubsections[sectionKey] ?? false
                                  
                                  return (
                                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                                      <button
                                        onClick={() => toggleSubsection(sectionKey)}
                                        className={`w-full px-4 py-3 ${colorClass} hover:bg-opacity-80 transition-colors flex items-center justify-between`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {icon}
                                          <span className="font-semibold text-gray-800 font-poppins">{title}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Badge variant="secondary" className="font-medium">
                                            {count} {count === 1 ? 'item' : 'items'}
                                          </Badge>
                                          {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-gray-500" />
                                          ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-500" />
                                          )}
                                        </div>
                                      </button>
                                      <AnimatePresence>
                                        {isExpanded && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="px-4 py-3 bg-white"
                                          >
                                            {children}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <>
                                    {/* Forms That Modify This Table */}
                                    {currentTable?.forms && currentTable.forms.length > 0 && (
                                      <CollapsibleSection
                                        title="Forms That Modify This Table"
                                        icon={<Icon icon="solar:programming-bold-duotone" className="w-5 h-5 text-purple-600" />}
                                        count={currentTable.forms.length}
                                        sectionKey={`${expandedTable}-forms`}
                                        colorClass="bg-purple-50"
                                      >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          {currentTable.forms.map((form, idx) => {
                                            const [formName, description] = form.split(' - ')
                                            return (
                                              <div key={idx} className="group">
                                                <div className="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                                  <Icon icon="solar:document-bold-duotone" className="w-5 h-5 text-purple-500 mt-0.5" />
                                                  <div className="flex-1">
                                                    <div className="font-medium text-gray-900 text-sm">{formName}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                                                  </div>
                                                </div>
                                                {/* Show data journey if exists */}
                                                {currentTable.formWorkflows?.find(fw => fw.formName === formName) && (
                                                  <CollapsibleSection
                                                    title="View Data Journey"
                                                    icon={<GitBranch className="w-4 h-4 text-indigo-600" />}
                                                    count={currentTable.formWorkflows.find(fw => fw.formName === formName)?.dataFlow.length || 0}
                                                    sectionKey={`${expandedTable}-${formName}-journey`}
                                                    colorClass="bg-indigo-50"
                                                  >
                                                    {currentTable.formWorkflows?.find(fw => fw.formName === formName) && (
                                                      <DataJourneyVisualization 
                                                        workflow={currentTable.formWorkflows.find(fw => fw.formName === formName)!}
                                                      />
                                                    )}
                                                  </CollapsibleSection>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </CollapsibleSection>
                                    )}

                                    {/* Tables That Reference This Table */}
                              {section.tables.find(t => t.name === expandedTable)?.usedBy && (
                                <div className="mb-6">
                                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 font-poppins">
                                    <Icon icon="solar:link-bold-duotone" className="w-5 h-5" />
                                    Tables That Reference This Table
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {section.tables.find(t => t.name === expandedTable)?.usedBy?.map((usage, idx) => {
                                      const [tableName, description] = usage.split(' - ')
                                      return (
                                        <div key={idx} className="bg-gray-50 p-2 rounded">
                                          <span className={`px-1.5 py-0.5 rounded text-xs ${rubik.className} ${getTableColor(tableName)}`}>
                                            {tableName}
                                          </span>
                                          <span className="text-xs text-gray-600 ml-2">{description}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Tables Referenced By This Table */}
                              {section.tables.find(t => t.name === expandedTable)?.referencedTables && (
                                <div className="mb-6">
                                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 font-poppins">
                                    <Icon icon="solar:link-round-angle-bold-duotone" className="w-5 h-5" />
                                    Tables Referenced By This Table
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {section.tables.find(t => t.name === expandedTable)?.referencedTables?.map((ref, idx) => {
                                      const [tableName, description] = ref.split(' - ')
                                      return (
                                        <div key={idx} className="bg-blue-50 p-2 rounded">
                                          <span className={`px-1.5 py-0.5 rounded text-xs ${rubik.className} ${getTableColor(tableName)}`}>
                                            {tableName}
                                          </span>
                                          <span className="text-xs text-gray-600 ml-2">{description}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Database Functions */}
                              {section.tables.find(t => t.name === expandedTable)?.functions && (
                                <div className="mb-6">
                                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 font-poppins">
                                    <Icon icon="solar:code-square-bold-duotone" className="w-5 h-5" />
                                    Database Functions
                                  </h5>
                                  <div className="grid grid-cols-1 gap-2">
                                    {section.tables.find(t => t.name === expandedTable)?.functions?.map((func, idx) => (
                                      <div key={idx} className="flex items-center gap-2 bg-orange-50 p-2 rounded">
                                        <Icon icon="solar:function-bold-duotone" className="w-4 h-4 text-orange-600" />
                                        <code className="text-sm text-orange-700">{func}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Edge Functions */}
                              {section.tables.find(t => t.name === expandedTable)?.edgeFunctions && (
                                <div className="mb-6">
                                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 font-poppins">
                                    <Server className="w-5 h-5" />
                                    Edge Functions
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {section.tables.find(t => t.name === expandedTable)?.edgeFunctions?.map((func, idx) => (
                                      <div key={idx} className="flex items-center gap-2 bg-green-50 p-2 rounded">
                                        <Icon icon="solar:cloud-bold-duotone" className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-green-700">{func}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Form Workflows - Data Journey */}
                              {section.tables.find(t => t.name === expandedTable)?.formWorkflows && (
                                <div className="mb-6">
                                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 font-poppins">
                                    <GitBranch className="w-5 h-5" />
                                    Form Data Journey
                                  </h5>
                                  {section.tables.find(t => t.name === expandedTable)?.formWorkflows?.map((workflow, idx) => (
                                    <div key={idx} className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg mb-4">
                                      <h6 className="font-semibold text-gray-800 mb-2">{workflow.formName}</h6>
                                      <p className="text-sm text-gray-600 mb-4">{workflow.description}</p>
                                      
                                      {/* Visual Flow Diagram */}
                                      <div className="relative">
                                        {workflow.dataFlow.map((flow, flowIdx) => {
                                          const getFlowIcon = () => {
                                            switch (flow.type) {
                                              case 'user': return <User className="w-5 h-5" />
                                              case 'system': return <Icon icon="solar:settings-bold-duotone" className="w-5 h-5" />
                                              case 'database': return <Database className="w-5 h-5" />
                                              case 'trigger': return <Zap className="w-5 h-5" />
                                              case 'edge-function': return <Server className="w-5 h-5" />
                                              default: return <Icon icon="solar:circle-bold-duotone" className="w-5 h-5" />
                                            }
                                          }
                                          
                                          const getFlowColor = () => {
                                            switch (flow.type) {
                                              case 'user': return 'bg-blue-100 text-blue-700 border-blue-300'
                                              case 'system': return 'bg-gray-100 text-gray-700 border-gray-300'
                                              case 'database': return 'bg-purple-100 text-purple-700 border-purple-300'
                                              case 'trigger': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                              case 'edge-function': return 'bg-green-100 text-green-700 border-green-300'
                                              default: return 'bg-gray-100 text-gray-700 border-gray-300'
                                            }
                                          }
                                          
                                          return (
                                            <div key={flowIdx} className="flex items-start gap-4 mb-4">
                                              <div className="flex-shrink-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getFlowColor()} border-2`}>
                                                  {flow.step}
                                                </div>
                                                {flowIdx < workflow.dataFlow.length - 1 && (
                                                  <div className="w-0.5 h-12 bg-gray-300 mx-auto mt-1"></div>
                                                )}
                                              </div>
                                              <div className="flex-grow">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getFlowColor()}`}>
                                                  {getFlowIcon()}
                                                  <span>{flow.action}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{flow.description}</p>
                                              </div>
                                              {flowIdx < workflow.dataFlow.length - 1 && (
                                                <ArrowRight className="w-5 h-5 text-gray-400 mt-2 flex-shrink-0" />
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Fields Table - Data Dictionary */}
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 font-poppins">
                                <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />
                                Data Dictionary
                              </h5>
                              <div className="bg-white rounded-lg overflow-hidden mb-4">
                                <table className="w-full">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        #
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        Field Name
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        Data Type
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        Description
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        Constraints
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        Default
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-montserrat">
                                        Example
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {section.tables.find(t => t.name === expandedTable)?.fields?.map((field, fieldIdx) => (
                                      <tr key={field.name} className="hover:bg-gray-50">
                                        <td className="px-3 py-3">
                                          <span className="text-xs font-medium text-gray-500">{fieldIdx + 1}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-1">
                                            <span className={`text-sm font-semibold ${rubik.className}`}>
                                              {field.name}
                                            </span>
                                            {field.isPrimaryKey && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded">
                                                <Icon icon="solar:key-bold-duotone" className="w-3 h-3 mr-0.5" />
                                                PK
                                              </span>
                                            )}
                                            {field.isForeignKey && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded">
                                                <Icon icon="solar:link-minimalistic-bold-duotone" className="w-3 h-3 mr-0.5" />
                                                FK
                                              </span>
                                            )}
                                            {field.isUnique && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded">
                                                UQ
                                              </span>
                                            )}
                                            {field.required && <span className="text-red-500">*</span>}
                                          </div>
                                          {field.references && (
                                            <div className="text-xs mt-1">
                                              <Icon icon="solar:arrow-right-line-duotone" className="w-3 h-3 inline mr-1 text-gray-400" />
                                              <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${getTableColor(field.references.split('.')[0])}`}>
                                                {field.references}
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={`font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded ${rubik.className}`}>
                                            {field.dataType}
                                          </span>
                                        </td>
                                        <td className="px-6 py-3">
                                          <p className="text-xs text-gray-600 font-montserrat leading-relaxed">
                                            {field.description}
                                          </p>
                                        </td>
                                        <td className="px-4 py-3">
                                          {field.constraints && field.constraints.length > 0 ? (
                                            <div className="space-y-1">
                                              {field.constraints.map((constraint, idx) => (
                                                <div key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                  <code>{constraint}</code>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {field.defaultValue ? (
                                            <code className="text-xs bg-yellow-100 px-2 py-1 rounded">
                                              {field.defaultValue}
                                            </code>
                                          ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {field.example ? (
                                            <code className="text-xs bg-blue-50 px-2 py-1 rounded text-blue-700">
                                              {field.example}
                                            </code>
                                          ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Triggers */}
                              {section.tables.find(t => t.name === expandedTable)?.triggers && (
                                <div className="bg-green-100 rounded-lg p-4">
                                  <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2 font-poppins">
                                    <Zap className="w-5 h-5" />
                                    Active Triggers
                                  </h5>
                                  {section.tables.find(t => t.name === expandedTable)?.triggers?.map((trigger, idx) => (
                                    <div key={idx} className="text-sm text-green-700 flex items-center gap-2 mb-1 font-montserrat">
                                      <CheckCircle className="w-4 h-4" />
                                      <code>{trigger}</code>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="mt-4 text-xs text-gray-500 font-montserrat">
                                <span className="text-red-500">*</span> Required fields
                              </div>
                                  </>
                                )}
                              })()
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* World-Class UI Suggestions */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-xl font-poppins flex items-center gap-2">
              <Icon icon="solar:star-bold-duotone" className="w-6 h-6 text-purple-600" />
              World-Class UI Enhancement Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-purple-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Interactive Visualizations</h4>
                    <p className="text-xs text-gray-600">Add D3.js powered relationship graphs and data flow animations</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon icon="solar:search-minimalistic-bold-duotone" className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Smart Search</h4>
                    <p className="text-xs text-gray-600">Implement fuzzy search with AI-powered suggestions across all tables</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Icon icon="solar:export-bold-duotone" className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Export Options</h4>
                    <p className="text-xs text-gray-600">Add PDF, Markdown, and Mermaid diagram export capabilities</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-orange-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Icon icon="solar:presentation-graph-bold-duotone" className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Presentation Mode</h4>
                    <p className="text-xs text-gray-600">Full-screen mode for technical presentations and training</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-indigo-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Icon icon="solar:code-bold-duotone" className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Code Generation</h4>
                    <p className="text-xs text-gray-600">Generate TypeScript interfaces and SQL queries from schema</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-pink-100">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Icon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">AI Assistant</h4>
                    <p className="text-xs text-gray-600">Integrated chatbot for schema questions and best practices</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-onehealth-600 to-purple-700 text-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h3 className="text-2xl font-bold font-poppins mb-2">OneHealth System Blueprint</h3>
            <p className="text-white/80 font-montserrat">Version 5.0 • Living Documentation</p>
            <p className="text-white/90 mt-2 text-sm font-montserrat max-w-2xl mx-auto">
              This comprehensive technical reference provides deep insights into the OneHealth system architecture, 
              data relationships, and workflows. Use it to understand, maintain, and extend the platform.
            </p>
            <div className="flex justify-center gap-4 mt-6">
              <Button variant="secondary" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="secondary" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <Icon icon="solar:share-bold-duotone" className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="secondary" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <Icon icon="solar:chat-round-dots-bold-duotone" className="w-4 h-4 mr-2" />
                Feedback
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}