'use client'

import React, { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ChevronDown, Database, Zap, GitBranch, Server, User, ArrowRight, Search } from 'lucide-react'
import { Rubik, Montserrat } from 'next/font/google'

const rubik = Rubik({ subsets: ['latin'] })
const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['400', '500', '600']
})

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
  detailedDescription?: string
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
  triggers?: Array<{ name: string; description: string; lastUpdated: string }>
  forms?: Array<{ name: string; description: string; lastUpdated: string }>
  formWorkflows?: FormWorkflow[]
  referencedBy?: string[]
  references?: string[]
  dbFunctions?: Array<{ name: string; description: string; lastUpdated: string }>
  edgeFunctions?: Array<{ name: string; description: string; lastUpdated: string }>
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

// Enhanced Collapsible Section Component
interface CollapsibleSectionProps {
  title: string
  itemCount?: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  lastUpdated?: string
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  itemCount, 
  isExpanded, 
  onToggle, 
  children, 
  className = '',
  icon,
  lastUpdated
}) => {
  return (
    <div className={`border rounded-lg bg-white ${className}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-gray-500">{icon}</div>}
          <h4 className={`font-semibold text-gray-800 ${rubik.className}`}>{title}</h4>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Last updated: {lastUpdated}
            </span>
          )}
          {itemCount !== undefined && (
            <Badge variant="secondary" className="text-xs font-normal">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Badge>
          )}
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </div>
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
            <div className="px-4 pb-4 border-t border-gray-100">
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
    <div className="space-y-3 mt-4">
      {workflow.dataFlow.map((step, index) => (
        <div key={index} className="flex items-start gap-3 relative">
          <div className="flex-shrink-0 mt-0.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${getStepColor(step.type)}`}>
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
            <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
          </div>
          {index < workflow.dataFlow.length - 1 && (
            <div className="absolute left-4 top-10 w-0.5 h-16 bg-gradient-to-b from-gray-200 to-gray-100" />
          )}
        </div>
      ))}
    </div>
  )
}

// Enhanced Table Relationship Visualization Component
const TableRelationshipDiagram: React.FC<{ 
  currentTable: string
  referencedBy?: string[]
  references?: string[]
  getTableColor: (table: string) => string
  keyRelations?: string[]
  sections: Section[]
  setExpandedSection: (section: string | null) => void
  setExpandedTable: (table: string | null) => void
  setExpandedSubsections: (subsections: Record<string, boolean>) => void
}> = ({ currentTable, referencedBy, references, getTableColor, keyRelations = [], sections, setExpandedSection, setExpandedTable, setExpandedSubsections }) => {
  // Parse relationships to extract field mappings
  const parseRelationships = (relations: string[]) => {
    const parsed: Record<string, { localField: string; targetField: string }> = {}
    relations.forEach(rel => {
      const [localField, target] = rel.split(' → ')
      if (target) {
        const [targetTable, targetField] = target.split('.')
        if (targetTable && targetField) {
          parsed[targetTable] = { localField, targetField }
        }
      }
    })
    return parsed
  }

  const outgoingRelations = parseRelationships(keyRelations || [])

  return (
    <div className="bg-gradient-to-br from-gray-50/50 to-white rounded-lg border border-gray-200 shadow-sm p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incoming References */}
        <div>
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-gray-100">
            <Icon icon="solar:arrow-to-down-left-bold-duotone" className="w-4 h-4 text-green-600" />
            <h5 className={`font-bold text-xs text-gray-900 ${rubik.className}`}>Incoming References</h5>
            <span className="ml-auto px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
              {referencedBy?.length || 0}
            </span>
          </div>
          
          {referencedBy && referencedBy.length > 0 ? (
            <div className="grid grid-cols-1 gap-1">
              {referencedBy.map((table, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => {
                    const targetSection = sections.find(s => 
                      s.tables.some(t => t.name === table)
                    )
                    if (targetSection) {
                      setExpandedSection(targetSection.id)
                      setExpandedTable(table)
                      setExpandedSubsections({})
                    }
                  }}
                  className="w-full group text-left"
                >
                  <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 transition-all duration-150">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${getTableColor(table).replace('text-', 'bg-').replace('-700', '-500')}`} />
                    <span className={`font-semibold text-xs text-gray-800 group-hover:text-blue-600 ${rubik.className}`}>
                      {table}
                    </span>
                    <span className={`text-xs text-gray-500 ${montserrat.className}`}>
                      .{currentTable}_id → id
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-gray-400">No incoming references</p>
            </div>
          )}
        </div>

        {/* Outgoing References */}
        <div>
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-gray-100">
            <Icon icon="solar:arrow-from-up-left-bold-duotone" className="w-4 h-4 text-purple-600" />
            <h5 className={`font-bold text-xs text-gray-900 ${rubik.className}`}>Outgoing References</h5>
            <span className="ml-auto px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
              {references?.length || 0}
            </span>
          </div>
          
          {references && references.length > 0 ? (
            <div className="grid grid-cols-1 gap-1">
              {references.map((table, idx) => {
                const relation = outgoingRelations[table]
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => {
                      const targetSection = sections.find(s => 
                        s.tables.some(t => t.name === table)
                      )
                      if (targetSection) {
                        setExpandedSection(targetSection.id)
                        setExpandedTable(table)
                        setExpandedSubsections({})
                      }
                    }}
                    className="w-full group text-left"
                  >
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 transition-all duration-150">
                      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${getTableColor(table).replace('text-', 'bg-').replace('-700', '-500')}`} />
                      <span className={`font-semibold text-xs text-gray-800 group-hover:text-blue-600 ${rubik.className}`}>
                        {table}
                      </span>
                      {relation && (
                        <span className={`text-xs text-gray-500 ${montserrat.className}`}>
                          {relation.localField} → {relation.targetField}
                        </span>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-gray-400">No outgoing references</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SystemBlueprintPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('patients')
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [expandedSubsections, setExpandedSubsections] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')

  const toggleSubsection = (key: string) => {
    setExpandedSubsections(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
    setExpandedTable(null)
    setExpandedSubsections({})
  }

  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName)
    if (expandedTable !== tableName) {
      // Reset subsections when opening a new table
      setExpandedSubsections({})
    }
  }

  // Generate consistent colors for table names
  const tableColorMap = useMemo(() => {
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-green-100 text-green-700 border-green-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-pink-100 text-pink-700 border-pink-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-red-100 text-red-700 border-red-200',
      'bg-yellow-100 text-yellow-700 border-yellow-200',
      'bg-cyan-100 text-cyan-700 border-cyan-200',
      'bg-orange-100 text-orange-700 border-orange-200',
      'bg-teal-100 text-teal-700 border-teal-200',
      'bg-lime-100 text-lime-700 border-lime-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-violet-100 text-violet-700 border-violet-200',
      'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
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
    return tableColorMap[tableName] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const formatRelation = (relation: string) => {
    const parts = relation.split(' → ')
    if (parts.length === 2) {
      const [field, target] = parts
      const [targetTable] = target.split('.')
      return (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-xs text-gray-600">{field}</span>
          <Icon icon="solar:arrow-right-linear" className="w-3 h-3 text-gray-400" />
          <span className={`px-2 py-0.5 rounded-md text-xs font-mono border ${getTableColor(targetTable)}`}>
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
          keyRelations: ['practice_id → practices.id', 'created_by → users.id', 'updated_by → users.id'],
          timestamps: ['created_at', 'updated_at'],
          referencedBy: ['visits', 'medical_records', 'lab_requests', 'imaging_requests', 'invoices_enhanced', 'patient_documents', 'patient_media', 'medical_aid_details', 'next_of_kin'],
          references: ['practices', 'users'],
          fields: [
            { 
              name: 'id', 
              dataType: 'UUID', 
              description: 'Primary key identifier',
              detailedDescription: 'Universally unique identifier (UUID v4) that serves as the primary key for the patient record. Auto-generated on insert using uuid_generate_v4() function.',
              isPrimaryKey: true,
              defaultValue: 'uuid_generate_v4()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            { 
              name: 'first_name', 
              dataType: 'TEXT', 
              description: 'Patient\'s first name',
              detailedDescription: 'The given name or first name of the patient. This field is required and must contain at least 2 characters. Used in all patient identification displays throughout the system.',
              required: true,
              constraints: ['NOT NULL', 'MIN LENGTH 2'],
              example: 'John'
            },
            { 
              name: 'last_name', 
              dataType: 'TEXT', 
              description: 'Patient\'s surname',
              detailedDescription: 'The family name or surname of the patient. Required field used for patient identification and must match government ID documents for billing purposes.',
              required: true,
              constraints: ['NOT NULL', 'MIN LENGTH 2'],
              example: 'Doe'
            },
            { 
              name: 'id_number', 
              dataType: 'TEXT', 
              description: 'National ID number',
              detailedDescription: 'Namibian national identification number. Must be unique across the system and follow the format: YYMMDDNNNNN. Used for medical aid claims and government reporting.',
              required: true,
              isUnique: true,
              constraints: ['NOT NULL', 'UNIQUE', 'REGEX: ^[0-9]{11}$'],
              example: '92041000123'
            },
            { 
              name: 'date_of_birth', 
              dataType: 'DATE', 
              description: 'Birth date',
              detailedDescription: 'Patient\'s date of birth used for age calculations, pediatric/geriatric care protocols, and medical aid verification. Must be a valid past date.',
              required: true,
              constraints: ['NOT NULL', 'CHECK (date_of_birth <= CURRENT_DATE)'],
              example: '1990-05-15'
            },
            { 
              name: 'gender', 
              dataType: 'TEXT', 
              description: 'Gender',
              detailedDescription: 'Biological gender of the patient. Used for gender-specific medical protocols, normal value ranges, and statistical reporting.',
              required: true,
              constraints: ['CHECK (gender IN (\'male\', \'female\', \'other\'))'],
              example: 'male'
            },
            { 
              name: 'marital_status', 
              dataType: 'TEXT', 
              description: 'Marital status',
              detailedDescription: 'Current marital status of the patient. Used for emergency contact preferences and certain insurance/medical aid requirements.',
              constraints: ['CHECK (marital_status IN (\'single\', \'married\', \'divorced\', \'widowed\', \'separated\'))'],
              example: 'single'
            },
            { 
              name: 'occupation', 
              dataType: 'TEXT', 
              description: 'Current occupation',
              detailedDescription: 'Patient\'s current occupation or profession. Important for occupational health assessments and work-related injury claims.',
              example: 'Teacher'
            },
            { 
              name: 'employer', 
              dataType: 'TEXT', 
              description: 'Employer name',
              detailedDescription: 'Name of the patient\'s current employer. Used for corporate medical aid schemes and occupational health services.',
              example: 'Ministry of Education'
            },
            { 
              name: 'home_language', 
              dataType: 'TEXT', 
              description: 'Preferred language',
              detailedDescription: 'Patient\'s preferred language for communication. Ensures consent forms and medical information are provided in the appropriate language.',
              example: 'English'
            },
            { 
              name: 'cell_number', 
              dataType: 'TEXT', 
              description: 'Mobile phone',
              detailedDescription: 'Primary mobile contact number. Used for appointment reminders, emergency contact, and SMS notifications. Must include country code.',
              constraints: ['REGEX: ^\\+264[0-9]{9}$'],
              example: '+264811234567'
            },
            { 
              name: 'email', 
              dataType: 'TEXT', 
              description: 'Email address',
              detailedDescription: 'Patient\'s email address for digital communications, appointment confirmations, and invoice delivery. Must be valid email format.',
              constraints: ['EMAIL FORMAT'],
              example: 'john.doe@example.com'
            },
            { 
              name: 'home_address', 
              dataType: 'TEXT', 
              description: 'Physical address',
              detailedDescription: 'Complete physical home address including street, suburb, and city. Used for home visits, emergency services, and demographic analysis.',
              example: '123 Independence Avenue, Klein Windhoek, Windhoek'
            },
            { 
              name: 'postal_address', 
              dataType: 'TEXT', 
              description: 'Mailing address',
              detailedDescription: 'Postal address for receiving physical mail, statements, and official documents. May differ from home address.',
              example: 'P.O. Box 123, Windhoek'
            },
            { 
              name: 'postal_code', 
              dataType: 'TEXT', 
              description: 'Postal code',
              detailedDescription: 'Postal code for the mailing address. Used for geographic analysis and mail delivery optimization.',
              example: '9000'
            },
            { 
              name: 'practice_id', 
              dataType: 'UUID', 
              description: 'Associated practice',
              detailedDescription: 'Foreign key linking patient to their primary practice. Enforces multi-tenant data isolation and determines pricing rules.',
              isForeignKey: true,
              references: 'practices.id',
              example: '456e7890-e89b-12d3-a456-426614174000'
            },
            { 
              name: 'system_patient_reference_number', 
              dataType: 'INTEGER', 
              description: 'System reference',
              detailedDescription: 'Auto-generated sequential reference number unique per practice. Format: P000001. Used for human-readable patient identification.',
              required: true,
              defaultValue: 'Generated by trigger',
              example: '1234'
            },
            { 
              name: 'created_at', 
              dataType: 'TIMESTAMPTZ', 
              description: 'Creation timestamp',
              detailedDescription: 'Timestamp when the patient record was first created. Automatically set by database and used for audit trails.',
              defaultValue: 'now()',
              example: '2025-07-11 10:30:00+00'
            },
            { 
              name: 'updated_at', 
              dataType: 'TIMESTAMPTZ', 
              description: 'Last modified',
              detailedDescription: 'Timestamp of the last modification to any field in this record. Automatically updated by trigger on any change.',
              defaultValue: 'now()',
              example: '2025-07-11 10:30:00+00'
            }
          ],
          triggers: [
            { 
              name: 'trigger_assign_system_patient_reference_number',
              description: 'Auto-generates unique patient reference numbers per practice',
              lastUpdated: '2025-01-10'
            },
            { 
              name: 'audit_patients_trigger',
              description: 'Creates comprehensive audit trail entries for all changes',
              lastUpdated: '2025-01-05'
            },
            { 
              name: 'trigger_queue_welcome_patient',
              description: 'Queues welcome messages/automations for new patients',
              lastUpdated: '2025-01-08'
            },
            { 
              name: 'patient_created_automation_trigger',
              description: 'Handles automation when new patients are created',
              lastUpdated: '2025-01-06'
            },
            { 
              name: 'daily_check_on_patient_activity',
              description: 'Processes daily automation checks for patient activities',
              lastUpdated: '2024-12-20'
            },
            { 
              name: 'process_automations_on_patient_activity',
              description: 'Processes automations opportunistically on patient updates',
              lastUpdated: '2024-12-15'
            }
          ],
          dbFunctions: [
            { 
              name: 'get_next_system_patient_reference_number()',
              description: 'Generates next sequential patient reference',
              lastUpdated: '2025-01-10'
            },
            { 
              name: 'get_patients_with_full_data(p_practice_id)',
              description: 'Fetches patient data with visits and medical aid info',
              lastUpdated: '2025-01-12'
            },
            { 
              name: 'get_patient_activity_status(p_patient_id, p_practice_id)',
              description: 'Returns patient activity status as JSONB',
              lastUpdated: '2025-01-08'
            },
            { 
              name: 'refresh_patient_location_density()',
              description: 'Updates patient location density data',
              lastUpdated: '2024-12-15'
            },
            { 
              name: 'queue_welcome_patient_automation()',
              description: 'Queues welcome messages for new patients',
              lastUpdated: '2025-01-05'
            },
            { 
              name: 'process_patient_automation_queue()',
              description: 'Processes automation queue for patients',
              lastUpdated: '2024-12-28'
            }
          ],
          edgeFunctions: [
            { 
              name: 'ai-search-patients',
              description: 'AI-powered patient search functionality',
              lastUpdated: '2025-01-12'
            },
            { 
              name: 'process-automation-queue',
              description: 'Processes patient automation queue (welcome messages, follow-ups)',
              lastUpdated: '2025-01-10'
            },
            { 
              name: 'centralized-sms-gateway',
              description: 'Sends SMS to patients for appointments and reminders',
              lastUpdated: '2025-01-11'
            },
            { 
              name: 'centralized-email-gateway',
              description: 'Sends emails to patients for invoices and reports',
              lastUpdated: '2025-01-09'
            },
            { 
              name: 'send-appointment-reminders',
              description: 'Handles patient appointment reminders',
              lastUpdated: '2025-01-06'
            }
          ],
          forms: [
            { 
              name: 'ModernPatientRegistrationForm.tsx',
              description: 'Primary registration form',
              lastUpdated: '2025-01-11'
            },
            { 
              name: 'EditPatientForm.tsx',
              description: 'Patient profile editing',
              lastUpdated: '2025-01-09'
            },
            { 
              name: 'PatientSearchSelect.tsx',
              description: 'Patient search component',
              lastUpdated: '2024-12-20'
            },
            { 
              name: 'QuickPatientRegistration.tsx',
              description: 'Quick registration modal',
              lastUpdated: '2025-01-07'
            }
          ],
          formWorkflows: [
            {
              formName: 'ModernPatientRegistrationForm.tsx',
              description: 'Primary patient registration workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Navigate to Form',
                  description: 'User clicks "Add Patient" button on Patients page or dashboard',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Form Opens',
                  description: 'Modern registration form loads with empty fields and placeholders',
                  type: 'system'
                },
                {
                  step: 3,
                  action: 'Enter Personal Details',
                  description: 'User fills: First Name*, Last Name*, ID Number*, Date of Birth*, Gender*',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'ID Validation',
                  description: 'Frontend validates 11-digit Namibian ID format as user types',
                  type: 'system'
                },
                {
                  step: 5,
                  action: 'Enter Contact Info',
                  description: 'User fills: Cell Number (+264...), Email, Home Address, Postal Address',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Phone Validation',
                  description: 'Frontend validates +264 format and 9 digits after country code',
                  type: 'system'
                },
                {
                  step: 7,
                  action: 'Enter Demographics',
                  description: 'User selects: Marital Status, Home Language, fills Occupation, Employer',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Medical Aid Toggle',
                  description: 'User toggles "Has Medical Aid" switch - shows/hides aid fields',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Medical Aid Details',
                  description: 'If enabled: Select Provider, Enter Member Number, Plan, Dependants',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Next of Kin',
                  description: 'User adds emergency contact: Name, Relationship, Phone Number',
                  type: 'user'
                },
                {
                  step: 11,
                  action: 'Form Validation',
                  description: 'Frontend validates all required fields marked with red asterisk (*)',
                  type: 'system'
                },
                {
                  step: 12,
                  action: 'Submit Click',
                  description: 'User clicks "Register Patient" button at bottom of form',
                  type: 'user'
                },
                {
                  step: 13,
                  action: 'Loading State',
                  description: 'Button shows spinner, form fields disabled during submission',
                  type: 'system'
                },
                {
                  step: 14,
                  action: 'API Call',
                  description: 'Form data sent to Supabase via INSERT to patients table',
                  type: 'system'
                },
                {
                  step: 15,
                  action: 'Before Insert Trigger',
                  description: 'trigger_assign_system_patient_reference_number fires',
                  type: 'trigger'
                },
                {
                  step: 16,
                  action: 'Generate Reference',
                  description: 'get_next_system_patient_reference_number() creates P000123',
                  type: 'database'
                },
                {
                  step: 17,
                  action: 'Insert Patient',
                  description: 'Patient record created with all form data and auto-generated ID',
                  type: 'database'
                },
                {
                  step: 18,
                  action: 'Insert Medical Aid',
                  description: 'If provided, medical_aid_details record created linked to patient',
                  type: 'database'
                },
                {
                  step: 19,
                  action: 'Insert Next of Kin',
                  description: 'next_of_kin records created for emergency contacts',
                  type: 'database'
                },
                {
                  step: 20,
                  action: 'Audit Trail',
                  description: 'audit_patients_trigger logs creation with user details',
                  type: 'trigger'
                },
                {
                  step: 21,
                  action: 'Queue Welcome',
                  description: 'trigger_queue_welcome_patient adds to automation queue',
                  type: 'trigger'
                },
                {
                  step: 22,
                  action: 'Success Response',
                  description: 'API returns new patient ID and reference number',
                  type: 'system'
                },
                {
                  step: 23,
                  action: 'Real-time Broadcast',
                  description: 'Supabase notifies all connected clients of new patient',
                  type: 'system'
                },
                {
                  step: 24,
                  action: 'UI Success',
                  description: 'Success toast shown: "Patient P000123 registered successfully"',
                  type: 'system'
                },
                {
                  step: 25,
                  action: 'Navigate Away',
                  description: 'User redirected to patient list or patient profile page',
                  type: 'system'
                },
                {
                  step: 26,
                  action: 'Background SMS',
                  description: 'process-automation-queue sends welcome SMS if configured',
                  type: 'edge-function'
                }
              ]
            },
            {
              formName: 'EditPatientForm.tsx',
              description: 'Patient profile update workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Navigate to Edit',
                  description: 'User clicks Edit button on patient profile or list view',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Load Patient Data',
                  description: 'Fetch patient, medical_aid_details, next_of_kin from database',
                  type: 'database'
                },
                {
                  step: 3,
                  action: 'Form Pre-population',
                  description: 'All fields populated with existing patient data',
                  type: 'system'
                },
                {
                  step: 4,
                  action: 'User Reviews Data',
                  description: 'User sees current values in all form fields',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Modify Personal Info',
                  description: 'User updates: Name, ID, DOB, Gender (if corrections needed)',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Update Contact Details',
                  description: 'User changes: Phone, Email, Addresses as needed',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Change Demographics',
                  description: 'User updates: Marital Status, Occupation, Employer changes',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Medical Aid Changes',
                  description: 'User can: Add/Remove aid, Change provider, Update member details',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Next of Kin Updates',
                  description: 'User can: Add new contacts, Remove old ones, Update details',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Field Validation',
                  description: 'Frontend validates changed fields in real-time',
                  type: 'system'
                },
                {
                  step: 11,
                  action: 'Track Changes',
                  description: 'System tracks which fields were modified',
                  type: 'system'
                },
                {
                  step: 12,
                  action: 'Save Click',
                  description: 'User clicks "Save Changes" button',
                  type: 'user'
                },
                {
                  step: 13,
                  action: 'Confirm Dialog',
                  description: 'Optional: Show summary of changes for confirmation',
                  type: 'system'
                },
                {
                  step: 14,
                  action: 'API Update Call',
                  description: 'Send UPDATE to patients table with only changed fields',
                  type: 'system'
                },
                {
                  step: 15,
                  action: 'Update Timestamp',
                  description: 'updated_at field automatically set to current time',
                  type: 'database'
                },
                {
                  step: 16,
                  action: 'Audit Logging',
                  description: 'audit_patients_trigger captures old vs new values',
                  type: 'trigger'
                },
                {
                  step: 17,
                  action: 'Update Related',
                  description: 'Update/Insert/Delete medical_aid_details and next_of_kin',
                  type: 'database'
                },
                {
                  step: 18,
                  action: 'Activity Trigger',
                  description: 'process_automations_on_patient_activity checks for automations',
                  type: 'trigger'
                },
                {
                  step: 19,
                  action: 'Success Response',
                  description: 'API returns updated patient data',
                  type: 'system'
                },
                {
                  step: 20,
                  action: 'Real-time Update',
                  description: 'Supabase broadcasts changes to all connected clients',
                  type: 'system'
                },
                {
                  step: 21,
                  action: 'UI Feedback',
                  description: 'Success toast: "Patient details updated successfully"',
                  type: 'system'
                },
                {
                  step: 22,
                  action: 'Form Reset',
                  description: 'Form shows updated values, change tracking reset',
                  type: 'system'
                }
              ]
            },
            {
              formName: 'PatientSearchSelect.tsx',
              description: 'Patient search and selection component',
              dataFlow: [
                {
                  step: 1,
                  action: 'Component Usage',
                  description: 'User on Visit form, Invoice form, or any form needing patient selection',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Click Search Field',
                  description: 'User clicks patient search dropdown/input field',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Search Placeholder',
                  description: 'Shows: "Search by name, ID number, or reference (P000123)"',
                  type: 'system'
                },
                {
                  step: 4,
                  action: 'Type Search Term',
                  description: 'User types: "John", "920410", "P000123", or partial matches',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Debounce Timer',
                  description: 'Wait 300ms after last keystroke to avoid spam queries',
                  type: 'system'
                },
                {
                  step: 6,
                  action: 'Loading Indicator',
                  description: 'Show spinner in search field while searching',
                  type: 'system'
                },
                {
                  step: 7,
                  action: 'AI Search Call',
                  description: 'Send search term to ai-search-patients edge function',
                  type: 'edge-function'
                },
                {
                  step: 8,
                  action: 'AI Analysis',
                  description: 'AI interprets: typos, partial names, phonetic matches',
                  type: 'edge-function'
                },
                {
                  step: 9,
                  action: 'Smart Query',
                  description: 'AI generates optimized SQL with fuzzy matching',
                  type: 'edge-function'
                },
                {
                  step: 10,
                  action: 'Database Search',
                  description: 'Search patients table: first_name, last_name, id_number, reference',
                  type: 'database'
                },
                {
                  step: 11,
                  action: 'Relevance Scoring',
                  description: 'AI ranks results by relevance to search term',
                  type: 'edge-function'
                },
                {
                  step: 12,
                  action: 'Return Results',
                  description: 'Top 10 matching patients returned to frontend',
                  type: 'system'
                },
                {
                  step: 13,
                  action: 'Display Dropdown',
                  description: 'Show patient list with: Name, ID, Reference, Age',
                  type: 'system'
                },
                {
                  step: 14,
                  action: 'Highlight Matches',
                  description: 'Bold the matching parts of name/ID in results',
                  type: 'system'
                },
                {
                  step: 15,
                  action: 'Hover Preview',
                  description: 'User hovers over patient - shows additional info',
                  type: 'user'
                },
                {
                  step: 16,
                  action: 'Select Patient',
                  description: 'User clicks on desired patient from dropdown',
                  type: 'user'
                },
                {
                  step: 17,
                  action: 'Load Full Data',
                  description: 'Fetch complete patient record with medical aid info',
                  type: 'database'
                },
                {
                  step: 18,
                  action: 'Update Parent Form',
                  description: 'Selected patient data passed to parent form',
                  type: 'system'
                },
                {
                  step: 19,
                  action: 'Show Selection',
                  description: 'Display: "John Doe (P000123)" in search field',
                  type: 'system'
                },
                {
                  step: 20,
                  action: 'Enable Clear',
                  description: 'Show X button to clear selection if needed',
                  type: 'system'
                }
              ]
            },
            {
              formName: 'QuickPatientRegistration.tsx',
              description: 'Rapid patient registration modal',
              dataFlow: [
                {
                  step: 1,
                  action: 'Quick Add Button',
                  description: 'User clicks "Quick Add Patient" on Visit/Invoice form',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Modal Opens',
                  description: 'Compact modal appears with minimal fields only',
                  type: 'system'
                },
                {
                  step: 3,
                  action: 'Focus First Field',
                  description: 'Cursor auto-focuses on First Name field',
                  type: 'system'
                },
                {
                  step: 4,
                  action: 'Enter Name',
                  description: 'User types: First Name* and Last Name* (required)',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Tab to ID',
                  description: 'User presses Tab, moves to ID Number field',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Enter ID Number',
                  description: 'User types 11-digit Namibian ID (required)',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Quick ID Check',
                  description: 'Validate format, extract DOB and gender from ID',
                  type: 'system'
                },
                {
                  step: 8,
                  action: 'Auto-fill DOB',
                  description: 'Date of Birth auto-populated from ID number',
                  type: 'system'
                },
                {
                  step: 9,
                  action: 'Auto-select Gender',
                  description: 'Gender auto-selected based on ID digit',
                  type: 'system'
                },
                {
                  step: 10,
                  action: 'Enter Phone',
                  description: 'User enters cell number starting with +264',
                  type: 'user'
                },
                {
                  step: 11,
                  action: 'Quick Save Click',
                  description: 'User clicks "Quick Register" button',
                  type: 'user'
                },
                {
                  step: 12,
                  action: 'Modal Loading',
                  description: 'Button shows spinner, fields disabled',
                  type: 'system'
                },
                {
                  step: 13,
                  action: 'Fast Insert',
                  description: 'INSERT minimal data to patients table',
                  type: 'database'
                },
                {
                  step: 14,
                  action: 'Generate Reference',
                  description: 'trigger_assign_system_patient_reference_number creates P000124',
                  type: 'trigger'
                },
                {
                  step: 15,
                  action: 'Create Basic Record',
                  description: 'Patient created with flag "needs_full_registration"',
                  type: 'database'
                },
                {
                  step: 16,
                  action: 'Queue Automation',
                  description: 'trigger_queue_welcome_patient for later SMS',
                  type: 'trigger'
                },
                {
                  step: 17,
                  action: 'Return New Patient',
                  description: 'API returns patient ID and reference number',
                  type: 'system'
                },
                {
                  step: 18,
                  action: 'Modal Closes',
                  description: 'Modal automatically closes on success',
                  type: 'system'
                },
                {
                  step: 19,
                  action: 'Auto-select Patient',
                  description: 'New patient auto-selected in parent form',
                  type: 'system'
                },
                {
                  step: 20,
                  action: 'Continue Workflow',
                  description: 'User continues with Visit/Invoice creation',
                  type: 'user'
                },
                {
                  step: 21,
                  action: 'Reminder Flag',
                  description: 'System shows "Complete Registration" reminder',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'medical_aid_details',
          purpose: 'Insurance/medical aid information linking patients to providers',
          keyRelations: ['patient_id → patients.id', 'medical_aid_provider_id → medical_aid_providers.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['patients', 'medical_aid_providers'],
          referencedBy: ['batch_items', 'invoices_enhanced'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key identifier',
              isPrimaryKey: true,
              defaultValue: 'uuid_generate_v4()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Link to patient record',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['NOT NULL', 'ON DELETE CASCADE']
            },
            {
              name: 'medical_aid_provider_id',
              dataType: 'UUID',
              description: 'Link to medical aid provider',
              isForeignKey: true,
              references: 'medical_aid_providers.id',
              required: true
            },
            {
              name: 'membership_number',
              dataType: 'VARCHAR(50)',
              description: 'Medical aid membership number',
              required: true,
              example: 'MA123456789'
            },
            {
              name: 'plan_type',
              dataType: 'VARCHAR(100)',
              description: 'Medical aid plan name',
              example: 'Comprehensive Plan'
            },
            {
              name: 'main_member_name',
              dataType: 'VARCHAR(255)',
              description: 'Name of main member if patient is dependent',
              example: 'John Doe'
            },
            {
              name: 'main_member_id_number',
              dataType: 'VARCHAR(20)',
              description: 'ID number of main member',
              example: '9201015800083'
            },
            {
              name: 'relationship_to_main',
              dataType: 'VARCHAR(50)',
              description: 'Relationship to main member',
              constraints: ['CHECK (relationship_to_main IN (\'self\', \'spouse\', \'child\', \'dependent\'))'],
              example: 'spouse'
            },
            {
              name: 'scheme',
              dataType: 'VARCHAR(100)',
              description: 'Medical aid scheme name',
              example: 'Discovery Health'
            },
            {
              name: 'provider',
              dataType: 'VARCHAR(255)',
              description: 'Medical aid provider name',
              example: 'Discovery'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()'
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last update timestamp',
              defaultValue: 'now()'
            }
          ],
          triggers: [
            {
              name: 'audit_medical_aid_trigger',
              description: 'Creates audit trail for all changes to medical aid details',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_patient_medical_aid_details(p_patient_id)',
              description: 'Retrieves complete medical aid info for a patient',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'validate_medical_aid_membership(p_membership_number, p_provider_id)',
              description: 'Validates membership against provider rules',
              lastUpdated: '2024-12-20'
            }
          ],
          forms: [
            {
              name: 'MedicalAidForm.tsx',
              description: 'Medical aid details form component',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'MedicalAidForm.tsx',
              description: 'Medical aid information entry workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Toggle Medical Aid',
                  description: 'User toggles "Has Medical Aid" switch on patient form',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Show Aid Fields',
                  description: 'Medical aid section expands with input fields',
                  type: 'system'
                },
                {
                  step: 3,
                  action: 'Select Provider',
                  description: 'User selects from dropdown of medical_aid_providers',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Enter Membership',
                  description: 'User enters membership number (required)',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Select Plan',
                  description: 'User selects plan type from provider-specific list',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Main Member Check',
                  description: 'User indicates if patient is main member or dependent',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Dependent Details',
                  description: 'If dependent: Enter main member name, ID, relationship',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Validation',
                  description: 'Frontend validates membership format per provider rules',
                  type: 'system'
                },
                {
                  step: 9,
                  action: 'Submit Data',
                  description: 'INSERT/UPDATE to medical_aid_details table',
                  type: 'database'
                },
                {
                  step: 10,
                  action: 'Audit Trail',
                  description: 'audit_medical_aid_trigger logs the changes',
                  type: 'trigger'
                },
                {
                  step: 11,
                  action: 'Update UI',
                  description: 'Medical aid badge shows on patient profile',
                  type: 'system'
                },
                {
                  step: 12,
                  action: 'Enable Billing',
                  description: 'Medical aid billing options enabled in visits/invoices',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'next_of_kin',
          purpose: 'Emergency contacts and relationships for patients',
          keyRelations: ['patient_id → patients.id'],
          timestamps: ['created_at'],
          references: ['patients'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key identifier',
              isPrimaryKey: true,
              defaultValue: 'uuid_generate_v4()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Link to patient record',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['NOT NULL', 'ON DELETE CASCADE']
            },
            {
              name: 'name',
              dataType: 'VARCHAR(255)',
              description: 'Full name of emergency contact',
              required: true,
              example: 'Jane Doe'
            },
            {
              name: 'relationship',
              dataType: 'VARCHAR(100)',
              description: 'Relationship to patient',
              required: true,
              example: 'Spouse'
            },
            {
              name: 'phone',
              dataType: 'VARCHAR(20)',
              description: 'Contact phone number',
              required: true,
              example: '+264811234567'
            },
            {
              name: 'address',
              dataType: 'TEXT',
              description: 'Physical address of contact',
              example: '123 Main Street, Windhoek'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()'
            }
          ],
          triggers: [],
          dbFunctions: [
            {
              name: 'get_patient_emergency_contacts(p_patient_id)',
              description: 'Retrieves all emergency contacts for a patient',
              lastUpdated: '2025-01-10'
            }
          ],
          forms: [
            {
              name: 'NextOfKinForm.tsx',
              description: 'Emergency contact entry form',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'NextOfKinForm.tsx',
              description: 'Emergency contact management workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Next of Kin',
                  description: 'User clicks "Add Emergency Contact" on patient form',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Display Form Section',
                  description: 'Next of kin form fields appear or modal opens',
                  type: 'system'
                },
                {
                  step: 3,
                  action: 'Enter Contact Name',
                  description: 'User types full name of emergency contact (required)',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Select Relationship',
                  description: 'User selects: Spouse, Parent, Child, Sibling, Other',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Enter Phone Number',
                  description: 'User enters contact phone with +264 format',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Phone Validation',
                  description: 'Frontend validates Namibian phone format',
                  type: 'system'
                },
                {
                  step: 7,
                  action: 'Enter Address',
                  description: 'User optionally enters physical address',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Add Another Option',
                  description: 'User can click "Add Another Contact" (max 3)',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Submit Contacts',
                  description: 'INSERT multiple records to next_of_kin table',
                  type: 'database'
                },
                {
                  step: 10,
                  action: 'Display Contacts',
                  description: 'Emergency contacts list shows on patient profile',
                  type: 'system'
                },
                {
                  step: 11,
                  action: 'Edit/Delete Options',
                  description: 'User can update or remove contacts later',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'patient_documents',
          purpose: 'Document metadata and storage for patient files',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id', 'uploaded_by → users.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['patients', 'visits', 'users'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key identifier',
              isPrimaryKey: true,
              defaultValue: 'uuid_generate_v4()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Link to patient record',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['NOT NULL', 'ON DELETE CASCADE']
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Optional link to specific visit',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['ON DELETE SET NULL']
            },
            {
              name: 'file_name',
              dataType: 'VARCHAR(255)',
              description: 'Stored file name in system',
              required: true,
              example: 'patient_123_id_document_2025.pdf'
            },
            {
              name: 'original_name',
              dataType: 'VARCHAR(255)',
              description: 'Original uploaded file name',
              required: true,
              example: 'ID_Document.pdf'
            },
            {
              name: 'file_type',
              dataType: 'VARCHAR(50)',
              description: 'Document type category',
              example: 'id_document'
            },
            {
              name: 'file_size',
              dataType: 'INTEGER',
              description: 'File size in bytes',
              example: '2048576'
            },
            {
              name: 'mime_type',
              dataType: 'VARCHAR(100)',
              description: 'MIME type of file',
              example: 'application/pdf'
            },
            {
              name: 'storage_path',
              dataType: 'TEXT',
              description: 'Full path in storage bucket',
              example: 'documents/2025/01/patient_123_doc.pdf'
            },
            {
              name: 'description',
              dataType: 'TEXT',
              description: 'Optional document description',
              example: 'National ID card scan'
            },
            {
              name: 'category',
              dataType: 'VARCHAR(50)',
              description: 'Document category',
              constraints: ['CHECK (category IN (\'id\', \'medical\', \'insurance\', \'consent\', \'other\'))'],
              example: 'id'
            },
            {
              name: 'tags',
              dataType: 'TEXT[]',
              description: 'Searchable tags array',
              example: '["id", "official", "2025"]'
            },
            {
              name: 'uploaded_by',
              dataType: 'UUID',
              description: 'User who uploaded document',
              isForeignKey: true,
              references: 'users.id',
              constraints: ['ON DELETE SET NULL']
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Upload timestamp',
              defaultValue: 'now()'
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last update timestamp',
              defaultValue: 'now()'
            }
          ],
          triggers: [
            {
              name: 'update_patient_documents_updated_at',
              description: 'Updates timestamp on any modification',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_patient_documents(p_patient_id)',
              description: 'Retrieves all documents for a patient',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'search_patient_documents(p_search_term)',
              description: 'Full-text search across document metadata',
              lastUpdated: '2024-12-20'
            }
          ],
          edgeFunctions: [
            {
              name: 'document-upload-handler',
              description: 'Processes document uploads with virus scanning',
              lastUpdated: '2025-01-12'
            },
            {
              name: 'document-preview-generator',
              description: 'Creates thumbnails and previews for documents',
              lastUpdated: '2024-12-25'
            }
          ],
          forms: [
            {
              name: 'DocumentUploadForm.tsx',
              description: 'Document upload component',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'DocumentUploadForm.tsx',
              description: 'Document upload and management workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Upload',
                  description: 'User clicks "Upload Document" on patient profile',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Select Category',
                  description: 'User chooses: ID, Medical, Insurance, Consent, Other',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Choose File',
                  description: 'User clicks browse or drags file to upload area',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'File Validation',
                  description: 'Check file type (PDF, JPG, PNG) and size (<50MB)',
                  type: 'system'
                },
                {
                  step: 5,
                  action: 'Preview Display',
                  description: 'Show file preview if image, icon if document',
                  type: 'system'
                },
                {
                  step: 6,
                  action: 'Add Description',
                  description: 'User optionally enters document description',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Add Tags',
                  description: 'User can add searchable tags',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Upload Start',
                  description: 'Show progress bar during upload',
                  type: 'system'
                },
                {
                  step: 9,
                  action: 'Storage Upload',
                  description: 'File uploaded to Supabase storage bucket',
                  type: 'system'
                },
                {
                  step: 10,
                  action: 'Virus Scan',
                  description: 'document-upload-handler scans for malware',
                  type: 'edge-function'
                },
                {
                  step: 11,
                  action: 'Generate Path',
                  description: 'Create unique storage path with date folders',
                  type: 'system'
                },
                {
                  step: 12,
                  action: 'Insert Metadata',
                  description: 'INSERT record to patient_documents table',
                  type: 'database'
                },
                {
                  step: 13,
                  action: 'Update Timestamp',
                  description: 'update_patient_documents_updated_at trigger fires',
                  type: 'trigger'
                },
                {
                  step: 14,
                  action: 'Generate Preview',
                  description: 'document-preview-generator creates thumbnail',
                  type: 'edge-function'
                },
                {
                  step: 15,
                  action: 'Display Success',
                  description: 'Document appears in patient document list',
                  type: 'system'
                },
                {
                  step: 16,
                  action: 'Enable Actions',
                  description: 'View, download, delete options available',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'patient_media',
          purpose: 'Images and media files for clinical documentation',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id', 'uploaded_by → users.id'],
          timestamps: ['created_at', 'uploaded_at'],
          references: ['patients', 'visits', 'users'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key identifier',
              isPrimaryKey: true,
              defaultValue: 'uuid_generate_v4()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Link to patient record',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['NOT NULL', 'ON DELETE CASCADE']
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Optional link to specific visit',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['ON DELETE SET NULL']
            },
            {
              name: 'file_name',
              dataType: 'VARCHAR(255)',
              description: 'System-generated file name',
              required: true,
              example: 'patient_123_photo_2025_01_13.jpg'
            },
            {
              name: 'original_name',
              dataType: 'VARCHAR(255)',
              description: 'Original uploaded file name',
              required: true,
              example: 'before_treatment.jpg'
            },
            {
              name: 'file_size',
              dataType: 'BIGINT',
              description: 'File size in bytes',
              required: true,
              example: '5242880'
            },
            {
              name: 'file_type',
              dataType: 'VARCHAR(50)',
              description: 'General file type',
              example: 'image'
            },
            {
              name: 'mime_type',
              dataType: 'VARCHAR(100)',
              description: 'MIME type of file',
              required: true,
              example: 'image/jpeg'
            },
            {
              name: 'storage_path',
              dataType: 'TEXT',
              description: 'Unique path in storage bucket',
              required: true,
              isUnique: true,
              example: 'media/2025/01/patient_123_photo.jpg'
            },
            {
              name: 'storage_bucket',
              dataType: 'VARCHAR(255)',
              description: 'Storage bucket name',
              defaultValue: 'patient-media',
              example: 'patient-media'
            },
            {
              name: 'category',
              dataType: 'VARCHAR(50)',
              description: 'Media category',
              example: 'photo'
            },
            {
              name: 'subcategory',
              dataType: 'VARCHAR(50)',
              description: 'Media subcategory',
              example: 'before_after'
            },
            {
              name: 'description',
              dataType: 'TEXT',
              description: 'Optional media description',
              example: 'Pre-treatment facial photo'
            },
            {
              name: 'tags',
              dataType: 'TEXT[]',
              description: 'Searchable tags array',
              example: '["before", "facial", "2025"]'
            },
            {
              name: 'metadata',
              dataType: 'JSONB',
              description: 'Additional metadata (dimensions, camera info)',
              example: '{"width": 1920, "height": 1080, "camera": "iPhone 14"}'
            },
            {
              name: 'uploaded_by',
              dataType: 'UUID',
              description: 'User who uploaded media',
              isForeignKey: true,
              references: 'users.id',
              required: true,
              constraints: ['NOT NULL']
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()'
            },
            {
              name: 'uploaded_at',
              dataType: 'TIMESTAMPTZ',
              description: 'File upload timestamp',
              defaultValue: 'now()'
            }
          ],
          triggers: [],
          dbFunctions: [
            {
              name: 'get_patient_media(p_patient_id)',
              description: 'Retrieves all media files for a patient',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'get_visit_media(p_visit_id)',
              description: 'Retrieves media files for specific visit',
              lastUpdated: '2024-12-15'
            },
            {
              name: 'search_media_by_tags(p_tags)',
              description: 'Search media using tag array',
              lastUpdated: '2024-11-20'
            }
          ],
          edgeFunctions: [
            {
              name: 'media-upload-processor',
              description: 'Handles media uploads with optimization',
              lastUpdated: '2025-01-12'
            },
            {
              name: 'image-resize-service',
              description: 'Creates multiple sizes for web display',
              lastUpdated: '2025-01-08'
            },
            {
              name: 'media-metadata-extractor',
              description: 'Extracts EXIF and media metadata',
              lastUpdated: '2024-12-20'
            }
          ],
          forms: [
            {
              name: 'EnhancedMediaUpload.tsx',
              description: 'Advanced media upload component',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'EnhancedMediaUpload.tsx',
              description: 'Clinical media upload and management workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Media Upload',
                  description: 'User clicks "Upload Photo/Video" on patient/visit page',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Select Media Type',
                  description: 'Choose: Photo, Video, Audio, or Other',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Camera/Gallery',
                  description: 'User takes photo or selects from device',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'File Validation',
                  description: 'Check format (JPEG/PNG/MP4) and size (<50MB)',
                  type: 'system'
                },
                {
                  step: 5,
                  action: 'Preview Display',
                  description: 'Show image preview or video thumbnail',
                  type: 'system'
                },
                {
                  step: 6,
                  action: 'Select Category',
                  description: 'Choose: Clinical Photo, X-Ray, Scan, Before/After',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Add Description',
                  description: 'User describes the media content',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Tag Entry',
                  description: 'Add searchable tags like "wound", "healing"',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Privacy Check',
                  description: 'Confirm patient consent for media storage',
                  type: 'system'
                },
                {
                  step: 10,
                  action: 'Upload Progress',
                  description: 'Show upload percentage with cancel option',
                  type: 'system'
                },
                {
                  step: 11,
                  action: 'Storage Upload',
                  description: 'Upload to patient-media bucket in Supabase',
                  type: 'system'
                },
                {
                  step: 12,
                  action: 'Process Media',
                  description: 'media-upload-processor optimizes file',
                  type: 'edge-function'
                },
                {
                  step: 13,
                  action: 'Extract Metadata',
                  description: 'media-metadata-extractor gets EXIF data',
                  type: 'edge-function'
                },
                {
                  step: 14,
                  action: 'Create Sizes',
                  description: 'image-resize-service creates thumbnail, medium, large',
                  type: 'edge-function'
                },
                {
                  step: 15,
                  action: 'Insert Record',
                  description: 'INSERT metadata to patient_media table',
                  type: 'database'
                },
                {
                  step: 16,
                  action: 'Gallery Update',
                  description: 'Media appears in patient/visit gallery',
                  type: 'system'
                },
                {
                  step: 17,
                  action: 'Enable Tools',
                  description: 'View fullscreen, compare, annotate options',
                  type: 'system'
                }
              ]
            }
          ]
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
          purpose: 'Central table for all patient appointments, visits, and medical encounters',
          keyRelations: ['patient_id → patients.id', 'doctor_id → users.id', 'practice_id → practices.id', 'branch_id → branches.id'],
          timestamps: ['created_at', 'updated_at', 'checked_in_at', 'started_at', 'completed_at'],
          referencedBy: ['medical_records', 'vitals', 'lab_requests', 'imaging_requests', 'invoices_enhanced', 'patient_documents', 'patient_media'],
          references: ['patients', 'users', 'practices', 'branches', 'follow_up_templates'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key identifier',
              isPrimaryKey: true,
              defaultValue: 'uuid_generate_v4()',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Link to patient record',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['NOT NULL']
            },
            {
              name: 'doctor_id',
              dataType: 'UUID',
              description: 'Treating doctor/provider',
              isForeignKey: true,
              references: 'users.id',
              required: true
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice where visit occurs',
              isForeignKey: true,
              references: 'practices.id',
              required: true
            },
            {
              name: 'branch_id',
              dataType: 'UUID',
              description: 'Branch location of visit',
              isForeignKey: true,
              references: 'branches.id'
            },
            {
              name: 'visit_number',
              dataType: 'INTEGER',
              description: 'Sequential visit number per patient',
              example: '5'
            },
            {
              name: 'visit_date',
              dataType: 'DATE',
              description: 'Actual visit date',
              required: true,
              example: '2025-01-13'
            },
            {
              name: 'visit_time',
              dataType: 'TIME',
              description: 'Actual visit time',
              example: '14:30:00'
            },
            {
              name: 'scheduled_date',
              dataType: 'DATE',
              description: 'Originally scheduled date',
              example: '2025-01-13'
            },
            {
              name: 'scheduled_time',
              dataType: 'TIME',
              description: 'Originally scheduled time',
              example: '14:00:00'
            },
            {
              name: 'visit_type',
              dataType: 'TEXT',
              description: 'Type of visit',
              constraints: ['CHECK (visit_type IN (\'consultation\', \'follow-up\', \'procedure\', \'emergency\'))'],
              example: 'consultation'
            },
            {
              name: 'visit_subtype',
              dataType: 'TEXT',
              description: 'Specific visit category',
              example: 'Initial Consultation'
            },
            {
              name: 'chief_complaint',
              dataType: 'TEXT',
              description: 'Primary reason for visit',
              example: 'Persistent headache for 3 days'
            },
            {
              name: 'diagnosis',
              dataType: 'TEXT',
              description: 'Medical diagnosis',
              example: 'Tension headache (R51.9)'
            },
            {
              name: 'treatment_plan',
              dataType: 'TEXT',
              description: 'Treatment details and instructions',
              example: 'Rest, hydration, paracetamol 500mg TDS'
            },
            {
              name: 'prescription',
              dataType: 'TEXT',
              description: 'Medications prescribed',
              example: 'Paracetamol 500mg x 20 tablets'
            },
            {
              name: 'notes',
              dataType: 'TEXT',
              description: 'Additional clinical notes',
              example: 'Patient advised on stress management'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current visit status',
              constraints: ['CHECK (status IN (\'scheduled\', \'confirmed\', \'checked-in\', \'in-progress\', \'completed\', \'cancelled\'))'],
              defaultValue: 'scheduled'
            },
            {
              name: 'is_scheduled',
              dataType: 'BOOLEAN',
              description: 'Visit is scheduled',
              defaultValue: 'true'
            },
            {
              name: 'is_confirmed',
              dataType: 'BOOLEAN',
              description: 'Appointment confirmed',
              defaultValue: 'false'
            },
            {
              name: 'is_checked_in',
              dataType: 'BOOLEAN',
              description: 'Patient checked in',
              defaultValue: 'false'
            },
            {
              name: 'is_ready',
              dataType: 'BOOLEAN',
              description: 'Ready for doctor',
              defaultValue: 'false'
            },
            {
              name: 'is_cancelled',
              dataType: 'BOOLEAN',
              description: 'Visit cancelled',
              defaultValue: 'false'
            },
            {
              name: 'duration_minutes',
              dataType: 'INTEGER',
              description: 'Visit duration in minutes',
              defaultValue: '30'
            },
            {
              name: 'follow_up_required',
              dataType: 'BOOLEAN',
              description: 'Follow-up needed',
              defaultValue: 'false'
            },
            {
              name: 'follow_up_date',
              dataType: 'DATE',
              description: 'Next appointment date',
              example: '2025-01-27'
            },
            {
              name: 'preceding_visit_id',
              dataType: 'UUID',
              description: 'Link to previous visit in care plan',
              isForeignKey: true,
              references: 'visits.id'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()'
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last update timestamp',
              defaultValue: 'now()'
            }
          ],
          triggers: [
            {
              name: 'audit_visits_trigger',
              description: 'Creates audit trail for all visit changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'smart_notification_trigger',
              description: 'Sends notifications based on visit state changes',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'update_visits_updated_at',
              description: 'Updates timestamp on modifications',
              lastUpdated: '2024-12-15'
            },
            {
              name: 'visit_numbering_trigger',
              description: 'Assigns sequential visit numbers per patient',
              lastUpdated: '2024-12-20'
            },
            {
              name: 'check_visit_conflicts',
              description: 'Prevents double booking of doctors',
              lastUpdated: '2024-11-25'
            }
          ],
          dbFunctions: [
            {
              name: 'get_doctor_schedule(p_doctor_id, p_date)',
              description: 'Returns doctor\'s daily schedule',
              lastUpdated: '2025-01-12'
            },
            {
              name: 'get_available_slots(p_doctor_id, p_date, p_duration)',
              description: 'Finds available appointment slots',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'get_patient_visits(p_patient_id)',
              description: 'Returns complete visit history',
              lastUpdated: '2025-01-08'
            },
            {
              name: 'update_visit_status(p_visit_id, p_new_status)',
              description: 'Manages visit state transitions',
              lastUpdated: '2024-12-22'
            },
            {
              name: 'calculate_visit_metrics(p_practice_id, p_date_range)',
              description: 'Generates visit statistics',
              lastUpdated: '2024-12-10'
            }
          ],
          edgeFunctions: [
            {
              name: 'appointment-scheduler',
              description: 'Smart appointment booking with conflict detection',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'visit-reminder-service',
              description: 'Sends SMS/Email reminders for appointments',
              lastUpdated: '2025-01-09'
            },
            {
              name: 'check-in-processor',
              description: 'Handles patient check-in and queue management',
              lastUpdated: '2024-12-25'
            },
            {
              name: 'visit-analytics',
              description: 'Generates visit analytics and reports',
              lastUpdated: '2024-12-15'
            }
          ],
          forms: [
            {
              name: 'AddVisitForm.tsx',
              description: 'Comprehensive visit creation form',
              lastUpdated: '2025-01-12'
            },
            {
              name: 'VisitScheduler.tsx',
              description: 'Appointment scheduling component',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'VisitCheckIn.tsx',
              description: 'Patient check-in interface',
              lastUpdated: '2025-01-08'
            }
          ],
          formWorkflows: [
            {
              formName: 'AddVisitForm.tsx',
              description: 'Complete visit creation and management workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Visit Form',
                  description: 'User clicks "New Visit" or "Schedule Appointment"',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Select Patient',
                  description: 'Use PatientSearchSelect to find/select patient',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Load Patient Data',
                  description: 'Fetch patient details, medical aid, visit history',
                  type: 'database'
                },
                {
                  step: 4,
                  action: 'Select Visit Type',
                  description: 'Choose: Consultation, Follow-up, Procedure, Emergency',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Select Doctor',
                  description: 'Choose treating doctor from practice staff',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Check Availability',
                  description: 'get_available_slots() shows free time slots',
                  type: 'database'
                },
                {
                  step: 7,
                  action: 'Select Date/Time',
                  description: 'User picks from available slots',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Enter Complaint',
                  description: 'User enters chief complaint/reason for visit',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Set Duration',
                  description: 'Select visit duration (15, 30, 45, 60 minutes)',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Add Notes',
                  description: 'Optional pre-visit notes or special requirements',
                  type: 'user'
                },
                {
                  step: 11,
                  action: 'Validate Booking',
                  description: 'Check for conflicts, validate all fields',
                  type: 'system'
                },
                {
                  step: 12,
                  action: 'Submit Visit',
                  description: 'INSERT new visit record to visits table',
                  type: 'database'
                },
                {
                  step: 13,
                  action: 'Visit Numbering',
                  description: 'visit_numbering_trigger assigns sequential number',
                  type: 'trigger'
                },
                {
                  step: 14,
                  action: 'Conflict Check',
                  description: 'check_visit_conflicts prevents double booking',
                  type: 'trigger'
                },
                {
                  step: 15,
                  action: 'Audit Trail',
                  description: 'audit_visits_trigger logs creation',
                  type: 'trigger'
                },
                {
                  step: 16,
                  action: 'Send Confirmation',
                  description: 'visit-reminder-service sends appointment details',
                  type: 'edge-function'
                },
                {
                  step: 17,
                  action: 'Update Calendar',
                  description: 'Visit appears in doctor\'s schedule',
                  type: 'system'
                },
                {
                  step: 18,
                  action: 'Success Message',
                  description: 'Show confirmation with visit details',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'vitals',
          purpose: 'Patient vital signs measurements and trends tracking for clinical monitoring',
          keyRelations: ['visit_id → visits.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['visits'],
          referencedBy: [],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for vitals record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'uuid_generate_v4()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Link to the visit when vitals were recorded',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Associates vital signs with specific patient visit or encounter'
            },
            {
              name: 'blood_pressure',
              dataType: 'TEXT',
              description: 'Blood pressure reading in systolic/diastolic format',
              example: '120/80',
              detailedDescription: 'Stored as string to handle various formats, typically "sys/dia" in mmHg'
            },
            {
              name: 'temperature',
              dataType: 'NUMERIC',
              description: 'Body temperature in degrees Celsius',
              example: '36.5',
              constraints: ['CHECK (temperature BETWEEN 30 AND 45)'],
              detailedDescription: 'Decimal precision for accurate temperature recording with validation range'
            },
            {
              name: 'pulse_rate',
              dataType: 'INTEGER',
              description: 'Heart rate in beats per minute',
              example: '72',
              constraints: ['CHECK (pulse_rate BETWEEN 30 AND 250)'],
              detailedDescription: 'Integer value with medical range validation for heart rate'
            },
            {
              name: 'respiratory_rate',
              dataType: 'INTEGER',
              description: 'Breathing rate in breaths per minute',
              example: '16',
              constraints: ['CHECK (respiratory_rate BETWEEN 5 AND 60)'],
              detailedDescription: 'Integer value with medical range validation for breathing rate'
            },
            {
              name: 'weight',
              dataType: 'NUMERIC',
              description: 'Patient weight in kilograms',
              example: '70.5',
              constraints: ['CHECK (weight > 0)'],
              detailedDescription: 'Decimal precision for accurate weight measurement in kg'
            },
            {
              name: 'height',
              dataType: 'NUMERIC',
              description: 'Patient height in centimeters',
              example: '175.0',
              constraints: ['CHECK (height > 0)'],
              detailedDescription: 'Decimal precision for accurate height measurement in cm'
            },
            {
              name: 'bmi',
              dataType: 'NUMERIC',
              description: 'Body Mass Index calculated from weight and height',
              example: '22.9',
              detailedDescription: 'Auto-calculated BMI value with 1 decimal precision'
            },
            {
              name: 'oxygen_saturation',
              dataType: 'NUMERIC',
              description: 'Blood oxygen saturation percentage',
              example: '98.0',
              constraints: ['CHECK (oxygen_saturation BETWEEN 70 AND 100)'],
              detailedDescription: 'SpO2 percentage with medical range validation'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'validate_vital_ranges_trigger',
              description: 'Validates vital signs are within medically acceptable ranges',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'auto_calculate_bmi_trigger',
              description: 'Automatically calculates BMI when height/weight change',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'vitals_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-11'
            }
          ],
          dbFunctions: [
            {
              name: 'calculate_bmi(height_cm, weight_kg)',
              description: 'Calculates Body Mass Index from height and weight',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'get_vital_trends(p_visit_id, p_vital_type)',
              description: 'Retrieves historical trends for specific vital signs',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'check_vital_alerts(p_vitals_id)',
              description: 'Checks if vital signs trigger medical alerts',
              lastUpdated: '2025-01-11'
            }
          ],
          edgeFunctions: [
            {
              name: 'vitals-alert-processor',
              description: 'Processes critical vital signs and triggers alerts',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'vitals-trend-analyzer',
              description: 'Analyzes vital sign patterns over time',
              lastUpdated: '2025-01-11'
            }
          ],
          forms: [
            {
              name: 'VitalsForm.tsx',
              description: 'Comprehensive vital signs recording form',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'VitalsForm.tsx',
              description: 'Clinical vital signs recording and monitoring workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Vitals Form',
                  description: 'Clinician clicks "Record Vitals" during patient visit',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Blood Pressure Entry',
                  description: 'Enter systolic/diastolic reading (e.g., "120/80")',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Temperature Entry',
                  description: 'Input body temperature with decimal precision',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Pulse Rate Entry',
                  description: 'Record heart rate in beats per minute',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Respiratory Rate Entry',
                  description: 'Record breathing rate in breaths per minute',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Weight Measurement',
                  description: 'Enter patient weight in kilograms',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Height Measurement',
                  description: 'Enter patient height in centimeters',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Auto BMI Calculation',
                  description: 'System automatically calculates BMI from weight/height',
                  type: 'system'
                },
                {
                  step: 9,
                  action: 'Oxygen Saturation',
                  description: 'Optional SpO2 percentage reading entry',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Clinical Notes',
                  description: 'Add optional notes about vital signs context',
                  type: 'user'
                },
                {
                  step: 11,
                  action: 'Validation Check',
                  description: 'validate_vital_ranges_trigger checks medical ranges',
                  type: 'trigger'
                },
                {
                  step: 12,
                  action: 'Alert Processing',
                  description: 'vitals-alert-processor checks for critical values',
                  type: 'edge-function'
                },
                {
                  step: 13,
                  action: 'Save Vitals',
                  description: 'INSERT record into vitals table with timestamps',
                  type: 'database'
                },
                {
                  step: 14,
                  action: 'Trend Analysis',
                  description: 'vitals-trend-analyzer updates patient trends',
                  type: 'edge-function'
                },
                {
                  step: 15,
                  action: 'Visit Update',
                  description: 'Vitals appear in visit summary and patient chart',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'medical_records',
          purpose: 'Clinical notes and medical documentation (Note: Table structure not yet implemented)',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['patients', 'visits'],
          fields: [
            {
              name: 'Note',
              dataType: 'PENDING',
              description: 'This table structure is not yet implemented in the database',
              example: 'Schema definition pending',
              detailedDescription: 'Medical records table requires schema definition and implementation'
            }
          ],
          triggers: [
            {
              name: 'encrypt_sensitive_data',
              description: 'Encrypts confidential medical information (pending implementation)',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'medical_record_audit',
              description: 'Tracks all access and modifications (pending implementation)',
              lastUpdated: '2025-01-11'
            }
          ],
          edgeFunctions: [
            {
              name: 'clinical-nlp',
              description: 'Extracts key medical terms from clinical notes',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'medical-transcription',
              description: 'Converts voice recordings to structured clinical notes',
              lastUpdated: '2025-01-11'
            }
          ],
          forms: [
            {
              name: 'MedicalRecordForm.tsx',
              description: 'Clinical documentation form (pending implementation)',
              lastUpdated: '2025-01-11'
            }
          ]
        },
        {
          name: 'lab_requests',
          purpose: 'Laboratory test orders and request management with status tracking',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id', 'practice_id → practices.id', 'requested_by → users.id'],
          timestamps: ['created_at', 'updated_at', 'request_date', 'preferred_date'],
          references: ['patients', 'visits', 'practices', 'users'],
          referencedBy: ['lab_results'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for lab request',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Patient for whom the test is requested',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Associated visit or encounter',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links lab request to specific patient visit'
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice ordering the test',
              isForeignKey: true,
              references: 'practices.id',
              constraints: ['FOREIGN KEY']
            },
            {
              name: 'request_date',
              dataType: 'DATE',
              description: 'Date when the test was requested',
              required: true,
              defaultValue: 'CURRENT_DATE',
              constraints: ['NOT NULL']
            },
            {
              name: 'preferred_date',
              dataType: 'DATE',
              description: 'Preferred date for test completion',
              detailedDescription: 'When patient would like test performed'
            },
            {
              name: 'lab_facility',
              dataType: 'TEXT',
              description: 'Laboratory facility name',
              example: 'PathCare',
              detailedDescription: 'Name of laboratory where test will be performed'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current status of the lab request',
              required: true,
              defaultValue: "'pending'",
              example: 'pending',
              constraints: ['NOT NULL', "CHECK (status IN ('pending', 'ordered', 'in_progress', 'completed', 'cancelled'))"],
              detailedDescription: 'Tracks request lifecycle from pending to completion'
            },
            {
              name: 'notes',
              dataType: 'TEXT',
              description: 'Additional notes or special instructions',
              detailedDescription: 'Free-text field for special handling instructions'
            },
            {
              name: 'media_url',
              dataType: 'TEXT',
              description: 'URL to uploaded media files',
              detailedDescription: 'Link to relevant documents or images'
            },
            {
              name: 'media_type',
              dataType: 'TEXT',
              description: 'Type of media uploaded',
              example: 'image/jpeg',
              detailedDescription: 'MIME type of uploaded media files'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'lab_requests_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'validate_lab_request_data',
              description: 'Validates required fields and business rules',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'notify_lab_request_changes',
              description: 'Triggers notifications when status changes',
              lastUpdated: '2025-01-11'
            }
          ],
          dbFunctions: [
            {
              name: 'get_pending_lab_requests(p_patient_id)',
              description: 'Retrieves all outstanding test requests for patient',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'calculate_lab_turnaround_time(p_facility)',
              description: 'Calculates average processing time by facility',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'get_lab_request_history(p_patient_id)',
              description: 'Returns complete lab request history for patient',
              lastUpdated: '2025-01-11'
            }
          ],
          edgeFunctions: [
            {
              name: 'lab-integration-gateway',
              description: 'Integrates with external laboratory information systems',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'lab-result-notification',
              description: 'Sends alerts when critical lab results are received',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'lab-order-processor',
              description: 'Processes and formats lab orders for submission',
              lastUpdated: '2025-01-11'
            }
          ],
          forms: [
            {
              name: 'LabRequestForm.tsx',
              description: 'Comprehensive laboratory test ordering form',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'LabRequestForm.tsx',
              description: 'Laboratory test ordering and tracking workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Lab Request',
                  description: 'Clinician clicks "Order Lab Tests" from patient visit',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Test Name Entry',
                  description: 'Enter specific test name (e.g., "Complete Blood Count")',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Test Code Entry',
                  description: 'Optional test code entry (e.g., "CBC")',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Select Category',
                  description: 'Choose from: Blood Work, Urine Analysis, Microbiology, etc.',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Set Priority',
                  description: 'Select: Routine, Urgent, or STAT priority',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Choose Lab Facility',
                  description: 'Select laboratory: NIP, PathCare, Diagnolab, etc.',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Clinical Indication',
                  description: 'Enter medical reason for requesting the test',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Special Instructions',
                  description: 'Add any special preparation or handling notes',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Fasting Required',
                  description: 'Check if patient fasting is required',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Set Dates',
                  description: 'Set request date and preferred completion date',
                  type: 'user'
                },
                {
                  step: 11,
                  action: 'Additional Notes',
                  description: 'Add any other relevant information',
                  type: 'user'
                },
                {
                  step: 12,
                  action: 'Validation Check',
                  description: 'validate_lab_request_data trigger checks required fields',
                  type: 'trigger'
                },
                {
                  step: 13,
                  action: 'Save Request',
                  description: 'INSERT record into lab_requests table',
                  type: 'database'
                },
                {
                  step: 14,
                  action: 'Process Order',
                  description: 'lab-order-processor formats for laboratory submission',
                  type: 'edge-function'
                },
                {
                  step: 15,
                  action: 'Lab Integration',
                  description: 'lab-integration-gateway sends to external lab system',
                  type: 'edge-function'
                },
                {
                  step: 16,
                  action: 'Status Update',
                  description: 'Request status changes from "pending" to "ordered"',
                  type: 'system'
                },
                {
                  step: 17,
                  action: 'Patient Notification',
                  description: 'Patient receives notification about test preparation',
                  type: 'system'
                },
                {
                  step: 18,
                  action: 'Result Monitoring',
                  description: 'lab-result-notification monitors for critical results',
                  type: 'edge-function'
                }
              ]
            }
          ]
        },
        {
          name: 'imaging_requests',
          purpose: 'Medical imaging orders and radiology request management with comprehensive tracking',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id', 'requested_by → users.id'],
          timestamps: ['created_at', 'updated_at', 'request_date', 'preferred_date', 'scheduled_date', 'completed_date'],
          references: ['patients', 'visits', 'users'],
          referencedBy: ['imaging_results'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for imaging request',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Patient for whom the imaging is requested',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Associated visit or consultation',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links imaging request to specific patient encounter'
            },
            {
              name: 'requested_by',
              dataType: 'UUID',
              description: 'Healthcare provider who ordered the imaging',
              isForeignKey: true,
              references: 'users.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'request_date',
              dataType: 'DATE',
              description: 'Date when imaging was requested',
              required: true,
              defaultValue: 'CURRENT_DATE',
              constraints: ['NOT NULL']
            },
            {
              name: 'priority',
              dataType: 'TEXT',
              description: 'Urgency level of the imaging request',
              required: true,
              defaultValue: "'routine'",
              example: 'routine',
              constraints: ['NOT NULL', "CHECK (priority IN ('routine', 'urgent', 'stat'))"],
              detailedDescription: 'Determines scheduling priority and turnaround time'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current status of the imaging request',
              required: true,
              defaultValue: "'pending'",
              example: 'pending',
              constraints: ['NOT NULL', "CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled'))"],
              detailedDescription: 'Tracks request lifecycle from order to completion'
            },
            {
              name: 'imaging_type',
              dataType: 'TEXT',
              description: 'Type of imaging study requested',
              required: true,
              example: 'x_ray',
              constraints: ['NOT NULL', "CHECK (imaging_type IN ('x_ray', 'ct_scan', 'mri', 'ultrasound', 'mammography', 'nuclear_medicine', 'dental_x_ray', 'panoramic_x_ray', 'cbct', 'other'))"],
              detailedDescription: 'Specific imaging modality to be performed'
            },
            {
              name: 'body_part',
              dataType: 'TEXT',
              description: 'Anatomical area to be imaged',
              required: true,
              example: 'Chest',
              constraints: ['NOT NULL'],
              detailedDescription: 'Specific body part or region for imaging'
            },
            {
              name: 'view_position',
              dataType: 'TEXT',
              description: 'Specific view or position for imaging',
              example: 'AP, Lateral',
              detailedDescription: 'Radiographic projections or positions required'
            },
            {
              name: 'contrast_required',
              dataType: 'BOOLEAN',
              description: 'Whether contrast agent is needed',
              defaultValue: 'false',
              detailedDescription: 'Indicates if contrast material should be used'
            },
            {
              name: 'clinical_indication',
              dataType: 'TEXT',
              description: 'Medical reason for the imaging study',
              required: true,
              example: 'Rule out pneumonia',
              constraints: ['NOT NULL'],
              detailedDescription: 'Clinical justification and suspected diagnosis'
            },
            {
              name: 'clinical_history',
              dataType: 'TEXT',
              description: 'Relevant patient medical history',
              detailedDescription: 'Background medical information relevant to imaging'
            },
            {
              name: 'special_instructions',
              dataType: 'TEXT',
              description: 'Special preparation or handling instructions',
              detailedDescription: 'Additional instructions for technologist or patient'
            },
            {
              name: 'preferred_date',
              dataType: 'DATE',
              description: 'Patient\'s preferred imaging date',
              detailedDescription: 'When patient would like imaging performed'
            },
            {
              name: 'scheduled_date',
              dataType: 'DATE',
              description: 'Actual scheduled date for imaging',
              detailedDescription: 'Date when imaging appointment is booked'
            },
            {
              name: 'scheduled_time',
              dataType: 'TIME',
              description: 'Scheduled time for imaging appointment',
              detailedDescription: 'Specific time slot for imaging procedure'
            },
            {
              name: 'facility_name',
              dataType: 'TEXT',
              description: 'Imaging facility or department',
              example: 'Windhoek Radiology',
              detailedDescription: 'Where the imaging will be performed'
            },
            {
              name: 'result_file_ids',
              dataType: 'ARRAY',
              description: 'Array of file IDs for imaging results',
              detailedDescription: 'References to DICOM files and reports in storage'
            },
            {
              name: 'radiologist_name',
              dataType: 'TEXT',
              description: 'Name of interpreting radiologist',
              detailedDescription: 'Healthcare provider who reads and reports findings'
            },
            {
              name: 'report_text',
              dataType: 'TEXT',
              description: 'Radiologist\'s interpretation report',
              detailedDescription: 'Detailed findings and impression from radiologist'
            },
            {
              name: 'notes',
              dataType: 'TEXT',
              description: 'Additional notes or comments',
              detailedDescription: 'Miscellaneous notes about the request or procedure'
            },
            {
              name: 'completed_date',
              dataType: 'DATE',
              description: 'Date when imaging was completed',
              detailedDescription: 'When the actual imaging procedure was finished'
            },
            {
              name: 'expected_results_date',
              dataType: 'DATE',
              description: 'Expected date for results availability',
              detailedDescription: 'Estimated date when report will be ready'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'imaging_requests_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'validate_imaging_request_data',
              description: 'Validates required fields and medical protocols',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'notify_imaging_status_changes',
              description: 'Triggers notifications when status changes',
              lastUpdated: '2025-01-11'
            }
          ],
          dbFunctions: [
            {
              name: 'get_pending_imaging_requests(p_patient_id)',
              description: 'Retrieves all outstanding imaging requests for patient',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'calculate_imaging_turnaround_time(p_facility)',
              description: 'Calculates average processing time by facility',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'get_imaging_request_history(p_patient_id)',
              description: 'Returns complete imaging history for patient',
              lastUpdated: '2025-01-11'
            }
          ],
          edgeFunctions: [
            {
              name: 'pacs-integration-gateway',
              description: 'Integrates with Picture Archiving and Communication Systems',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'imaging-scheduler-service',
              description: 'Coordinates scheduling with imaging departments',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'dicom-processor',
              description: 'Processes and stores DICOM imaging files',
              lastUpdated: '2025-01-11'
            }
          ],
          forms: [
            {
              name: 'ImagingRequestForm.tsx',
              description: 'Comprehensive medical imaging ordering form',
              lastUpdated: '2025-01-11'
            }
          ],
          formWorkflows: [
            {
              formName: 'ImagingRequestForm.tsx',
              description: 'Medical imaging ordering and scheduling workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Imaging Request',
                  description: 'Clinician clicks "Order Imaging" from patient visit',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Select Imaging Type',
                  description: 'Choose: X-Ray, CT, MRI, Ultrasound, Mammography, etc.',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Specify Body Part',
                  description: 'Enter anatomical area (e.g., "Chest", "Left Knee")',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Set View Position',
                  description: 'Optional specific views (e.g., "AP, Lateral, Oblique")',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Set Priority',
                  description: 'Select: Routine, Urgent, or STAT priority',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Choose Facility',
                  description: 'Select imaging facility or department',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Contrast Requirement',
                  description: 'Check if contrast agent is needed',
                  type: 'user'
                },
                {
                  step: 8,
                  action: 'Clinical Indication',
                  description: 'Enter medical reason for imaging study',
                  type: 'user'
                },
                {
                  step: 9,
                  action: 'Clinical History',
                  description: 'Add relevant patient medical background',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Special Instructions',
                  description: 'Any preparation or handling instructions',
                  type: 'user'
                },
                {
                  step: 11,
                  action: 'Set Preferred Date',
                  description: 'Patient\'s preferred appointment date',
                  type: 'user'
                },
                {
                  step: 12,
                  action: 'Additional Notes',
                  description: 'Any other relevant information',
                  type: 'user'
                },
                {
                  step: 13,
                  action: 'Validation Check',
                  description: 'validate_imaging_request_data trigger checks protocols',
                  type: 'trigger'
                },
                {
                  step: 14,
                  action: 'Save Request',
                  description: 'INSERT record into imaging_requests table',
                  type: 'database'
                },
                {
                  step: 15,
                  action: 'Schedule Processing',
                  description: 'imaging-scheduler-service coordinates appointment',
                  type: 'edge-function'
                },
                {
                  step: 16,
                  action: 'PACS Integration',
                  description: 'pacs-integration-gateway sends to radiology system',
                  type: 'edge-function'
                },
                {
                  step: 17,
                  action: 'Status Update',
                  description: 'Request status changes from "pending" to "scheduled"',
                  type: 'system'
                },
                {
                  step: 18,
                  action: 'Patient Notification',
                  description: 'Patient receives appointment confirmation and prep instructions',
                  type: 'system'
                },
                {
                  step: 19,
                  action: 'DICOM Processing',
                  description: 'dicom-processor handles imaging files when completed',
                  type: 'edge-function'
                },
                {
                  step: 20,
                  action: 'Result Notification',
                  description: 'Clinician notified when radiologist report is available',
                  type: 'system'
                }
              ]
            }
          ]
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
          purpose: 'Comprehensive SMS tracking and delivery logging with full audit trail and cost management',
          keyRelations: ['practice_id → practices.id', 'patient_id → patients.id', 'appointment_id → appointments.id', 'visit_id → visits.id', 'user_id → users.id'],
          timestamps: ['created_at', 'updated_at', 'sent_at', 'delivered_at', 'failed_at'],
          references: ['practices', 'patients', 'appointments', 'visits', 'users'],
          referencedBy: ['practice_sms_subscriptions'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for SMS log record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice that sent the SMS',
              isForeignKey: true,
              references: 'practices.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'recipient_phone',
              dataType: 'TEXT',
              description: 'Phone number where SMS was sent',
              required: true,
              example: '+27123456789',
              constraints: ['NOT NULL'],
              detailedDescription: 'International format phone number with country code'
            },
            {
              name: 'sender_phone',
              dataType: 'TEXT',
              description: 'Sender phone number or shortcode',
              example: 'ONEHEALTH',
              detailedDescription: 'SMSPortal shortcode or sender ID for branding'
            },
            {
              name: 'message_content',
              dataType: 'TEXT',
              description: 'Actual SMS message content sent',
              required: true,
              example: 'Your appointment is confirmed for tomorrow at 2pm',
              constraints: ['NOT NULL'],
              detailedDescription: 'Complete message text as delivered to recipient'
            },
            {
              name: 'message_type',
              dataType: 'TEXT',
              description: 'Category of SMS message',
              required: true,
              example: 'appointment_reminder',
              constraints: ['NOT NULL', "CHECK (message_type IN ('appointment_reminder', 'appointment_confirmation', 'payment_reminder', 'test_results', 'general', 'marketing', 'emergency'))"],
              detailedDescription: 'Categorizes message for analytics and compliance'
            },
            {
              name: 'provider',
              dataType: 'TEXT',
              description: 'SMS service provider used',
              required: true,
              defaultValue: "'smsportal'",
              example: 'smsportal',
              constraints: ['NOT NULL'],
              detailedDescription: 'SMS gateway provider (currently SMSPortal)'
            },
            {
              name: 'provider_message_id',
              dataType: 'TEXT',
              description: 'Provider-assigned message identifier',
              example: 'SMS123456789',
              detailedDescription: 'External provider reference for tracking and support'
            },
            {
              name: 'provider_response',
              dataType: 'JSONB',
              description: 'Full provider API response',
              example: '{"status": "success", "messageId": "SMS123456789", "cost": 0.25}',
              detailedDescription: 'Complete response from SMS provider API for debugging'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current delivery status of SMS',
              required: true,
              defaultValue: "'pending'",
              example: 'delivered',
              constraints: ['NOT NULL', "CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled'))"],
              detailedDescription: 'Tracks message from creation through delivery confirmation'
            },
            {
              name: 'sent_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When SMS was sent to provider',
              detailedDescription: 'Provider confirmation timestamp for successful submission'
            },
            {
              name: 'delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When SMS was delivered to recipient',
              detailedDescription: 'Final delivery confirmation from mobile network'
            },
            {
              name: 'failed_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When SMS failed to send or deliver',
              detailedDescription: 'Timestamp when failure was detected'
            },
            {
              name: 'failure_reason',
              dataType: 'TEXT',
              description: 'Reason for SMS failure',
              example: 'Invalid phone number',
              detailedDescription: 'Human-readable error description for troubleshooting'
            },
            {
              name: 'cost_units',
              dataType: 'NUMERIC',
              description: 'SMS units consumed',
              defaultValue: '0',
              example: '1.0',
              detailedDescription: 'Number of SMS units charged (long messages = multiple units)'
            },
            {
              name: 'cost_amount',
              dataType: 'NUMERIC',
              description: 'Cost in local currency',
              defaultValue: '0',
              example: '0.25',
              detailedDescription: 'Actual cost charged by provider in NAD/ZAR'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Patient who received the SMS',
              isForeignKey: true,
              references: 'patients.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links SMS to specific patient for medical records'
            },
            {
              name: 'appointment_id',
              dataType: 'UUID',
              description: 'Related appointment if applicable',
              isForeignKey: true,
              references: 'appointments.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Associates SMS with specific appointment'
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Related visit if applicable',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links SMS to patient visit or encounter'
            },
            {
              name: 'user_id',
              dataType: 'UUID',
              description: 'User who initiated the SMS',
              isForeignKey: true,
              references: 'users.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Tracks which staff member sent the message'
            },
            {
              name: 'metadata',
              dataType: 'JSONB',
              description: 'Additional structured data',
              defaultValue: "'{}'",
              example: '{"campaign": "flu_shots", "template_version": "v2"}',
              detailedDescription: 'Flexible field for campaign tracking and context'
            },
            {
              name: 'tags',
              dataType: 'ARRAY',
              description: 'Searchable tags for categorization',
              defaultValue: "'{}'",
              example: '["urgent", "appointment", "reminder"]',
              detailedDescription: 'Array of keywords for filtering and analytics'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'CURRENT_TIMESTAMP',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'CURRENT_TIMESTAMP',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'sms_logs_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'update_sms_delivery_status_trigger',
              description: 'Updates delivery status based on provider webhooks',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'increment_sms_usage_counter_trigger',
              description: 'Updates practice SMS subscription usage counters',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'validate_sms_content_trigger',
              description: 'Validates message content and compliance rules',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_sms_delivery_rate(p_practice_id, p_date_range)',
              description: 'Calculates SMS delivery success rate for practice',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'check_sms_balance(p_practice_id)',
              description: 'Returns remaining SMS credits and usage statistics',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_sms_cost_analysis(p_practice_id, p_period)',
              description: 'Analyzes SMS costs and usage patterns',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_patient_sms_history(p_patient_id)',
              description: 'Retrieves complete SMS communication history for patient',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'centralized-sms-gateway',
              description: 'Main SMS sending service with SMSPortal integration',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'sms-status-webhook',
              description: 'Receives delivery status updates from SMS provider',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'sms-analytics-processor',
              description: 'Processes SMS data for analytics and reporting',
              lastUpdated: '2025-01-13'
            }
          ],
          forms: [
            {
              name: 'SMSComposeForm.tsx',
              description: 'SMS composition and sending interface',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'SMSTemplateForm.tsx',
              description: 'SMS template creation and management',
              lastUpdated: '2025-01-13'
            }
          ],
          formWorkflows: [
            {
              formName: 'SMSComposeForm.tsx',
              description: 'Manual SMS composition and sending workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open SMS Compose',
                  description: 'User clicks "Send SMS" from patient/appointment view',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Select Recipients',
                  description: 'Choose patient(s) or enter phone numbers manually',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Choose Template',
                  description: 'Select from predefined templates or compose new message',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Customize Message',
                  description: 'Edit template with patient-specific variables',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Set Message Type',
                  description: 'Categorize as appointment_reminder, payment_reminder, etc.',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Preview Message',
                  description: 'Review final message with character count',
                  type: 'system'
                },
                {
                  step: 7,
                  action: 'Validate Content',
                  description: 'validate_sms_content_trigger checks compliance rules',
                  type: 'trigger'
                },
                {
                  step: 8,
                  action: 'Check SMS Balance',
                  description: 'Verify practice has sufficient SMS credits',
                  type: 'system'
                },
                {
                  step: 9,
                  action: 'Schedule or Send',
                  description: 'Choose immediate send or schedule for later',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Create Log Entry',
                  description: 'INSERT record into practice_sms_logs with pending status',
                  type: 'database'
                },
                {
                  step: 11,
                  action: 'Gateway Processing',
                  description: 'centralized-sms-gateway processes and sends via SMSPortal',
                  type: 'edge-function'
                },
                {
                  step: 12,
                  action: 'Update Status',
                  description: 'Status changes from pending to sent with provider response',
                  type: 'system'
                },
                {
                  step: 13,
                  action: 'Usage Counter Update',
                  description: 'increment_sms_usage_counter_trigger updates subscription',
                  type: 'trigger'
                },
                {
                  step: 14,
                  action: 'Delivery Tracking',
                  description: 'sms-status-webhook monitors for delivery confirmations',
                  type: 'edge-function'
                },
                {
                  step: 15,
                  action: 'Final Status Update',
                  description: 'Status updated to delivered/failed with timestamps',
                  type: 'system'
                }
              ]
            }
          ]
        },
        {
          name: 'practice_email_logs',
          purpose: 'Comprehensive email tracking with delivery status, engagement metrics, and full audit trail',
          keyRelations: ['practice_id → practices.id', 'patient_id → patients.id', 'appointment_id → appointments.id', 'visit_id → visits.id', 'invoice_id → invoices_enhanced.id', 'user_id → users.id'],
          timestamps: ['created_at', 'updated_at', 'sent_at', 'delivered_at', 'opened_at', 'clicked_at', 'bounced_at', 'failed_at'],
          references: ['practices', 'patients', 'appointments', 'visits', 'invoices_enhanced', 'users'],
          referencedBy: ['practice_email_subscriptions'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for email log record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice that sent the email',
              isForeignKey: true,
              references: 'practices.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'recipient_email',
              dataType: 'TEXT',
              description: 'Email address of recipient',
              required: true,
              example: 'patient@example.com',
              constraints: ['NOT NULL'],
              detailedDescription: 'Valid email address where message was sent'
            },
            {
              name: 'recipient_name',
              dataType: 'TEXT',
              description: 'Display name of recipient',
              example: 'John Smith',
              detailedDescription: 'Human-readable name for email personalization'
            },
            {
              name: 'sender_email',
              dataType: 'TEXT',
              description: 'Email address of sender',
              required: true,
              example: 'noreply@clinic.com',
              constraints: ['NOT NULL'],
              detailedDescription: 'From address configured for practice'
            },
            {
              name: 'sender_name',
              dataType: 'TEXT',
              description: 'Display name of sender',
              example: 'OneHealth Clinic',
              detailedDescription: 'Practice name or staff member name'
            },
            {
              name: 'subject',
              dataType: 'TEXT',
              description: 'Email subject line',
              required: true,
              example: 'Your Appointment Confirmation',
              constraints: ['NOT NULL'],
              detailedDescription: 'Subject line as sent to recipient'
            },
            {
              name: 'html_content',
              dataType: 'TEXT',
              description: 'HTML version of email content',
              example: '<html><body><h1>Welcome</h1>...</body></html>',
              detailedDescription: 'Rich HTML content with formatting and images'
            },
            {
              name: 'text_content',
              dataType: 'TEXT',
              description: 'Plain text version of email content',
              example: 'Welcome to our clinic...',
              detailedDescription: 'Plain text fallback for email clients'
            },
            {
              name: 'email_type',
              dataType: 'TEXT',
              description: 'Category of email message',
              required: true,
              example: 'appointment_confirmation',
              constraints: ['NOT NULL', "CHECK (email_type IN ('appointment_confirmation', 'appointment_reminder', 'invoice', 'statement', 'test_results', 'newsletter', 'marketing', 'system'))"],
              detailedDescription: 'Categorizes email for analytics and compliance'
            },
            {
              name: 'provider',
              dataType: 'TEXT',
              description: 'Email service provider used',
              required: true,
              defaultValue: "'resend'",
              example: 'resend',
              constraints: ['NOT NULL'],
              detailedDescription: 'Email delivery service (currently Resend)'
            },
            {
              name: 'provider_message_id',
              dataType: 'TEXT',
              description: 'Provider-assigned message identifier',
              example: 'resend_123456789',
              detailedDescription: 'External provider reference for tracking'
            },
            {
              name: 'provider_response',
              dataType: 'JSONB',
              description: 'Full provider API response',
              example: '{"id": "resend_123", "status": "queued"}',
              detailedDescription: 'Complete response from email provider API'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current delivery status of email',
              required: true,
              defaultValue: "'pending'",
              example: 'delivered',
              constraints: ['NOT NULL', "CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'bounced', 'failed', 'cancelled'))"],
              detailedDescription: 'Tracks email from creation through delivery'
            },
            {
              name: 'sent_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email was sent to provider',
              detailedDescription: 'Provider confirmation timestamp for submission'
            },
            {
              name: 'delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email was delivered to recipient',
              detailedDescription: 'Final delivery confirmation from email server'
            },
            {
              name: 'opened_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email was first opened by recipient',
              detailedDescription: 'First open timestamp (tracking pixel based)'
            },
            {
              name: 'clicked_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When recipient first clicked a link',
              detailedDescription: 'First click timestamp from any tracked link'
            },
            {
              name: 'bounced_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email bounced back undelivered',
              detailedDescription: 'Bounce detection timestamp'
            },
            {
              name: 'failed_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email failed to send',
              detailedDescription: 'Failure detection timestamp'
            },
            {
              name: 'failure_reason',
              dataType: 'TEXT',
              description: 'Reason for email failure or bounce',
              example: 'Email address does not exist',
              detailedDescription: 'Human-readable error for troubleshooting'
            },
            {
              name: 'open_count',
              dataType: 'INTEGER',
              description: 'Number of times email was opened',
              defaultValue: '0',
              example: '3',
              detailedDescription: 'Total opens (including multiple by same recipient)'
            },
            {
              name: 'click_count',
              dataType: 'INTEGER',
              description: 'Number of link clicks in email',
              defaultValue: '0',
              example: '2',
              detailedDescription: 'Total clicks across all links in email'
            },
            {
              name: 'attachments',
              dataType: 'JSONB',
              description: 'Array of email attachments',
              defaultValue: "'[]'",
              example: '[{"name": "invoice.pdf", "size": 12345, "type": "application/pdf"}]',
              detailedDescription: 'List of files attached to email with metadata'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Patient who received the email',
              isForeignKey: true,
              references: 'patients.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links email to specific patient record'
            },
            {
              name: 'appointment_id',
              dataType: 'UUID',
              description: 'Related appointment if applicable',
              isForeignKey: true,
              references: 'appointments.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Associates email with specific appointment'
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Related visit if applicable',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links email to patient visit or encounter'
            },
            {
              name: 'invoice_id',
              dataType: 'UUID',
              description: 'Related invoice if applicable',
              isForeignKey: true,
              references: 'invoices_enhanced.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Associates email with specific invoice'
            },
            {
              name: 'user_id',
              dataType: 'UUID',
              description: 'User who initiated the email',
              isForeignKey: true,
              references: 'users.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Tracks which staff member sent the email'
            },
            {
              name: 'metadata',
              dataType: 'JSONB',
              description: 'Additional structured data',
              defaultValue: "'{}'",
              example: '{"campaign": "annual_checkup", "template_id": "reminder_v2"}',
              detailedDescription: 'Flexible field for campaign tracking and context'
            },
            {
              name: 'tags',
              dataType: 'ARRAY',
              description: 'Searchable tags for categorization',
              defaultValue: "'{}'",
              example: '["urgent", "invoice", "automated"]',
              detailedDescription: 'Array of keywords for filtering and analytics'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'CURRENT_TIMESTAMP',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'CURRENT_TIMESTAMP',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'email_logs_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'validate_email_content_trigger',
              description: 'Validates email content and compliance rules',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'track_email_engagement_trigger',
              description: 'Updates engagement metrics (opens, clicks)',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'increment_email_usage_counter_trigger',
              description: 'Updates practice email subscription usage',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_email_delivery_rate(p_practice_id, p_date_range)',
              description: 'Calculates email delivery success rate for practice',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_email_engagement_stats(p_practice_id, p_period)',
              description: 'Returns open rates, click rates, and engagement metrics',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_patient_email_history(p_patient_id)',
              description: 'Retrieves complete email communication history for patient',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_email_bounces_analysis(p_practice_id)',
              description: 'Analyzes bounce patterns and invalid email addresses',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'centralized-email-gateway',
              description: 'Main email sending service with Resend integration',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'email-template-engine',
              description: 'Processes email templates with dynamic content',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'email-engagement-tracker',
              description: 'Tracks opens, clicks, and engagement metrics',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'email-bounce-handler',
              description: 'Processes bounce notifications and updates status',
              lastUpdated: '2025-01-13'
            }
          ],
          forms: [
            {
              name: 'EmailComposeForm.tsx',
              description: 'Email composition and sending interface',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'EmailTemplateForm.tsx',
              description: 'Email template creation and management',
              lastUpdated: '2025-01-13'
            }
          ],
          formWorkflows: [
            {
              formName: 'EmailComposeForm.tsx',
              description: 'Email composition and delivery workflow',
              dataFlow: [
                {
                  step: 1,
                  action: 'Open Email Compose',
                  description: 'User clicks "Send Email" or "Email Invoice" from patient view',
                  type: 'user'
                },
                {
                  step: 2,
                  action: 'Select Recipients',
                  description: 'Choose patient(s) or enter email addresses manually',
                  type: 'user'
                },
                {
                  step: 3,
                  action: 'Choose Template',
                  description: 'Select from predefined templates or compose new email',
                  type: 'user'
                },
                {
                  step: 4,
                  action: 'Customize Content',
                  description: 'Edit subject, HTML content, and plain text version',
                  type: 'user'
                },
                {
                  step: 5,
                  action: 'Set Email Type',
                  description: 'Categorize as invoice, appointment_confirmation, etc.',
                  type: 'user'
                },
                {
                  step: 6,
                  action: 'Add Attachments',
                  description: 'Upload files like invoices, lab results, or documents',
                  type: 'user'
                },
                {
                  step: 7,
                  action: 'Preview Email',
                  description: 'Review final email in HTML and text formats',
                  type: 'system'
                },
                {
                  step: 8,
                  action: 'Validate Content',
                  description: 'validate_email_content_trigger checks compliance',
                  type: 'trigger'
                },
                {
                  step: 9,
                  action: 'Schedule or Send',
                  description: 'Choose immediate send or schedule for later',
                  type: 'user'
                },
                {
                  step: 10,
                  action: 'Create Log Entry',
                  description: 'INSERT record into practice_email_logs with pending status',
                  type: 'database'
                },
                {
                  step: 11,
                  action: 'Template Processing',
                  description: 'email-template-engine processes dynamic content',
                  type: 'edge-function'
                },
                {
                  step: 12,
                  action: 'Gateway Processing',
                  description: 'centralized-email-gateway sends via Resend API',
                  type: 'edge-function'
                },
                {
                  step: 13,
                  action: 'Update Status',
                  description: 'Status changes from pending to sent with provider response',
                  type: 'system'
                },
                {
                  step: 14,
                  action: 'Usage Counter Update',
                  description: 'increment_email_usage_counter_trigger updates subscription',
                  type: 'trigger'
                },
                {
                  step: 15,
                  action: 'Engagement Tracking',
                  description: 'email-engagement-tracker monitors opens and clicks',
                  type: 'edge-function'
                },
                {
                  step: 16,
                  action: 'Delivery Confirmation',
                  description: 'Status updated to delivered with timestamps',
                  type: 'system'
                },
                {
                  step: 17,
                  action: 'Bounce Handling',
                  description: 'email-bounce-handler processes any bounce notifications',
                  type: 'edge-function'
                }
              ]
            }
          ]
        },
        {
          name: 'automation_executions',
          purpose: 'Central orchestration table for all automated communication workflows and campaign execution',
          keyRelations: ['automation_id → automation_definitions.id', 'practice_id → practices.id', 'patient_id → patients.id', 'visit_id → visits.id', 'invoice_id → invoices_enhanced.id'],
          timestamps: ['created_at', 'updated_at', 'scheduled_at', 'executed_at', 'completed_at', 'next_retry_at'],
          references: ['automation_definitions', 'practices', 'patients', 'visits', 'invoices_enhanced'],
          referencedBy: ['automation_queue', 'automation_notifications'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for automation execution',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'automation_id',
              dataType: 'UUID',
              description: 'Reference to automation definition',
              isForeignKey: true,
              references: 'automation_definitions.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Links to automation rule that triggered this execution'
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice running the automation',
              isForeignKey: true,
              references: 'practices.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'trigger_id',
              dataType: 'UUID',
              description: 'Specific trigger that initiated execution',
              isForeignKey: true,
              references: 'automation_triggers.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links to trigger event (appointment_created, payment_overdue, etc.)'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Target patient for automation',
              isForeignKey: true,
              references: 'patients.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Patient who will receive the automated communication'
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Related visit if applicable',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Associates automation with specific patient visit'
            },
            {
              name: 'invoice_id',
              dataType: 'UUID',
              description: 'Related invoice if applicable',
              isForeignKey: true,
              references: 'invoices_enhanced.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links automation to specific invoice for payment reminders'
            },
            {
              name: 'related_table',
              dataType: 'TEXT',
              description: 'Table name of related record',
              example: 'appointments',
              detailedDescription: 'Identifies the source table that triggered automation'
            },
            {
              name: 'related_record_id',
              dataType: 'UUID',
              description: 'ID of related record',
              example: 'appointment-uuid-123',
              detailedDescription: 'Specific record ID that triggered the automation'
            },
            {
              name: 'scheduled_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When automation should execute',
              required: true,
              constraints: ['NOT NULL'],
              detailedDescription: 'Target execution time (may be immediate or scheduled)'
            },
            {
              name: 'executed_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When automation actually started executing',
              detailedDescription: 'Actual start time of automation processing'
            },
            {
              name: 'completed_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When automation finished successfully',
              detailedDescription: 'Completion timestamp for successful execution'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current execution status',
              required: true,
              defaultValue: "'pending'",
              example: 'completed',
              constraints: ['NOT NULL', "CHECK (status IN ('pending', 'queued', 'executing', 'completed', 'failed', 'cancelled', 'retry'))"],
              detailedDescription: 'Tracks automation through its lifecycle'
            },
            {
              name: 'channel',
              dataType: 'TEXT',
              description: 'Communication channel used',
              example: 'sms',
              constraints: ["CHECK (channel IN ('sms', 'email', 'both', 'notification'))"],
              detailedDescription: 'How the automation will communicate with recipient'
            },
            {
              name: 'message_id',
              dataType: 'UUID',
              description: 'Reference to sent message',
              isForeignKey: true,
              references: 'messages.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links to actual message sent (SMS or email log)'
            },
            {
              name: 'template_data',
              dataType: 'JSONB',
              description: 'Data used for template rendering',
              defaultValue: "'{}'",
              example: '{"patient_name": "John Smith", "appointment_time": "2pm"}',
              detailedDescription: 'Variables and data used to populate message template'
            },
            {
              name: 'variables_used',
              dataType: 'JSONB',
              description: 'Template variables that were substituted',
              defaultValue: "'{}'",
              example: '{"{{patient_name}}": "John Smith", "{{clinic_name}}": "OneHealth"}',
              detailedDescription: 'Record of all template substitutions made'
            },
            {
              name: 'error_message',
              dataType: 'TEXT',
              description: 'Error description if execution failed',
              example: 'Patient has no phone number on file',
              detailedDescription: 'Human-readable error message for troubleshooting'
            },
            {
              name: 'retry_count',
              dataType: 'INTEGER',
              description: 'Number of retry attempts made',
              defaultValue: '0',
              example: '2',
              detailedDescription: 'Incremented on each retry attempt'
            },
            {
              name: 'next_retry_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When next retry should be attempted',
              detailedDescription: 'Scheduled time for next retry (exponential backoff)'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'automation_executions_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'queue_automation_execution_trigger',
              description: 'Automatically queues execution when status changes to queued',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'track_execution_metrics_trigger',
              description: 'Updates automation performance metrics',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'schedule_automation_execution(p_automation_id, p_context)',
              description: 'Creates new automation execution with proper scheduling',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_automation_success_rate(p_practice_id, p_period)',
              description: 'Calculates automation execution success rates',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'retry_failed_executions(p_practice_id)',
              description: 'Reschedules failed automations for retry',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_patient_automation_history(p_patient_id)',
              description: 'Returns complete automation history for patient',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'automation-execution-engine',
              description: 'Main automation processing and execution engine',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'automation-scheduler',
              description: 'Schedules and manages automation timing',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'automation-retry-handler',
              description: 'Manages failed execution retries with exponential backoff',
              lastUpdated: '2025-01-13'
            }
          ],
          forms: [
            {
              name: 'AutomationExecutionMonitor.tsx',
              description: 'Automation execution monitoring and management interface',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'AutomationRetryForm.tsx',
              description: 'Manual retry configuration for failed automations',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'messages',
          purpose: 'Universal message queue and delivery system for all communication channels',
          keyRelations: ['template_id → message_templates.id'],
          timestamps: ['created_at', 'updated_at', 'scheduled_for', 'sent_at'],
          references: ['message_templates'],
          referencedBy: ['practice_sms_logs', 'practice_email_logs'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for message record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'type',
              dataType: 'TEXT',
              description: 'Type of message channel',
              required: true,
              example: 'sms',
              constraints: ['NOT NULL', "CHECK (type IN ('sms', 'email', 'push', 'notification'))"],
              detailedDescription: 'Determines which delivery channel to use'
            },
            {
              name: 'template_id',
              dataType: 'UUID',
              description: 'Message template used',
              isForeignKey: true,
              references: 'message_templates.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links to template used for message generation'
            },
            {
              name: 'recipient',
              dataType: 'TEXT',
              description: 'Recipient address (phone/email)',
              required: true,
              example: '+27123456789 or user@example.com',
              constraints: ['NOT NULL'],
              detailedDescription: 'Phone number for SMS or email address for email'
            },
            {
              name: 'subject',
              dataType: 'TEXT',
              description: 'Message subject (emails only)',
              example: 'Appointment Reminder',
              detailedDescription: 'Subject line for email messages'
            },
            {
              name: 'content',
              dataType: 'TEXT',
              description: 'Final rendered message content',
              required: true,
              example: 'Your appointment is tomorrow at 2pm',
              constraints: ['NOT NULL'],
              detailedDescription: 'Complete message text after template processing'
            },
            {
              name: 'status',
              dataType: 'TEXT',
              description: 'Current message status',
              required: true,
              defaultValue: "'pending'",
              example: 'sent',
              constraints: ['NOT NULL', "CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'cancelled'))"],
              detailedDescription: 'Tracks message through delivery pipeline'
            },
            {
              name: 'scheduled_for',
              dataType: 'TIMESTAMPTZ',
              description: 'When message should be sent',
              detailedDescription: 'Scheduled delivery time (may be immediate)'
            },
            {
              name: 'sent_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When message was actually sent',
              detailedDescription: 'Actual delivery timestamp'
            },
            {
              name: 'error',
              dataType: 'TEXT',
              description: 'Error message if delivery failed',
              example: 'Invalid phone number format',
              detailedDescription: 'Description of delivery failure'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'messages_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'route_message_to_channel_trigger',
              description: 'Routes message to appropriate delivery channel',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'schedule_message_delivery_trigger',
              description: 'Schedules message for delivery processing',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'queue_message(p_type, p_recipient, p_content, p_schedule)',
              description: 'Adds new message to delivery queue',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_pending_messages(p_channel)',
              description: 'Retrieves messages ready for delivery',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'mark_message_delivered(p_message_id)',
              description: 'Updates message status to delivered',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_message_delivery_stats(p_date_range)',
              description: 'Returns delivery statistics by channel',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'message-queue-processor',
              description: 'Processes messages from queue for delivery',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'message-router',
              description: 'Routes messages to appropriate delivery channels',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'message-scheduler',
              description: 'Manages scheduled message delivery timing',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'automation_templates',
          purpose: 'Message templates for automation with variable substitution and multi-channel support',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['practices'],
          referencedBy: ['automation_executions', 'messages'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for template',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice that owns the template',
              isForeignKey: true,
              references: 'practices.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL']
            },
            {
              name: 'name',
              dataType: 'TEXT',
              description: 'Template name for identification',
              required: true,
              example: 'Appointment Reminder SMS',
              constraints: ['NOT NULL'],
              detailedDescription: 'Human-readable template name'
            },
            {
              name: 'type',
              dataType: 'TEXT',
              description: 'Template type and usage context',
              required: true,
              example: 'appointment_reminder',
              constraints: ['NOT NULL', "CHECK (type IN ('appointment_reminder', 'appointment_confirmation', 'payment_reminder', 'test_results', 'follow_up', 'marketing', 'custom'))"],
              detailedDescription: 'Categorizes template for automated workflows'
            },
            {
              name: 'channel',
              dataType: 'TEXT',
              description: 'Communication channel for template',
              required: true,
              example: 'sms',
              constraints: ['NOT NULL', "CHECK (channel IN ('sms', 'email', 'both'))"],
              detailedDescription: 'Specifies delivery method for template'
            },
            {
              name: 'subject_template',
              dataType: 'TEXT',
              description: 'Subject line template (email only)',
              example: 'Appointment Reminder - {{practice_name}}',
              detailedDescription: 'Subject template with variable placeholders'
            },
            {
              name: 'content_template',
              dataType: 'TEXT',
              description: 'Message content template',
              required: true,
              example: 'Hi {{patient_name}}, your appointment is {{appointment_date}} at {{appointment_time}}.',
              constraints: ['NOT NULL'],
              detailedDescription: 'Message body with variable placeholders'
            },
            {
              name: 'variables',
              dataType: 'JSONB',
              description: 'Available template variables',
              defaultValue: "'[]'",
              example: '["patient_name", "appointment_date", "practice_name"]',
              detailedDescription: 'List of variables that can be used in template'
            },
            {
              name: 'is_active',
              dataType: 'BOOLEAN',
              description: 'Whether template is active',
              defaultValue: 'true',
              detailedDescription: 'Inactive templates are not used in automations'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last modification timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'automation_templates_updated_at_trigger',
              description: 'Updates the updated_at timestamp on record changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'validate_template_variables_trigger',
              description: 'Validates template syntax and variable usage',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'parse_template_variables(p_template, p_context)',
              description: 'Replaces template placeholders with actual values',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'validate_template_syntax(p_template)',
              description: 'Checks template for valid syntax and variables',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_available_variables(p_template_type)',
              description: 'Returns available variables for template type',
              lastUpdated: '2025-01-13'
            }
          ],
          forms: [
            {
              name: 'AutomationTemplateForm.tsx',
              description: 'Template creation and editing interface',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'system_notifications',
          purpose: 'Central notification system for all in-app notifications with rich content and delivery tracking',
          keyRelations: ['user_id → users.id', 'practice_id → practices.id', 'patient_id → patients.id'],
          timestamps: ['created_at', 'updated_at', 'delivered_at', 'read_at', 'dismissed_at', 'clicked_at', 'expires_at'],
          references: ['users', 'practices', 'patients', 'visits', 'invoices', 'tasks'],
          referencedBy: ['notification_deliveries', 'user_notification_preferences'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for notification',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'uuid_generate_v4()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'user_id',
              dataType: 'UUID',
              description: 'Target user for notification',
              isForeignKey: true,
              references: 'users.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'User who will receive this notification'
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice that owns the notification',
              isForeignKey: true,
              references: 'practices.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Practice context for notification'
            },
            {
              name: 'notification_type',
              dataType: 'ENUM',
              description: 'Type of notification',
              required: true,
              example: 'appointment_reminder',
              constraints: ['NOT NULL', 'ENUM: lab_results, appointment_reminder, appointment_cancelled, new_message, task_assigned, invoice_generated, patient_arrived, etc.'],
              detailedDescription: 'Categorizes notification for filtering and display'
            },
            {
              name: 'priority',
              dataType: 'ENUM',
              description: 'Notification priority level',
              defaultValue: 'medium',
              example: 'high',
              constraints: ['ENUM: low, medium, high, urgent, critical'],
              detailedDescription: 'Determines display prominence and urgency'
            },
            {
              name: 'status',
              dataType: 'ENUM',
              description: 'Current notification status',
              defaultValue: 'pending',
              example: 'delivered',
              constraints: ['ENUM: pending, delivered, read, dismissed, expired'],
              detailedDescription: 'Tracks notification lifecycle'
            },
            {
              name: 'title',
              dataType: 'TEXT',
              description: 'Notification title/headline',
              required: true,
              example: 'New Lab Results Available',
              constraints: ['NOT NULL'],
              detailedDescription: 'Short descriptive title for notification'
            },
            {
              name: 'message',
              dataType: 'TEXT',
              description: 'Notification message content',
              required: true,
              example: 'Lab results for John Smith are ready for review.',
              constraints: ['NOT NULL'],
              detailedDescription: 'Main notification text content'
            },
            {
              name: 'action_url',
              dataType: 'TEXT',
              description: 'URL for notification action',
              example: '/patients/123/lab-results',
              detailedDescription: 'Deep link for user to take action on notification'
            },
            {
              name: 'icon_name',
              dataType: 'TEXT',
              description: 'Icon identifier for notification',
              example: 'solar:medical-kit-bold-duotone',
              detailedDescription: 'Solar icon name for visual representation'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Related patient (if applicable)',
              isForeignKey: true,
              references: 'patients.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Patient context for patient-related notifications'
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Related visit (if applicable)',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Visit context for appointment/visit notifications'
            },
            {
              name: 'is_actionable',
              dataType: 'BOOLEAN',
              description: 'Whether notification requires user action',
              defaultValue: 'false',
              detailedDescription: 'Indicates if notification has clickable action'
            },
            {
              name: 'requires_acknowledgment',
              dataType: 'BOOLEAN',
              description: 'Whether notification requires explicit acknowledgment',
              defaultValue: 'false',
              detailedDescription: 'Critical notifications that must be acknowledged'
            },
            {
              name: 'metadata',
              dataType: 'JSONB',
              description: 'Additional notification metadata',
              defaultValue: "'{}'",
              example: '{"lab_request_id": "123", "doctor_name": "Dr. Smith"}',
              detailedDescription: 'Flexible storage for notification-specific data'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When notification was created',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When notification was delivered to user',
              detailedDescription: 'Timestamp of successful delivery'
            },
            {
              name: 'read_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When notification was read by user',
              detailedDescription: 'User engagement tracking'
            },
            {
              name: 'expires_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When notification expires',
              detailedDescription: 'Auto-dismissal time for time-sensitive notifications'
            }
          ],
          triggers: [
            {
              name: 'notification_status_update',
              description: 'Updates timestamps when status changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'notification_expiry_check',
              description: 'Automatically expires old notifications',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_user_notifications(p_user_id, p_limit)',
              description: 'Retrieves notifications for user with pagination',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'mark_notification_read(p_notification_id)',
              description: 'Marks notification as read and updates timestamp',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_notification_stats(p_practice_id)',
              description: 'Returns notification statistics for practice',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'notification-processor',
              description: 'Creates and delivers notifications',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'notification-cleanup',
              description: 'Expires and cleans old notifications',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'internal_message_channels',
          purpose: 'Channel management for internal messaging system supporting various channel types and patient care workflows',
          keyRelations: ['practice_id → practices.id', 'created_by → users.id', 'patient_id → patients.id'],
          timestamps: ['created_at', 'updated_at', 'last_activity_at'],
          references: ['practices', 'users', 'patients', 'visits', 'departments'],
          referencedBy: ['internal_message_threads', 'internal_messages', 'channel_participants'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for channel',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'uuid_generate_v4()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice that owns the channel',
              isForeignKey: true,
              references: 'practices.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Practice context for all messaging channels'
            },
            {
              name: 'channel_type',
              dataType: 'ENUM',
              description: 'Type of messaging channel',
              required: true,
              example: 'patient_care',
              constraints: ['NOT NULL', 'ENUM: direct, group, department, practice, broadcast, patient_care'],
              detailedDescription: 'Channel type determines behavior and participant rules'
            },
            {
              name: 'name',
              dataType: 'TEXT',
              description: 'Channel display name',
              example: 'John Smith - Patient Care',
              detailedDescription: 'Human-readable channel name for UI display'
            },
            {
              name: 'description',
              dataType: 'TEXT',
              description: 'Channel description or purpose',
              example: 'Care coordination for Patient #12345',
              detailedDescription: 'Additional context about channel purpose'
            },
            {
              name: 'avatar_url',
              dataType: 'TEXT',
              description: 'Channel avatar image URL',
              detailedDescription: 'Visual representation for group channels'
            },
            {
              name: 'is_archived',
              dataType: 'BOOLEAN',
              description: 'Whether channel is archived',
              defaultValue: 'false',
              detailedDescription: 'Archived channels are hidden but preserved'
            },
            {
              name: 'is_muted',
              dataType: 'BOOLEAN',
              description: 'Whether channel notifications are muted',
              defaultValue: 'false',
              detailedDescription: 'Muted channels do not send notifications'
            },
            {
              name: 'allow_replies',
              dataType: 'BOOLEAN',
              description: 'Whether replies are allowed in channel',
              defaultValue: 'true',
              detailedDescription: 'Controls whether users can respond to messages'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Related patient for patient_care channels',
              isForeignKey: true,
              references: 'patients.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Patient context for care-related messaging'
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Related visit for visit-specific channels',
              isForeignKey: true,
              references: 'visits.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Visit context for appointment-related messaging'
            },
            {
              name: 'department_id',
              dataType: 'UUID',
              description: 'Related department for department channels',
              isForeignKey: true,
              references: 'departments.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Department context for departmental messaging'
            },
            {
              name: 'created_by',
              dataType: 'UUID',
              description: 'User who created the channel',
              isForeignKey: true,
              references: 'users.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Channel creator with admin privileges'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Channel creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last channel update timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'last_activity_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last message activity in channel',
              defaultValue: 'now()',
              detailedDescription: 'Updated when new messages are posted'
            }
          ],
          triggers: [
            {
              name: 'update_channel_activity',
              description: 'Updates last_activity_at when messages are posted',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'channel_audit_log',
              description: 'Logs channel creation and modification',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_user_channels(p_user_id)',
              description: 'Retrieves all channels for user',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'create_patient_care_channel(p_patient_id, p_participants)',
              description: 'Creates patient care coordination channel',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'archive_channel(p_channel_id)',
              description: 'Archives channel and notifies participants',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'channel-management',
              description: 'Handles channel CRUD operations',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'channel-notifications',
              description: 'Manages channel-level notification settings',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'notification_deliveries',
          purpose: 'Multi-channel delivery tracking for all notifications with comprehensive analytics and failure handling',
          keyRelations: ['notification_id → system_notifications.id'],
          timestamps: ['created_at', 'updated_at', 'in_app_delivered_at', 'email_delivered_at', 'sms_delivered_at', 'push_delivered_at'],
          references: ['system_notifications'],
          referencedBy: ['delivery analytics', 'notification reports'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for delivery record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'uuid_generate_v4()',
              constraints: ['PRIMARY KEY', 'NOT NULL']
            },
            {
              name: 'notification_id',
              dataType: 'UUID',
              description: 'Reference to system notification',
              isForeignKey: true,
              references: 'system_notifications.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Links delivery tracking to notification'
            },
            {
              name: 'in_app_delivered',
              dataType: 'BOOLEAN',
              description: 'In-app notification delivery status',
              defaultValue: 'false',
              detailedDescription: 'Whether notification was successfully delivered to app'
            },
            {
              name: 'email_delivered',
              dataType: 'BOOLEAN',
              description: 'Email notification delivery status',
              defaultValue: 'false',
              detailedDescription: 'Whether email was successfully sent'
            },
            {
              name: 'sms_delivered',
              dataType: 'BOOLEAN',
              description: 'SMS notification delivery status',
              defaultValue: 'false',
              detailedDescription: 'Whether SMS was successfully sent'
            },
            {
              name: 'push_delivered',
              dataType: 'BOOLEAN',
              description: 'Push notification delivery status',
              defaultValue: 'false',
              detailedDescription: 'Whether push notification was delivered'
            },
            {
              name: 'in_app_delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'In-app delivery timestamp',
              detailedDescription: 'When in-app notification was delivered'
            },
            {
              name: 'email_delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Email delivery timestamp',
              detailedDescription: 'When email was successfully sent'
            },
            {
              name: 'sms_delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'SMS delivery timestamp',
              detailedDescription: 'When SMS was successfully sent'
            },
            {
              name: 'push_delivered_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Push notification delivery timestamp',
              detailedDescription: 'When push notification was delivered'
            },
            {
              name: 'email_failure_reason',
              dataType: 'TEXT',
              description: 'Email delivery failure reason',
              example: 'Invalid email address',
              detailedDescription: 'Human-readable error message for email failures'
            },
            {
              name: 'sms_failure_reason',
              dataType: 'TEXT',
              description: 'SMS delivery failure reason',
              example: 'Invalid phone number format',
              detailedDescription: 'Human-readable error message for SMS failures'
            },
            {
              name: 'push_failure_reason',
              dataType: 'TEXT',
              description: 'Push notification failure reason',
              example: 'Device token expired',
              detailedDescription: 'Human-readable error message for push failures'
            },
            {
              name: 'email_opened_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email was opened by recipient',
              detailedDescription: 'Email engagement tracking'
            },
            {
              name: 'email_clicked_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When email links were clicked',
              detailedDescription: 'Email click-through tracking'
            },
            {
              name: 'push_clicked_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When push notification was clicked',
              detailedDescription: 'Push notification engagement tracking'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Delivery record creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last delivery update timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'delivery_analytics_update',
              description: 'Updates delivery analytics when status changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'delivery_failure_alert',
              description: 'Alerts on delivery failures for critical notifications',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'calculate_delivery_success_rate(p_practice_id, p_date_range)',
              description: 'Calculates delivery success rates by channel',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_failed_deliveries(p_practice_id)',
              description: 'Returns recent delivery failures for investigation',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'update_delivery_status(p_delivery_id, p_channel, p_status)',
              description: 'Updates delivery status for specific channel',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'delivery-tracker',
              description: 'Tracks delivery status across all channels',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'delivery-analytics',
              description: 'Generates delivery performance reports',
              lastUpdated: '2025-01-13'
            }
          ]
        }
      ]
    },
    {
      id: 'services',
      title: 'Services & Business Logic',
      icon: 'solar:code-bold-duotone',
      lastUpdated: '2025-01-13 12:00:00 UTC',
      description: 'Core business logic services, utilities, and processing engines that power the application functionality.',
      color: 'violet',
      bgGradient: 'from-violet-500 to-purple-600',
      tables: [
        {
          name: 'automationTrigger.ts',
          purpose: 'Automation engine coordination service with n8n workflow integration',
          keyRelations: ['automation_queue', 'automation_executions', 'n8n workflows'],
          timestamps: ['execution_checks', 'status_monitoring'],
          references: ['automation_queue', 'automation_executions'],
          referencedBy: ['n8n automation workflows'],
          fields: [
            {
              name: 'triggerAutomationEngine()',
              dataType: 'FUNCTION',
              description: 'Checks pending automation status and coordinates with n8n',
              required: true,
              example: 'triggerAutomationEngine()',
              detailedDescription: 'Queries automation_queue for pending automations and monitors n8n processing status'
            },
            {
              name: 'checkPendingAutomations(practiceId?)',
              dataType: 'FUNCTION',
              description: 'Returns count of pending automations for practice',
              example: 'checkPendingAutomations("practice-uuid")',
              detailedDescription: 'Queries automation_executions table for pending status with optional practice filtering'
            },
            {
              name: 'setupAutomationProcessing(intervalMinutes)',
              dataType: 'FUNCTION',
              description: 'Sets up periodic automation monitoring',
              example: 'setupAutomationProcessing(5)',
              defaultValue: '5 minutes',
              detailedDescription: 'Establishes interval-based status checking while n8n handles actual processing'
            }
          ],
          triggers: [
            {
              name: 'periodic_status_check',
              description: 'Runs automation status check every 5 minutes',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'query_automation_queue',
              description: 'Queries pending automations from queue table',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'count_pending_executions',
              description: 'Counts pending automation executions by practice',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'n8n-automation-workflows',
              description: 'External n8n workflows handle actual automation processing',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'edgeFunctionService.ts',
          purpose: 'Centralized service for calling Supabase Edge Functions with authentication and error handling',
          keyRelations: ['Edge Functions', 'Authentication', 'SMS Gateway', 'Email Gateway'],
          timestamps: ['request_timestamps', 'response_logging'],
          references: ['Supabase Edge Runtime', 'Local Storage Auth'],
          referencedBy: ['Communication Services', 'SMS/Email Forms'],
          fields: [
            {
              name: 'supabaseUrl',
              dataType: 'STRING',
              description: 'Supabase project URL from environment',
              required: true,
              example: 'https://project.supabase.co',
              detailedDescription: 'Base URL for Supabase project from VITE_SUPABASE_URL env var'
            },
            {
              name: 'getAuthToken()',
              dataType: 'FUNCTION',
              description: 'Retrieves auth token from localStorage',
              example: 'getAuthToken() -> "eyJ..."',
              detailedDescription: 'Extracts access_token from hpms-auth localStorage key'
            },
            {
              name: 'invoke<T>(functionName, options)',
              dataType: 'FUNCTION',
              description: 'Generic edge function invocation with typing',
              required: true,
              example: 'invoke("sms-gateway", { body: {...} })',
              detailedDescription: 'Main method for calling any edge function with auth headers and error handling'
            },
            {
              name: 'sendEmail(params)',
              dataType: 'FUNCTION',
              description: 'Email gateway wrapper method',
              example: 'sendEmail({ practiceId, recipientEmail, subject, content })',
              detailedDescription: 'Convenience method for email-gateway-v2 edge function'
            },
            {
              name: 'sendSMS(params)',
              dataType: 'FUNCTION',
              description: 'SMS gateway wrapper method',
              example: 'sendSMS({ practiceId, recipientPhone, messageContent })',
              detailedDescription: 'Convenience method for centralized-sms-gateway edge function'
            }
          ],
          triggers: [
            {
              name: 'auth_validation',
              description: 'Validates authentication token before each request',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'request_logging',
              description: 'Logs all edge function calls for debugging',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'email-gateway-v2',
              description: 'Email delivery via Resend API',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'centralized-sms-gateway',
              description: 'SMS delivery via SMSPortal API',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'notificationDeliveryService.ts',
          purpose: 'Multi-channel notification delivery tracking with comprehensive analytics and real-time updates',
          keyRelations: ['notification_deliveries', 'system_notifications', 'practice_id'],
          timestamps: ['created_at', 'updated_at', 'delivered_at', 'opened_at', 'clicked_at'],
          references: ['notification_deliveries', 'system_notifications'],
          referencedBy: ['Notification UI Components', 'Analytics Dashboard'],
          fields: [
            {
              name: 'createDeliveryTracking(request)',
              dataType: 'FUNCTION',
              description: 'Creates delivery tracking record for new notification',
              required: true,
              example: 'createDeliveryTracking({ notificationId, channels: { email: true, sms: true } })',
              detailedDescription: 'Initializes tracking for all specified delivery channels'
            },
            {
              name: 'updateDeliveryStatus(request)',
              dataType: 'FUNCTION',
              description: 'Updates delivery status for specific channel',
              required: true,
              example: 'updateDeliveryStatus({ deliveryId, channel: "email", status: "delivered" })',
              detailedDescription: 'Updates timestamps and status for individual delivery channels'
            },
            {
              name: 'getDeliveryStatus(notificationId)',
              dataType: 'FUNCTION',
              description: 'Retrieves current delivery status',
              example: 'getDeliveryStatus("notif-uuid")',
              detailedDescription: 'Returns complete delivery tracking record with all channel statuses'
            },
            {
              name: 'getDeliveryStatistics(practiceId, dateRange)',
              dataType: 'FUNCTION',
              description: 'Calculates delivery analytics for practice',
              example: 'getDeliveryStatistics("practice-uuid", { from: "2025-01-01", to: "2025-01-31" })',
              detailedDescription: 'Returns comprehensive delivery stats by channel with success/failure rates'
            },
            {
              name: 'subscribeToDeliveryUpdates(notificationId, callback)',
              dataType: 'FUNCTION',
              description: 'Real-time subscription to delivery status changes',
              example: 'subscribeToDeliveryUpdates("notif-uuid", (delivery) => console.log(delivery))',
              detailedDescription: 'Sets up Supabase real-time subscription for delivery updates'
            }
          ],
          triggers: [
            {
              name: 'delivery_status_update',
              description: 'Updates timestamps when delivery status changes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'analytics_aggregation',
              description: 'Updates delivery analytics in real-time',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'calculate_delivery_rates',
              description: 'Calculates success rates by channel and practice',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'aggregate_delivery_metrics',
              description: 'Aggregates delivery statistics for reporting',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'communicationService.ts',
          purpose: 'Unified communication service for SMS and Email with centralized gateway integration',
          keyRelations: ['practice_sms_logs', 'practice_email_logs', 'centralized gateways'],
          timestamps: ['sent_at', 'delivered_at', 'failed_at'],
          references: ['edgeFunctionService', 'notificationDeliveryService', 'SMSPortal API', 'Resend API'],
          referencedBy: ['Appointment Reminders', 'Invoice Delivery', 'Patient Communication'],
          fields: [
            {
              name: 'sendSMS(request)',
              dataType: 'FUNCTION',
              description: 'Sends SMS via centralized SMS gateway',
              required: true,
              example: 'sendSMS({ practiceId, recipientPhone, messageContent, messageType: "appointment_reminder" })',
              detailedDescription: 'Routes SMS through centralized-sms-gateway edge function with full logging'
            },
            {
              name: 'sendEmail(request)',
              dataType: 'FUNCTION',
              description: 'Sends email via centralized email gateway',
              required: true,
              example: 'sendEmail({ practiceId, recipientEmail, subject, htmlContent, emailType: "invoice" })',
              detailedDescription: 'Routes email through email-gateway-v2 edge function with delivery tracking'
            },
            {
              name: 'getCommunicationHistory(practiceId, filters)',
              dataType: 'FUNCTION',
              description: 'Retrieves communication history with filtering',
              example: 'getCommunicationHistory("practice-uuid", { patientId, dateRange, messageType })',
              detailedDescription: 'Returns paginated communication logs across all channels'
            },
            {
              name: 'validatePhoneNumber(phone)',
              dataType: 'FUNCTION',
              description: 'Validates phone number format for SMS',
              example: 'validatePhoneNumber("+27123456789")',
              detailedDescription: 'Ensures phone number meets SMSPortal format requirements'
            },
            {
              name: 'trackDeliveryStatus(messageId, channel)',
              dataType: 'FUNCTION',
              description: 'Updates delivery tracking for sent messages',
              example: 'trackDeliveryStatus("msg-uuid", "sms")',
              detailedDescription: 'Integrates with notificationDeliveryService for status updates'
            }
          ],
          triggers: [
            {
              name: 'communication_logging',
              description: 'Logs all communications to practice logs',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'subscription_usage_tracking',
              description: 'Updates practice subscription usage counters',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'log_sms_communication',
              description: 'Stores SMS in practice_sms_logs with metadata',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'log_email_communication',
              description: 'Stores email in practice_email_logs with metadata',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'check_subscription_limits',
              description: 'Validates practice has remaining communication credits',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'centralized-sms-gateway',
              description: 'SMSPortal integration with full logging and subscription tracking',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'email-gateway-v2',
              description: 'Resend API integration with attachment support and tracking',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'internalMessagingService.ts',
          purpose: 'Comprehensive internal messaging system with channels, threads, notifications, and real-time capabilities',
          keyRelations: ['internal_message_channels', 'internal_messages', 'system_notifications'],
          timestamps: ['created_at', 'updated_at', 'read_at', 'last_activity_at'],
          references: ['internal-messaging.types.ts', 'Supabase realtime', 'notification system'],
          referencedBy: ['Messaging UI Components', 'Notification Panel', 'Patient Care Workflows'],
          fields: [
            {
              name: 'createNotification(request)',
              dataType: 'FUNCTION',
              description: 'Creates system notification with smart processing',
              required: true,
              example: 'createNotification({ practiceId, userId, notificationType: "lab_results", title, message })',
              detailedDescription: 'Calls smart-notification-processor edge function for intelligent routing'
            },
            {
              name: 'createChannel(request)',
              dataType: 'FUNCTION',
              description: 'Creates messaging channel for team communication',
              required: true,
              example: 'createChannel({ practiceId, channelType: "patient_care", participantIds, patientId })',
              detailedDescription: 'Sets up internal messaging channels with participant management'
            },
            {
              name: 'sendMessage(request)',
              dataType: 'FUNCTION',
              description: 'Sends message to channel thread',
              required: true,
              example: 'sendMessage({ threadId, content, mentions: ["user-id"] })',
              detailedDescription: 'Posts message with real-time delivery and mention notifications'
            },
            {
              name: 'markNotificationRead(notificationId)',
              dataType: 'FUNCTION',
              description: 'Marks notification as read and updates analytics',
              example: 'markNotificationRead("notif-uuid")',
              detailedDescription: 'Updates read status and engagement metrics'
            },
            {
              name: 'subscribeToChannel(channelId, callback)',
              dataType: 'FUNCTION',
              description: 'Real-time subscription to channel messages',
              example: 'subscribeToChannel("channel-uuid", (message) => updateUI(message))',
              detailedDescription: 'Sets up Supabase real-time subscription for live messaging'
            },
            {
              name: 'sendTypingIndicator(channelId, isTyping)',
              dataType: 'FUNCTION',
              description: 'Broadcasts typing status to channel participants',
              example: 'sendTypingIndicator("channel-uuid", true)',
              detailedDescription: 'Real-time typing indicators for enhanced UX'
            }
          ],
          triggers: [
            {
              name: 'message_notification_trigger',
              description: 'Creates notifications for new messages and mentions',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'channel_activity_update',
              description: 'Updates channel last_activity_at timestamp',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_user_notifications_paginated',
              description: 'Returns user notifications with filtering and pagination',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_channel_participants',
              description: 'Returns channel participants with roles and permissions',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'search_messages',
              description: 'Full-text search across messages with context',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'smart-notification-processor',
              description: 'Intelligent notification routing and delivery',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'message-search-engine',
              description: 'Advanced message search with relevance scoring',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'smartNotificationTriggers.ts',
          purpose: 'Intelligent notification system with automated triggers, priority management, and follow-up sequences',
          keyRelations: ['visit workflow', 'diagnostic events', 'billing triggers', 'compliance alerts'],
          timestamps: ['triggered_at', 'executed_at', 'next_follow_up'],
          references: ['communicationService', 'visit management', 'diagnostic systems'],
          referencedBy: ['Clinical Workflows', 'Appointment System', 'Billing System'],
          fields: [
            {
              name: 'registerTrigger(trigger)',
              dataType: 'FUNCTION',
              description: 'Registers smart notification trigger with conditions',
              required: true,
              example: 'registerTrigger({ name: "lab_results_ready", category: "diagnostic", conditions, actions })',
              detailedDescription: 'Sets up automated triggers based on system events and data changes'
            },
            {
              name: 'evaluateConditions(data, conditions)',
              dataType: 'FUNCTION',
              description: 'Evaluates trigger conditions against event data',
              example: 'evaluateConditions(visitData, labResultConditions)',
              detailedDescription: 'Complex condition evaluation with logical operators and data validation'
            },
            {
              name: 'executeNotificationAction(action, context)',
              dataType: 'FUNCTION',
              description: 'Executes notification action with personalized content',
              required: true,
              example: 'executeNotificationAction(smsAction, { patient, appointment, practice })',
              detailedDescription: 'Template rendering and multi-channel notification delivery'
            },
            {
              name: 'scheduleFollowUp(sequence, context)',
              dataType: 'FUNCTION',
              description: 'Schedules automated follow-up notification sequence',
              example: 'scheduleFollowUp(appointmentReminderSequence, appointmentContext)',
              detailedDescription: 'Multi-step follow-up campaigns with escalation logic'
            },
            {
              name: 'processEmergencyTrigger(trigger, data)',
              dataType: 'FUNCTION',
              description: 'Immediate processing for critical/emergency triggers',
              example: 'processEmergencyTrigger(criticalLabTrigger, labResultData)',
              detailedDescription: 'Priority processing for time-sensitive medical alerts'
            }
          ],
          triggers: [
            {
              name: 'visit_status_change_trigger',
              description: 'Monitors visit status changes for automated notifications',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'diagnostic_result_trigger',
              description: 'Triggers notifications when lab/imaging results are available',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'appointment_reminder_trigger',
              description: 'Automated appointment reminder sequence management',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_active_triggers_for_practice',
              description: 'Returns configured triggers for practice with conditions',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'log_trigger_execution',
              description: 'Audit log for trigger executions and outcomes',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'calculate_trigger_effectiveness',
              description: 'Analytics on trigger performance and engagement',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'trigger-condition-evaluator',
              description: 'Advanced condition evaluation engine',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'notification-template-renderer',
              description: 'Dynamic template rendering with context injection',
              lastUpdated: '2025-01-13'
            }
          ]
        }
      ]
    },
    {
      id: 'types',
      title: 'TypeScript Definitions',
      icon: 'solar:code-square-bold-duotone',
      lastUpdated: '2025-01-13 12:00:00 UTC',
      description: 'Comprehensive TypeScript type definitions, interfaces, and type safety for all system components.',
      color: 'blue',
      bgGradient: 'from-blue-500 to-indigo-600',
      tables: [
        {
          name: 'internal-messaging.types.ts',
          purpose: 'Complete TypeScript definitions for internal messaging, notifications, and communication system',
          keyRelations: ['SystemNotification', 'InternalMessageChannel', 'MessageThread', 'DeliveryTracking'],
          timestamps: ['created_at', 'updated_at', 'read_at', 'delivered_at'],
          references: ['Database Tables', 'API Responses', 'UI Components'],
          referencedBy: ['Messaging Services', 'Notification Components', 'Communication Forms'],
          fields: [
            {
              name: 'SystemNotification',
              dataType: 'INTERFACE',
              description: 'Core notification structure with delivery tracking',
              required: true,
              example: '{ id, practice_id, user_id, notification_type, priority, title, message, ... }',
              detailedDescription: 'Main interface for system notifications with 28 properties including delivery channels, metadata, and timestamps'
            },
            {
              name: 'InternalMessageChannel',
              dataType: 'INTERFACE',
              description: 'Channel definition for internal messaging system',
              example: '{ id, practice_id, channel_type, name, participants, settings }',
              detailedDescription: 'Defines messaging channels with types: direct, group, department, practice, broadcast, patient_care'
            },
            {
              name: 'InternalMessage',
              dataType: 'INTERFACE',
              description: 'Individual message structure with threading support',
              example: '{ id, thread_id, sender_id, content, content_type, mentions, attachments }',
              detailedDescription: 'Message interface supporting text, HTML, markdown, files, images with replies and reactions'
            },
            {
              name: 'NotificationDelivery',
              dataType: 'INTERFACE',
              description: 'Multi-channel delivery tracking interface',
              example: '{ id, notification_id, channel, status, sent_at, delivered_at, failure_reason }',
              detailedDescription: 'Tracks delivery across in_app, email, SMS, push, webhook channels'
            },
            {
              name: 'MessageAttachment',
              dataType: 'INTERFACE',
              description: 'File attachment structure for messages',
              example: '{ id, message_id, filename, file_size, mime_type, file_url, thumbnail_url }',
              detailedDescription: 'Handles all file types with metadata for images, videos, documents'
            },
            {
              name: 'UserNotificationPreferences',
              dataType: 'INTERFACE',
              description: 'User-specific notification preferences and settings',
              example: '{ user_id, practice_id, email_enabled, sms_enabled, quiet_hours, notification_types }',
              detailedDescription: 'Granular notification preferences per user with quiet hours and per-type settings'
            },
            {
              name: 'RealtimeEvent',
              dataType: 'UNION_TYPE',
              description: 'Union type for all real-time messaging events',
              example: 'RealtimeMessageEvent | RealtimeNotificationEvent | RealtimeTypingEvent | RealtimeChannelEvent',
              detailedDescription: 'Type-safe real-time event handling for WebSocket communications'
            }
          ],
          forms: [
            {
              name: 'Type Definitions',
              description: 'Comprehensive TypeScript interfaces for type safety',
              lastUpdated: '2025-01-13'
            }
          ]
        }
      ]
    },
    {
      id: 'architecture',
      title: 'React Architecture',
      icon: 'solar:widget-4-bold-duotone',
      lastUpdated: '2025-01-13 12:00:00 UTC',
      description: 'React application architecture including hooks, stores, components, and state management patterns.',
      color: 'cyan',
      bgGradient: 'from-cyan-500 to-teal-600',
      tables: [
        {
          name: 'usePatientSettings.ts',
          purpose: 'Custom React hook for patient settings management with real-time updates',
          keyRelations: ['patients table', 'practice_settings', 'user preferences'],
          timestamps: ['last_fetched', 'cache_expiry'],
          references: ['Supabase Client', 'Auth Store', 'Settings Cache'],
          referencedBy: ['Patient Components', 'Settings Forms'],
          fields: [
            {
              name: 'usePatientSettings(patientId)',
              dataType: 'HOOK',
              description: 'Main hook function for patient settings',
              required: true,
              example: 'const { settings, updateSetting, loading, error } = usePatientSettings(patientId)',
              detailedDescription: 'Returns patient settings with CRUD operations and loading states'
            },
            {
              name: 'settings',
              dataType: 'STATE',
              description: 'Current patient settings object',
              example: '{ notifications: true, privacy_level: "standard", ... }',
              detailedDescription: 'Reactive settings object that updates when backend changes'
            },
            {
              name: 'updateSetting(key, value)',
              dataType: 'FUNCTION',
              description: 'Updates individual setting with optimistic updates',
              example: 'updateSetting("notifications", false)',
              detailedDescription: 'Performs optimistic UI update then syncs with database'
            },
            {
              name: 'loading',
              dataType: 'STATE',
              description: 'Loading state for settings operations',
              example: 'true | false',
              detailedDescription: 'Tracks loading state for initial fetch and updates'
            },
            {
              name: 'error',
              dataType: 'STATE',
              description: 'Error state for settings operations',
              example: 'null | Error object',
              detailedDescription: 'Captures and exposes any errors from settings operations'
            }
          ]
        },
        {
          name: 'patientsStoreNew.ts',
          purpose: 'Zustand store for patient data management with caching and real-time updates',
          keyRelations: ['patients table', 'visits table', 'medical_records'],
          timestamps: ['last_sync', 'cache_timestamp'],
          references: ['Zustand', 'Supabase Client', 'React Query'],
          referencedBy: ['Patient Components', 'Search Components', 'Medical Records'],
          fields: [
            {
              name: 'patients',
              dataType: 'STATE',
              description: 'Array of patient records with caching',
              example: '[{ id, name, email, phone, medical_aid, ... }]',
              detailedDescription: 'Cached patient data with automatic background refresh'
            },
            {
              name: 'selectedPatient',
              dataType: 'STATE',
              description: 'Currently selected patient for detail views',
              example: '{ id: "uuid", name: "John Doe", ... } | null',
              detailedDescription: 'Active patient for forms and detail components'
            },
            {
              name: 'searchQuery',
              dataType: 'STATE',
              description: 'Current search query string',
              example: '"john doe" | "medical aid: discovery"',
              detailedDescription: 'Search string for filtering patient list'
            },
            {
              name: 'fetchPatients(practiceId)',
              dataType: 'ACTION',
              description: 'Loads patients for practice with caching',
              example: 'fetchPatients("practice-uuid")',
              detailedDescription: 'Fetches and caches patient data with RLS filtering'
            },
            {
              name: 'updatePatient(patient)',
              dataType: 'ACTION',
              description: 'Updates patient record optimistically',
              example: 'updatePatient({ id, name: "Updated Name" })',
              detailedDescription: 'Optimistic update with automatic rollback on failure'
            },
            {
              name: 'setSelectedPatient(patient)',
              dataType: 'ACTION',
              description: 'Sets active patient for detail views',
              example: 'setSelectedPatient(patientObject)',
              detailedDescription: 'Updates selected patient and triggers dependent components'
            }
          ]
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
          purpose: 'Comprehensive invoice management with enhanced features for medical billing, medical aid claims, and financial tracking',
          keyRelations: ['patient_id → patients.id', 'visit_id → visits.id', 'practice_id → practices.id', 'practitioner_id → users.id'],
          timestamps: ['created_at', 'updated_at', 'issue_date', 'due_date'],
          references: ['patients', 'visits', 'practices', 'users', 'batch_headers'],
          referencedBy: ['invoice_services', 'payments', 'credit_notes'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for invoice record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'gen_random_uuid()',
              constraints: ['PRIMARY KEY', 'NOT NULL'],
              detailedDescription: 'Unique identifier for each invoice in the system'
            },
            {
              name: 'invoice_number',
              dataType: 'TEXT',
              description: 'Sequential invoice number for display and reference',
              required: true,
              example: 'INV-2025-001234',
              constraints: ['NOT NULL', 'UNIQUE'],
              detailedDescription: 'Human-readable invoice number generated by trigger, follows format INV-YYYY-NNNNNN'
            },
            {
              name: 'patient_id',
              dataType: 'UUID',
              description: 'Patient this invoice is for',
              isForeignKey: true,
              references: 'patients.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Links invoice to specific patient receiving services'
            },
            {
              name: 'visit_id',
              dataType: 'UUID',
              description: 'Visit/appointment that generated this invoice',
              isForeignKey: true,
              references: 'visits.id',
              required: true,
              constraints: ['FOREIGN KEY', 'NOT NULL'],
              detailedDescription: 'Links invoice to specific medical visit/encounter'
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice issuing the invoice',
              isForeignKey: true,
              references: 'practices.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Practice context for multi-tenant invoice management'
            },
            {
              name: 'practitioner_id',
              dataType: 'UUID',
              description: 'Practitioner responsible for services',
              isForeignKey: true,
              references: 'users.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Doctor or practitioner who provided the services being billed'
            },
            {
              name: 'issue_date',
              dataType: 'DATE',
              description: 'Date invoice was issued',
              defaultValue: 'CURRENT_DATE',
              example: '2025-01-13',
              detailedDescription: 'Date when invoice was generated and issued to patient'
            },
            {
              name: 'due_date',
              dataType: 'DATE',
              description: 'Payment due date',
              required: true,
              example: '2025-02-13',
              constraints: ['NOT NULL'],
              detailedDescription: 'Date by which payment is expected, typically 30 days from issue date'
            },
            {
              name: 'subtotal',
              dataType: 'NUMERIC',
              description: 'Total before tax',
              defaultValue: '0',
              example: '1500.00',
              detailedDescription: 'Sum of all line items before VAT/tax calculations'
            },
            {
              name: 'tax',
              dataType: 'NUMERIC',
              description: 'VAT/tax amount',
              defaultValue: '0',
              example: '225.00',
              detailedDescription: 'Calculated tax amount (typically 15% VAT in Namibia)'
            },
            {
              name: 'total',
              dataType: 'NUMERIC',
              description: 'Final total amount',
              defaultValue: '0',
              example: '1725.00',
              detailedDescription: 'Subtotal + tax = final amount due from patient and/or medical aid'
            },
            {
              name: 'medical_aid_total',
              dataType: 'NUMERIC',
              description: 'Amount to be claimed from medical aid',
              defaultValue: '0',
              example: '1380.00',
              detailedDescription: 'Portion of total that will be submitted to medical aid for reimbursement'
            },
            {
              name: 'patient_total',
              dataType: 'NUMERIC',
              description: 'Amount patient is responsible for',
              defaultValue: '0',
              example: '345.00',
              detailedDescription: 'Patient co-payment amount (total - medical_aid_total)'
            },
            {
              name: 'payment_status',
              dataType: 'TEXT',
              description: 'Current payment status',
              defaultValue: 'pending',
              example: 'partially_paid',
              constraints: ['CHECK (payment_status IN (\'pending\', \'partially_paid\', \'paid\', \'overdue\', \'cancelled\'))'],
              detailedDescription: 'Tracks payment progress through lifecycle'
            },
            {
              name: 'payment_method',
              dataType: 'TEXT',
              description: 'Method used for payment',
              example: 'card',
              constraints: ['CHECK (payment_method IN (\'cash\', \'card\', \'eft\', \'medical_aid\', \'mixed\'))'],
              detailedDescription: 'How patient made payment (if applicable)'
            },
            {
              name: 'medical_aid_claim_number',
              dataType: 'TEXT',
              description: 'Medical aid claim reference number',
              example: 'MA-2025-789012',
              detailedDescription: 'Reference number from medical aid provider for tracking claims'
            },
            {
              name: 'medical_aid_status',
              dataType: 'TEXT',
              description: 'Medical aid claim status',
              example: 'submitted',
              constraints: ['CHECK (medical_aid_status IN (\'pending\', \'submitted\', \'approved\', \'rejected\', \'partially_approved\'))'],
              detailedDescription: 'Status of medical aid claim processing'
            },
            {
              name: 'batch_id',
              dataType: 'UUID',
              description: 'Medical aid batch submission ID',
              isForeignKey: true,
              references: 'batch_headers.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links invoice to batch submission to medical aid'
            },
            {
              name: 'notes',
              dataType: 'TEXT',
              description: 'Additional notes or special instructions',
              example: 'Patient requested payment plan',
              detailedDescription: 'Free-text field for special notes about invoice or payment'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Invoice creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last update timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'calculate_invoice_totals',
              description: 'Auto-calculates subtotal, tax, and total amounts when line items change',
              lastUpdated: '2025-01-08'
            },
            {
              name: 'generate_invoice_number',
              description: 'Creates sequential invoice numbers following practice format',
              lastUpdated: '2024-12-18'
            },
            {
              name: 'update_payment_status',
              description: 'Tracks payment progress and updates status automatically',
              lastUpdated: '2024-11-22'
            },
            {
              name: 'split_medical_aid_amounts',
              description: 'Automatically calculates medical aid vs patient portions',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'calculate_invoice_tax(invoice_id)',
              description: 'Computes VAT/tax amounts based on practice tax settings',
              lastUpdated: '2024-12-30'
            },
            {
              name: 'get_outstanding_balance(invoice_id)',
              description: 'Returns unpaid amount considering all payments made',
              lastUpdated: '2025-01-03'
            },
            {
              name: 'generate_statement(patient_id, date_range)',
              description: 'Creates patient statements showing all invoices and payments',
              lastUpdated: '2024-11-28'
            },
            {
              name: 'get_invoice_summary(practice_id, date_range)',
              description: 'Returns financial summary for practice reporting',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'invoice-pdf-generator',
              description: 'Creates professional PDF invoices with practice branding',
              lastUpdated: '2025-01-10'
            },
            {
              name: 'payment-gateway-integration',
              description: 'Processes online payments through various providers',
              lastUpdated: '2024-12-25'
            },
            {
              name: 'invoice-email-sender',
              description: 'Distributes invoices via email with PDF attachments',
              lastUpdated: '2024-11-15'
            },
            {
              name: 'medical-aid-claim-processor',
              description: 'Submits claims to medical aid providers electronically',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'invoice_services',
          purpose: 'Invoice line items and services',
          keyRelations: ['invoice_id → invoices_enhanced.id'],
          timestamps: ['created_at'],
          references: ['invoices_enhanced', 'practice_tariffs'],
          triggers: [
            {
              name: 'validate_service_pricing',
              description: 'Ensures correct tariffs',
              lastUpdated: '2024-12-12'
            },
            {
              name: 'update_invoice_totals',
              description: 'Recalculates on changes',
              lastUpdated: '2024-11-08'
            }
          ]
        },
        {
          name: 'payments',
          purpose: 'Payment records and transactions',
          keyRelations: ['invoice_id → invoices_enhanced.id'],
          timestamps: ['created_at', 'processed_at'],
          references: ['invoices_enhanced'],
          triggers: [
            {
              name: 'allocate_payment_to_invoice',
              description: 'Applies payments',
              lastUpdated: '2024-12-20'
            },
            {
              name: 'generate_receipt_number',
              description: 'Creates receipt references',
              lastUpdated: '2024-11-18'
            }
          ],
          dbFunctions: [
            {
              name: 'reconcile_payments(date_range)',
              description: 'Bank reconciliation',
              lastUpdated: '2025-01-07'
            },
            {
              name: 'calculate_daily_takings(practice_id, date)',
              description: 'Daily summaries',
              lastUpdated: '2024-12-15'
            }
          ]
        },
        {
          name: 'batch_headers',
          purpose: 'Medical aid batch submissions',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'submitted_at'],
          references: ['practices', 'medical_aid_providers'],
          referencedBy: ['batch_items'],
          dbFunctions: [
            {
              name: 'generate_batch_file(batch_id)',
              description: 'Creates submission files',
              lastUpdated: '2024-12-28'
            },
            {
              name: 'validate_batch_items(batch_id)',
              description: 'Pre-submission checks',
              lastUpdated: '2024-11-25'
            }
          ],
          edgeFunctions: [
            {
              name: 'medical-aid-submission',
              description: 'Submits to aid providers',
              lastUpdated: '2025-01-05'
            },
            {
              name: 'batch-status-tracker',
              description: 'Monitors submission status',
              lastUpdated: '2024-12-10'
            }
          ]
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
          purpose: 'Comprehensive practice management with multi-tenant configuration, subscription management, and customization features',
          keyRelations: ['admin_user_id → users.id', 'practice_type_id → practice_types.id'],
          timestamps: ['created_at', 'updated_at', 'subscription_expires_at', 'gmail_connected_at'],
          references: ['users', 'practice_types'],
          referencedBy: ['branches', 'users', 'practice_tariffs', 'patients', 'visits', 'invoices_enhanced', 'practice_sms_logs'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for practice record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'uuid_generate_v4()',
              constraints: ['PRIMARY KEY', 'NOT NULL'],
              detailedDescription: 'Unique identifier for each practice in the multi-tenant system'
            },
            {
              name: 'slug',
              dataType: 'VARCHAR(50)',
              description: 'URL-friendly practice identifier',
              required: true,
              example: 'windhoek-medical',
              constraints: ['NOT NULL', 'UNIQUE'],
              detailedDescription: 'Used in URLs and subdomain routing for practice identification'
            },
            {
              name: 'name',
              dataType: 'VARCHAR(255)',
              description: 'Official practice name',
              required: true,
              example: 'Windhoek Medical Centre',
              constraints: ['NOT NULL'],
              detailedDescription: 'Full legal name of the medical practice'
            },
            {
              name: 'domain',
              dataType: 'VARCHAR(255)',
              description: 'Custom domain for practice website',
              example: 'windhoekmedical.com.na',
              detailedDescription: 'Custom domain pointing to practice landing page'
            },
            {
              name: 'logo_url',
              dataType: 'TEXT',
              description: 'Practice logo image URL',
              example: 'https://storage.supabase.co/practice-logos/logo.png',
              detailedDescription: 'URL to practice logo for branding across system'
            },
            {
              name: 'primary_color',
              dataType: 'VARCHAR(7)',
              description: 'Primary brand color',
              defaultValue: '#01b9d5',
              example: '#01b9d5',
              constraints: ['hex color format'],
              detailedDescription: 'Primary color for practice branding and UI customization'
            },
            {
              name: 'secondary_color',
              dataType: 'VARCHAR(7)',
              description: 'Secondary brand color',
              defaultValue: '#0196be',
              example: '#0196be',
              constraints: ['hex color format'],
              detailedDescription: 'Secondary color for practice branding and UI accents'
            },
            {
              name: 'contact_email',
              dataType: 'VARCHAR(255)',
              description: 'Main practice email address',
              example: 'info@windhoekmedical.com.na',
              detailedDescription: 'Primary email for practice communications and contact'
            },
            {
              name: 'contact_phone',
              dataType: 'VARCHAR(50)',
              description: 'Main practice phone number',
              example: '+264-61-123456',
              detailedDescription: 'Primary phone number for patient contact and appointments'
            },
            {
              name: 'address',
              dataType: 'TEXT',
              description: 'Physical practice address',
              example: '123 Independence Avenue, Windhoek',
              detailedDescription: 'Full physical address for practice location'
            },
            {
              name: 'city',
              dataType: 'VARCHAR(100)',
              description: 'Practice city',
              example: 'Windhoek',
              detailedDescription: 'City where practice is located'
            },
            {
              name: 'country',
              dataType: 'VARCHAR(100)',
              description: 'Practice country',
              defaultValue: 'Namibia',
              example: 'Namibia',
              detailedDescription: 'Country where practice operates'
            },
            {
              name: 'postal_code',
              dataType: 'VARCHAR(20)',
              description: 'Postal/ZIP code',
              example: '9000',
              detailedDescription: 'Postal code for practice address'
            },
            {
              name: 'business_hours',
              dataType: 'JSONB',
              description: 'Operating hours configuration',
              defaultValue: '{"monday": {"open": "08:00", "close": "17:00"}, "saturday": {"open": "08:00", "close": "13:00"}, "sunday": {"closed": true}}',
              detailedDescription: 'Structured business hours for each day of the week'
            },
            {
              name: 'features',
              dataType: 'JSONB',
              description: 'Enabled practice features',
              defaultValue: '{"lab_results": true, "online_booking": true, "online_payments": true, "telemedicine": false}',
              detailedDescription: 'Feature flags controlling practice functionality'
            },
            {
              name: 'settings',
              dataType: 'JSONB',
              description: 'Custom practice settings',
              defaultValue: '{}',
              detailedDescription: 'Flexible storage for practice-specific configuration'
            },
            {
              name: 'practice_type',
              dataType: 'TEXT',
              description: 'Type of medical practice',
              defaultValue: 'general',
              example: 'specialist',
              constraints: ['CHECK (practice_type IN (\'general\', \'specialist\', \'dental\', \'clinic\', \'hospital\'))'],
              detailedDescription: 'Classification of practice type for specialized features'
            },
            {
              name: 'practice_subtypes',
              dataType: 'ARRAY',
              description: 'Practice specialization areas',
              defaultValue: 'ARRAY[\'General Practice\']',
              example: 'ARRAY[\'Cardiology\', \'Internal Medicine\']',
              detailedDescription: 'Array of specializations for multi-discipline practices'
            },
            {
              name: 'status',
              dataType: 'VARCHAR(20)',
              description: 'Practice operational status',
              defaultValue: 'active',
              example: 'active',
              constraints: ['CHECK (status IN (\'active\', \'inactive\', \'suspended\', \'trial\'))'],
              detailedDescription: 'Current status affecting practice access and functionality'
            },
            {
              name: 'subscription_tier',
              dataType: 'VARCHAR(20)',
              description: 'Subscription plan level',
              defaultValue: 'standard',
              example: 'premium',
              constraints: ['CHECK (subscription_tier IN (\'trial\', \'basic\', \'standard\', \'premium\', \'enterprise\'))'],
              detailedDescription: 'Subscription tier determining available features and limits'
            },
            {
              name: 'subscription_expires_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Subscription expiration date',
              example: '2025-12-31 23:59:59+00',
              detailedDescription: 'When current subscription expires (null for lifetime)'
            },
            {
              name: 'max_users',
              dataType: 'INTEGER',
              description: 'Maximum allowed users',
              defaultValue: '10',
              example: '25',
              detailedDescription: 'Maximum number of staff users for this practice'
            },
            {
              name: 'max_patients',
              dataType: 'INTEGER',
              description: 'Maximum allowed patients',
              defaultValue: '1000',
              example: '5000',
              detailedDescription: 'Maximum number of patients that can be registered'
            },
            {
              name: 'timezone',
              dataType: 'VARCHAR(50)',
              description: 'Practice timezone',
              defaultValue: 'Africa/Windhoek',
              example: 'Africa/Windhoek',
              detailedDescription: 'Timezone for scheduling and time-based features'
            },
            {
              name: 'currency',
              dataType: 'VARCHAR(3)',
              description: 'Practice currency code',
              defaultValue: 'NAD',
              example: 'NAD',
              constraints: ['ISO 4217 currency code'],
              detailedDescription: 'Currency used for billing and financial transactions'
            },
            {
              name: 'tax_number',
              dataType: 'VARCHAR(50)',
              description: 'Practice tax/VAT number',
              example: '1234567890',
              detailedDescription: 'Official tax registration number for invoicing'
            },
            {
              name: 'license_number',
              dataType: 'VARCHAR(50)',
              description: 'Medical practice license number',
              example: 'MP-NAM-12345',
              detailedDescription: 'Official medical practice license from health authorities'
            },
            {
              name: 'practice_number',
              dataType: 'TEXT',
              description: 'HPCSA or regulatory practice number',
              example: 'HPCSA-GP-67890',
              detailedDescription: 'Professional registration number from medical council'
            },
            {
              name: 'admin_user_id',
              dataType: 'UUID',
              description: 'Primary administrator user',
              isForeignKey: true,
              references: 'users.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'User who has full administrative access to practice'
            },
            {
              name: 'sms_limit',
              dataType: 'INTEGER',
              description: 'Monthly SMS limit',
              defaultValue: '0',
              example: '1000',
              detailedDescription: 'Maximum SMS messages allowed per month'
            },
            {
              name: 'sms_used',
              dataType: 'INTEGER',
              description: 'SMS messages used this month',
              defaultValue: '0',
              example: '245',
              detailedDescription: 'Count of SMS messages sent in current billing period'
            },
            {
              name: 'bank_name',
              dataType: 'TEXT',
              description: 'Practice bank name',
              example: 'First National Bank Namibia',
              detailedDescription: 'Bank where practice accounts are held'
            },
            {
              name: 'account_holder_name',
              dataType: 'TEXT',
              description: 'Bank account holder name',
              example: 'Windhoek Medical Centre (Pty) Ltd',
              detailedDescription: 'Official name on bank account'
            },
            {
              name: 'account_number',
              dataType: 'TEXT',
              description: 'Bank account number',
              example: '1234567890',
              detailedDescription: 'Practice bank account number for payments'
            },
            {
              name: 'branch_code',
              dataType: 'TEXT',
              description: 'Bank branch code',
              example: '281234',
              detailedDescription: 'Bank branch code for transfers'
            },
            {
              name: 'swift_code',
              dataType: 'TEXT',
              description: 'International SWIFT code',
              example: 'FIRNNANX',
              detailedDescription: 'SWIFT code for international transfers'
            },
            {
              name: 'account_type',
              dataType: 'TEXT',
              description: 'Type of bank account',
              example: 'Business Current Account',
              detailedDescription: 'Classification of bank account type'
            },
            {
              name: 'is_follow_up_automation_enabled',
              dataType: 'BOOLEAN',
              description: 'Enable automated follow-ups',
              defaultValue: 'false',
              detailedDescription: 'Whether practice has enabled automated patient follow-up workflows'
            },
            {
              name: 'theme_id',
              dataType: 'VARCHAR(50)',
              description: 'UI theme identifier',
              defaultValue: 'sunset',
              example: 'medical-blue',
              detailedDescription: 'Theme configuration for practice UI customization'
            },
            {
              name: 'google_place_id',
              dataType: 'TEXT',
              description: 'Google Places ID',
              example: 'ChIJrTLr-GyuuB...',
              detailedDescription: 'Google Places ID for maps integration and reviews'
            },
            {
              name: 'google_review_url',
              dataType: 'TEXT',
              description: 'Google Reviews URL',
              example: 'https://g.page/r/windhoekmedical/review',
              detailedDescription: 'Direct URL for patients to leave Google reviews'
            },
            {
              name: 'gmail_settings',
              dataType: 'JSONB',
              description: 'Gmail integration configuration',
              defaultValue: '{}',
              detailedDescription: 'Settings for Gmail API integration and email automation'
            },
            {
              name: 'gmail_refresh_token',
              dataType: 'TEXT',
              description: 'Gmail OAuth refresh token',
              detailedDescription: 'Encrypted OAuth refresh token for Gmail integration'
            },
            {
              name: 'gmail_email',
              dataType: 'TEXT',
              description: 'Connected Gmail address',
              example: 'noreply@windhoekmedical.com.na',
              detailedDescription: 'Gmail address connected for sending emails'
            },
            {
              name: 'gmail_connected_at',
              dataType: 'TIMESTAMPTZ',
              description: 'When Gmail was connected',
              example: '2025-01-13 10:30:00+00',
              detailedDescription: 'Timestamp of Gmail integration connection'
            },
            {
              name: 'gmail_scopes',
              dataType: 'ARRAY',
              description: 'Gmail API scopes granted',
              example: 'ARRAY[\'send\', \'read\']',
              detailedDescription: 'OAuth scopes granted for Gmail integration'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Practice registration timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last update timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            }
          ],
          triggers: [
            {
              name: 'validate_practice_license',
              description: 'Checks license validity and expiration dates',
              lastUpdated: '2025-01-02'
            },
            {
              name: 'initialize_practice_settings',
              description: 'Sets up default configurations for new practices',
              lastUpdated: '2024-11-30'
            },
            {
              name: 'update_subscription_status',
              description: 'Monitors and updates subscription status automatically',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'encrypt_sensitive_data',
              description: 'Encrypts bank details and OAuth tokens',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'get_practice_statistics(practice_id)',
              description: 'Returns comprehensive practice metrics and KPIs',
              lastUpdated: '2024-12-22'
            },
            {
              name: 'check_subscription_status(practice_id)',
              description: 'Validates current subscription and feature access',
              lastUpdated: '2025-01-11'
            },
            {
              name: 'get_practice_limits(practice_id)',
              description: 'Returns current usage vs limits for users, patients, SMS',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'update_sms_usage(practice_id, count)',
              description: 'Updates SMS usage counter and checks limits',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'practice-onboarding',
              description: 'Handles new practice setup and configuration',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'subscription-manager',
              description: 'Manages subscription lifecycle and billing',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'gmail-oauth-handler',
              description: 'Handles Gmail OAuth flow and token management',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'branches',
          purpose: 'Multi-location branch management',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['practices'],
          referencedBy: ['users', 'visits', 'inventory'],
          triggers: [
            {
              name: 'validate_branch_details',
              description: 'Ensures required fields',
              lastUpdated: '2024-11-15'
            },
            {
              name: 'update_branch_coordinates',
              description: 'Geocodes addresses',
              lastUpdated: '2024-10-20'
            }
          ]
        },
        {
          name: 'users',
          purpose: 'Comprehensive user management with role-based access control, HR integration, and multi-branch support',
          keyRelations: ['practice_id → practices.id', 'branch_id → branches.id', 'reporting_manager_id → users.id'],
          timestamps: ['created_at', 'updated_at', 'last_login', 'last_active_at', 'start_date'],
          references: ['practices', 'branches', 'users (manager)'],
          referencedBy: ['visits', 'medical_records', 'audit_logs', 'patients', 'employee_salaries', 'timesheets'],
          fields: [
            {
              name: 'id',
              dataType: 'UUID',
              description: 'Primary key for user record',
              isPrimaryKey: true,
              required: true,
              defaultValue: 'uuid_generate_v4()',
              constraints: ['PRIMARY KEY', 'NOT NULL'],
              detailedDescription: 'Unique identifier for each user in the system'
            },
            {
              name: 'email',
              dataType: 'TEXT',
              description: 'User email address and login username',
              required: true,
              example: 'dr.smith@windhoekmedical.com.na',
              constraints: ['NOT NULL', 'UNIQUE'],
              detailedDescription: 'Primary email address used for authentication and communication'
            },
            {
              name: 'full_name',
              dataType: 'TEXT',
              description: 'Complete user display name',
              required: true,
              example: 'Dr. John Smith',
              constraints: ['NOT NULL'],
              detailedDescription: 'Full name including titles, used for display throughout system'
            },
            {
              name: 'role',
              dataType: 'TEXT',
              description: 'Primary system role',
              required: true,
              example: 'doctor',
              constraints: ['NOT NULL', 'CHECK (role IN (\'doctor\', \'nurse\', \'admin\', \'receptionist\', \'manager\', \'technician\'))'],
              detailedDescription: 'Primary role determining base permissions and system access'
            },
            {
              name: 'practice_id',
              dataType: 'UUID',
              description: 'Practice this user belongs to',
              isForeignKey: true,
              references: 'practices.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'Links user to specific practice for multi-tenant access control'
            },
            {
              name: 'branch_id',
              dataType: 'UUID',
              description: 'Primary branch assignment',
              isForeignKey: true,
              references: 'branches.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'User\'s primary branch location for scheduling and access'
            },
            {
              name: 'allowed_branches',
              dataType: 'ARRAY',
              description: 'Array of branch IDs user can access',
              defaultValue: '{}',
              example: 'ARRAY[branch1_uuid, branch2_uuid]',
              detailedDescription: 'Additional branches this user has access to beyond primary branch'
            },
            {
              name: 'is_super_admin',
              dataType: 'BOOLEAN',
              description: 'System-wide administrator flag',
              defaultValue: 'false',
              detailedDescription: 'Grants access to system administration and cross-practice features'
            },
            {
              name: 'can_manage_practices',
              dataType: 'BOOLEAN',
              description: 'Can manage multiple practices',
              defaultValue: 'false',
              detailedDescription: 'Allows user to manage multiple practices (for consultants/IT support)'
            },
            {
              name: 'permissions',
              dataType: 'JSONB',
              description: 'Granular permission settings',
              defaultValue: '{}',
              example: '{"patients": {"read": true, "write": true}, "financial": {"read": false}}',
              detailedDescription: 'Fine-grained permissions overriding role-based defaults'
            },
            {
              name: 'avatar',
              dataType: 'TEXT',
              description: 'User profile image URL',
              example: 'https://storage.supabase.co/avatars/user123.jpg',
              detailedDescription: 'URL to user\'s profile photo for display in UI'
            },
            {
              name: 'hpcsa_number',
              dataType: 'TEXT',
              description: 'Health Professional Council registration number',
              example: 'HPCSA-MP-123456',
              detailedDescription: 'Professional registration number for medical practitioners'
            },
            {
              name: 'job_title',
              dataType: 'TEXT',
              description: 'Official job title',
              example: 'Senior General Practitioner',
              detailedDescription: 'Formal job title for HR and organizational purposes'
            },
            {
              name: 'staff_title',
              dataType: 'TEXT',
              description: 'Professional title for patient-facing use',
              example: 'Dr.',
              detailedDescription: 'Title used in patient communications and appointments'
            },
            {
              name: 'department',
              dataType: 'TEXT',
              description: 'Department or specialization',
              example: 'General Practice',
              detailedDescription: 'Medical department or area of specialization'
            },
            {
              name: 'employee_number',
              dataType: 'TEXT',
              description: 'HR employee reference number',
              example: 'EMP-2025-001',
              detailedDescription: 'Unique employee number for HR and payroll systems'
            },
            {
              name: 'start_date',
              dataType: 'DATE',
              description: 'Employment start date',
              example: '2023-01-15',
              detailedDescription: 'Date when employee started working at the practice'
            },
            {
              name: 'reporting_manager_id',
              dataType: 'UUID',
              description: 'Direct manager/supervisor',
              isForeignKey: true,
              references: 'users.id',
              constraints: ['FOREIGN KEY'],
              detailedDescription: 'User ID of direct supervisor for organizational hierarchy'
            },
            {
              name: 'contact_number',
              dataType: 'TEXT',
              description: 'Personal contact phone number',
              example: '+264-81-1234567',
              detailedDescription: 'Personal phone number for emergency contact and communication'
            },
            {
              name: 'address',
              dataType: 'TEXT',
              description: 'Home address',
              example: '456 Hospital Street, Windhoek',
              detailedDescription: 'Personal home address for HR records'
            },
            {
              name: 'gender',
              dataType: 'TEXT',
              description: 'Gender identification',
              example: 'male',
              constraints: ['CHECK (gender IN (\'male\', \'female\', \'other\', \'prefer_not_to_say\'))'],
              detailedDescription: 'Gender information for HR and statistical purposes'
            },
            {
              name: 'is_active',
              dataType: 'BOOLEAN',
              description: 'Account active status',
              defaultValue: 'true',
              detailedDescription: 'Whether user account is active and can log in'
            },
            {
              name: 'bank_name',
              dataType: 'TEXT',
              description: 'Employee bank name',
              example: 'Standard Bank Namibia',
              detailedDescription: 'Bank name for salary payments'
            },
            {
              name: 'account_number',
              dataType: 'TEXT',
              description: 'Bank account number',
              example: '1234567890',
              detailedDescription: 'Bank account number for salary transfers'
            },
            {
              name: 'branch_code',
              dataType: 'TEXT',
              description: 'Bank branch code',
              example: '051234',
              detailedDescription: 'Bank branch code for salary transfers'
            },
            {
              name: 'swift_code',
              dataType: 'TEXT',
              description: 'Bank SWIFT code',
              example: 'SBNMNANX',
              detailedDescription: 'SWIFT code for international transfers if needed'
            },
            {
              name: 'account_type',
              dataType: 'TEXT',
              description: 'Type of bank account',
              example: 'Current Account',
              detailedDescription: 'Classification of bank account for salary payments'
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Account creation timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'updated_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last profile update timestamp',
              defaultValue: 'now()',
              constraints: ['NOT NULL']
            },
            {
              name: 'last_login',
              dataType: 'TIMESTAMPTZ',
              description: 'Last successful login timestamp',
              detailedDescription: 'When user last successfully authenticated'
            },
            {
              name: 'last_active_at',
              dataType: 'TIMESTAMPTZ',
              description: 'Last activity timestamp',
              detailedDescription: 'When user was last active in the system'
            }
          ],
          triggers: [
            {
              name: 'hash_user_password',
              description: 'Secures passwords using bcrypt hashing',
              lastUpdated: '2024-12-05'
            },
            {
              name: 'track_login_attempts',
              description: 'Monitors and logs security events',
              lastUpdated: '2024-11-10'
            },
            {
              name: 'update_last_login',
              description: 'Records access times and session data',
              lastUpdated: '2024-10-15'
            },
            {
              name: 'validate_role_permissions',
              description: 'Ensures role-permission consistency',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'audit_user_changes',
              description: 'Logs all changes to user records',
              lastUpdated: '2025-01-13'
            }
          ],
          dbFunctions: [
            {
              name: 'authenticate_user(email, password)',
              description: 'Handles user authentication and session creation',
              lastUpdated: '2025-01-09'
            },
            {
              name: 'check_user_permissions(user_id, resource)',
              description: 'Validates user access to specific resources',
              lastUpdated: '2024-12-18'
            },
            {
              name: 'get_user_hierarchy(user_id)',
              description: 'Returns organizational hierarchy for user',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'update_user_activity(user_id)',
              description: 'Updates last activity timestamp',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'get_practice_staff(practice_id)',
              description: 'Returns all staff members for practice with roles',
              lastUpdated: '2025-01-13'
            }
          ],
          edgeFunctions: [
            {
              name: 'user-authentication',
              description: 'Handles login, logout, and session management',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'user-profile-manager',
              description: 'Manages user profile updates and avatar uploads',
              lastUpdated: '2025-01-13'
            },
            {
              name: 'role-permission-manager',
              description: 'Manages role assignments and permission changes',
              lastUpdated: '2025-01-13'
            }
          ]
        },
        {
          name: 'practice_tariffs',
          purpose: 'Medical billing codes and pricing structure',
          keyRelations: ['practice_id → practices.id'],
              name: 'get_user_activity_log(user_id)',
              description: 'Audit trail',
              lastUpdated: '2024-11-22'
            }
          ],
          edgeFunctions: [
            {
              name: 'password-reset',
              description: 'Handles password recovery',
              lastUpdated: '2024-12-30'
            },
            {
              name: 'two-factor-auth',
              description: 'Manages 2FA',
              lastUpdated: '2025-01-06'
            },
            {
              name: 'session-manager',
              description: 'Controls user sessions',
              lastUpdated: '2024-11-28'
            }
          ]
        },
        {
          name: 'practice_tariffs',
          purpose: 'Service pricing and tariffs',
          keyRelations: ['practice_id → practices.id'],
          timestamps: ['created_at', 'updated_at'],
          references: ['practices'],
          referencedBy: ['invoice_services'],
          triggers: [
            {
              name: 'audit_tariff_changes',
              description: 'Logs price modifications',
              lastUpdated: '2024-12-15'
            },
            {
              name: 'validate_tariff_codes',
              description: 'Ensures unique codes',
              lastUpdated: '2024-11-05'
            }
          ],
          dbFunctions: [
            {
              name: 'get_tariff_price(practice_id, code, date)',
              description: 'Returns applicable price',
              lastUpdated: '2025-01-04'
            },
            {
              name: 'bulk_update_tariffs(practice_id, percentage)',
              description: 'Mass price updates',
              lastUpdated: '2024-12-20'
            }
          ]
        }
      ]
    }
  ]

  // Search filter function
  const filterBySearch = (item: any, query: string): boolean => {
    if (!query) return true
    const lowerQuery = query.toLowerCase()
    
    // Search in table names
    if (item.name && item.name.toLowerCase().includes(lowerQuery)) return true
    
    // Search in fields
    if (item.fields) {
      return item.fields.some((field: TableField) => 
        field.name.toLowerCase().includes(lowerQuery) ||
        field.description.toLowerCase().includes(lowerQuery) ||
        field.dataType.toLowerCase().includes(lowerQuery)
      )
    }
    
    // Search in triggers
    if (item.triggers) {
      return item.triggers.some((trigger: any) => 
        trigger.name.toLowerCase().includes(lowerQuery) ||
        trigger.description.toLowerCase().includes(lowerQuery)
      )
    }
    
    // Search in functions
    if (item.dbFunctions) {
      return item.dbFunctions.some((func: any) => 
        func.name.toLowerCase().includes(lowerQuery) ||
        func.description.toLowerCase().includes(lowerQuery)
      )
    }
    
    // Search in edge functions
    if (item.edgeFunctions) {
      return item.edgeFunctions.some((func: any) => 
        func.name.toLowerCase().includes(lowerQuery) ||
        func.description.toLowerCase().includes(lowerQuery)
      )
    }
    
    // Search in forms
    if (item.forms) {
      return item.forms.some((form: any) => 
        form.name.toLowerCase().includes(lowerQuery) ||
        form.description.toLowerCase().includes(lowerQuery)
      )
    }
    
    return false
  }

  // Filter sections based on search
  const filteredSections = sections.map(section => ({
    ...section,
    tables: section.tables.filter(table => filterBySearch(table, searchQuery))
  })).filter(section => section.tables.length > 0 || section.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const rootClassName = `min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ${rubik.className}`
  
  return (
    <div className={rootClassName}>
      <div className="w-full">
        {/* Header with Search */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-8 text-white shadow-2xl">
          <div className="max-w-full mx-auto">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg">
                  <Icon icon="solar:blueprint-bold-duotone" className="w-12 h-12" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">OneHealth System Blueprint</h1>
                  <p className="text-white/80 mt-1 flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-white/30">Version 5.0</Badge>
                    <span className="text-sm">Last Updated: 2025-07-11 12:00:00 UTC</span>
                  </p>
                </div>
              </div>
              
              {/* Search Bar */}
              <div className="w-full lg:w-96">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search tables, fields, triggers, functions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-3 bg-white/20 border-white/30 text-white placeholder-white/60 focus:bg-white/30 focus:border-white/50 backdrop-blur-md"
                  />
                </div>
              </div>
            </div>
            
            <p className="text-white/90 leading-relaxed text-lg mt-6">
              This is the master blueprint for the OneHealth system. It serves as a living document for system architecture, 
              workflows, and components, ensuring traceability and efficient development.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">

          {/* Search Results */}
          {searchQuery && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Found {filteredSections.reduce((acc, section) => acc + section.tables.length, 0)} results for "{searchQuery}"
              </p>
            </div>
          )}

          {/* Section Tabs */}
          <div className="flex flex-wrap gap-3 mb-8">
            {sections.map((section) => {
              const isActive = expandedSection === section.id
              const isFiltered = filteredSections.some(s => s.id === section.id)
              
              return (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  disabled={!isFiltered}
                  className={`
                    group relative flex items-center gap-3 px-5 py-2.5 rounded-full transition-all duration-200
                    ${isActive 
                      ? 'bg-gray-900 text-white shadow-lg' 
                      : isFiltered
                        ? 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400 hover:shadow-md'
                        : 'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'
                    }
                  `}
                >
                  <div className={`
                    transition-all duration-200
                    ${isActive ? 'text-white' : `text-${section.color}-600`}
                  `}>
                    <Icon icon={section.icon} className="w-4 h-4" />
                  </div>
                  <span className={`font-medium text-sm ${montserrat.className}`}>
                    {section.title}
                  </span>
                  <span className={`
                    text-xs font-medium transition-colors duration-200
                    ${isActive ? 'text-gray-300' : 'text-gray-500'}
                  `}>
                    {section.tables.length}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filtered Sections Content */}
          <div className="space-y-4 mt-6">
            {filteredSections.map((section) => (
              <AnimatePresence key={section.id} mode="wait">
                {expandedSection === section.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-6">
                        <p className="text-gray-600 mb-6 text-lg leading-relaxed">{section.description}</p>

                        {/* Tables Overview */}
                        <div className="bg-gradient-to-br from-gray-50/50 to-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                          <h3 className={`font-bold text-gray-900 mb-5 flex items-center gap-3 text-lg ${rubik.className}`}>
                            <div className="p-2 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg shadow-sm">
                              <Icon icon="solar:database-bold-duotone" className="w-5 h-5 text-white" />
                            </div>
                            Database Tables
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {section.tables.length} tables
                            </Badge>
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-gray-600 border-b border-gray-200">
                                  <th className="pb-3 pr-4 font-semibold">ID</th>
                                  <th className="pb-3 pr-4 font-semibold">Table Name</th>
                                  <th className="pb-3 pr-4 font-semibold">Purpose</th>
                                  <th className="pb-3 font-semibold text-right">Last Updated</th>
                                </tr>
                              </thead>
                              <tbody className="text-sm">
                                {section.tables.map((table) => {
                                  // Get the most recent update date from all related items
                                  const getLastUpdated = () => {
                                    const dates = []
                                    if (table.triggers) dates.push(...table.triggers.map(t => t.lastUpdated))
                                    if (table.dbFunctions) dates.push(...table.dbFunctions.map(f => f.lastUpdated))
                                    if (table.edgeFunctions) dates.push(...table.edgeFunctions.map(f => f.lastUpdated))
                                    if (table.forms) dates.push(...table.forms.map(f => f.lastUpdated))
                                    
                                    if (dates.length === 0) return '2025-01-10'
                                    
                                    // Sort dates and return the most recent
                                    return dates.sort((a, b) => b.localeCompare(a))[0]
                                  }
                                  
                                  return (
                                    <tr key={table.name} className="border-t border-gray-100 hover:bg-gray-50 transition-colors group">
                                      <td className="py-4 pr-4">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold ${montserrat.className}`}>
                                          {tableNumbering[table.name] || 'T'}
                                        </span>
                                      </td>
                                      <td className="py-4 pr-4">
                                        <button
                                          onClick={() => toggleTable(table.name)}
                                          className={`font-bold text-gray-900 hover:text-blue-600 flex items-center gap-2 group transition-colors ${rubik.className}`}
                                        >
                                          {table.name}
                                          {table.fields && (
                                            <Icon icon="solar:eye-bold-duotone" className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" />
                                          )}
                                        </button>
                                      </td>
                                      <td className="py-4 pr-4 text-gray-600 text-sm">{table.purpose}</td>
                                      <td className="py-4 text-right">
                                        <span className={`text-xs text-gray-500 ${montserrat.className}`}>
                                          {getLastUpdated()}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Expanded Table Details */}
                        <AnimatePresence>
                          {expandedTable && (() => {
                            const currentTable = section.tables.find(t => t.name === expandedTable)
                            if (!currentTable) return null

                            return (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg"
                              >
                                <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-3 text-xl">
                                  <Icon icon="solar:database-bold-duotone" className="w-6 h-6 text-blue-600" />
                                  <span>Table Details:</span>
                                  <code className="bg-white px-3 py-1 rounded-lg shadow-sm">{expandedTable}</code>
                                  <Badge variant="outline" className="ml-auto">{tableNumbering[expandedTable] || ''}</Badge>
                                </h4>

                                {/* Table Relationships Diagram - Collapsible */}
                                {(currentTable.referencedBy || currentTable.references) && (
                                  <CollapsibleSection
                                    title="Table Relationships"
                                    itemCount={(currentTable.referencedBy?.length || 0) + (currentTable.references?.length || 0)}
                                    isExpanded={expandedSubsections[`${expandedTable}-relationships`] || false}
                                    onToggle={() => toggleSubsection(`${expandedTable}-relationships`)}
                                    className="mb-4"
                                    icon={<Icon icon="solar:diagram-up-bold-duotone" className="w-5 h-5" />}
                                  >
                                    <TableRelationshipDiagram
                                      currentTable={expandedTable}
                                      referencedBy={currentTable.referencedBy}
                                      references={currentTable.references}
                                      keyRelations={currentTable.keyRelations}
                                      getTableColor={getTableColor}
                                      sections={sections}
                                      setExpandedSection={setExpandedSection}
                                      setExpandedTable={setExpandedTable}
                                      setExpandedSubsections={setExpandedSubsections}
                                    />
                                  </CollapsibleSection>
                                )}

                                {/* Active Triggers */}
                                {currentTable.triggers && currentTable.triggers.length > 0 && (
                                  <CollapsibleSection
                                    title="Active Triggers"
                                    itemCount={currentTable.triggers.length}
                                    isExpanded={expandedSubsections[`${expandedTable}-triggers`] || false}
                                    onToggle={() => toggleSubsection(`${expandedTable}-triggers`)}
                                    className="mb-4"
                                    icon={<Icon icon="solar:bolt-bold-duotone" className="w-5 h-5" />}
                                    lastUpdated={currentTable.triggers[0].lastUpdated}
                                  >
                                    <div className="bg-green-50 rounded-lg p-4 mt-3">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Function Name & Description</span>
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Updated</span>
                                      </div>
                                      {currentTable.triggers.map((trigger, idx) => (
                                        <div key={idx} className="text-sm text-green-700 flex items-start justify-between gap-4 mb-3">
                                          <div className="flex items-start gap-2 flex-1">
                                            <Icon icon="solar:bolt-circle-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                              <code className={`font-semibold ${montserrat.className}`}>{trigger.name}</code>
                                              <span className="mx-2">-</span>
                                              <span>{trigger.description}</span>
                                            </div>
                                          </div>
                                          <span className={`text-xs text-gray-500 flex-shrink-0 ${montserrat.className}`}>
                                            {trigger.lastUpdated}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleSection>
                                )}

                                {/* Database Functions */}
                                {currentTable.dbFunctions && currentTable.dbFunctions.length > 0 && (
                                  <CollapsibleSection
                                    title="Database Functions"
                                    itemCount={currentTable.dbFunctions.length}
                                    isExpanded={expandedSubsections[`${expandedTable}-dbFunctions`] || false}
                                    onToggle={() => toggleSubsection(`${expandedTable}-dbFunctions`)}
                                    className="mb-4"
                                    icon={<Icon icon="solar:code-square-bold-duotone" className="w-5 h-5" />}
                                    lastUpdated={currentTable.dbFunctions[0].lastUpdated}
                                  >
                                    <div className="bg-purple-50 rounded-lg p-4 mt-3">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Function Name & Description</span>
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Updated</span>
                                      </div>
                                      {currentTable.dbFunctions.map((func, idx) => (
                                        <div key={idx} className="text-sm text-purple-700 flex items-start justify-between gap-4 mb-3">
                                          <div className="flex items-start gap-2 flex-1">
                                            <Icon icon="solar:function-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                              <code className={`font-semibold ${montserrat.className}`}>{func.name}</code>
                                              <span className="mx-2">-</span>
                                              <span>{func.description}</span>
                                            </div>
                                          </div>
                                          <span className={`text-xs text-gray-500 flex-shrink-0 ${montserrat.className}`}>
                                            {func.lastUpdated}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleSection>
                                )}

                                {/* Edge Functions */}
                                {currentTable.edgeFunctions && currentTable.edgeFunctions.length > 0 && (
                                  <CollapsibleSection
                                    title="Edge Functions"
                                    itemCount={currentTable.edgeFunctions.length}
                                    isExpanded={expandedSubsections[`${expandedTable}-edgeFunctions`] || false}
                                    onToggle={() => toggleSubsection(`${expandedTable}-edgeFunctions`)}
                                    className="mb-4"
                                    icon={<Icon icon="solar:cloud-bolt-bold-duotone" className="w-5 h-5" />}
                                    lastUpdated={currentTable.edgeFunctions[0].lastUpdated}
                                  >
                                    <div className="bg-red-50 rounded-lg p-4 mt-3">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Function Name & Description</span>
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Updated</span>
                                      </div>
                                      {currentTable.edgeFunctions.map((func, idx) => (
                                        <div key={idx} className="text-sm text-red-700 flex items-start justify-between gap-4 mb-3">
                                          <div className="flex items-start gap-2 flex-1">
                                            <Icon icon="solar:cloud-check-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                              <code className={`font-semibold ${montserrat.className}`}>{func.name}</code>
                                              <span className="mx-2">-</span>
                                              <span>{func.description}</span>
                                            </div>
                                          </div>
                                          <span className={`text-xs text-gray-500 flex-shrink-0 ${montserrat.className}`}>
                                            {func.lastUpdated}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleSection>
                                )}

                                {/* Forms and Their Data Journeys */}
                                {currentTable.forms && currentTable.forms.length > 0 && (
                                  <CollapsibleSection
                                    title="Forms & Data Journeys"
                                    itemCount={currentTable.forms.length}
                                    isExpanded={expandedSubsections[`${expandedTable}-forms`] || false}
                                    onToggle={() => toggleSubsection(`${expandedTable}-forms`)}
                                    className="mb-4"
                                    icon={<Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />}
                                    lastUpdated={currentTable.forms[0].lastUpdated}
                                  >
                                    <div className="space-y-3 mt-3">
                                      {currentTable.forms.map((form, idx) => {
                                        // Find the workflow for this form
                                        const workflow = currentTable.formWorkflows?.find(w => w.formName === form.name)
                                        
                                        return (
                                          <div key={idx} className="bg-purple-50 rounded-lg overflow-hidden">
                                            <div className="p-4">
                                              <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-2 flex-1">
                                                  <Icon icon="solar:document-add-bold-duotone" className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-600" />
                                                  <div>
                                                    <div className="flex items-center gap-2">
                                                      <code className={`font-semibold text-purple-700 ${montserrat.className}`}>{form.name}</code>
                                                      <span className="text-gray-700 text-sm">{form.description}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                                <span className={`text-xs text-gray-500 flex-shrink-0 ${montserrat.className}`}>
                                                  {form.lastUpdated}
                                                </span>
                                              </div>
                                              
                                              {/* Journey for this form */}
                                              {workflow && (
                                                <CollapsibleSection
                                                  title="Data Journey"
                                                  isExpanded={expandedSubsections[`${expandedTable}-form-journey-${idx}`] || false}
                                                  onToggle={() => toggleSubsection(`${expandedTable}-form-journey-${idx}`)}
                                                  className="mt-3 bg-white"
                                                  icon={<Icon icon="solar:routing-2-bold-duotone" className="w-4 h-4" />}
                                                >
                                                  <DataJourneyVisualization workflow={workflow} />
                                                </CollapsibleSection>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </CollapsibleSection>
                                )}

                                {/* Table Data Dictionary - Not Collapsible */}
                                {currentTable.fields && (
                                  <div className="mb-6">
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-gray-700" />
                                            <h4 className={`text-lg font-bold text-gray-900 ${rubik.className}`}>Data Dictionary</h4>
                                          </div>
                                          <Badge variant="secondary" className="text-sm">
                                            {currentTable.fields.length} fields
                                          </Badge>
                                        </div>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead className="bg-gray-50">
                                            <tr className="text-left text-sm text-gray-600">
                                              <th className="p-3 font-semibold">#</th>
                                              <th className="p-3 font-semibold">Field Name</th>
                                              <th className="p-3 font-semibold">Data Type</th>
                                              <th className="p-3 font-semibold">Description</th>
                                              <th className="p-3 font-semibold">Example</th>
                                              <th className="p-3 font-semibold text-right">Last Updated</th>
                                            </tr>
                                          </thead>
                                          <tbody className="text-sm">
                                            {currentTable.fields.map((field, index) => (
                                            <tr key={field.name} className="border-t border-gray-100 hover:bg-gray-50 group">
                                              <td className="p-3 align-top">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                                                  {index + 1}
                                                </span>
                                              </td>
                                              <td className="p-3 align-top">
                                                <div className="flex items-start gap-2">
                                                  <div>
                                                    <span className={`font-semibold ${rubik.className}`}>
                                                      {field.name}
                                                      {field.required && <span className="text-red-500 ml-1">*</span>}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-1 flex-shrink-0">
                                                    {field.isPrimaryKey && (
                                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 font-medium">
                                                        <Icon icon="solar:key-bold" className="w-3 h-3" />
                                                        PK
                                                      </span>
                                                    )}
                                                    {field.isForeignKey && field.references && (
                                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">
                                                        <Icon icon="solar:link-bold" className="w-3 h-3" />
                                                        FK → {field.references}
                                                      </span>
                                                    )}
                                                    {field.isUnique && (
                                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-medium">
                                                        <Icon icon="solar:shield-keyhole-bold" className="w-3 h-3" />
                                                        Unique
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="p-3 align-top">
                                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 font-medium">
                                                  {field.dataType}
                                                </span>
                                              </td>
                                              <td className="p-3 align-top">
                                                <p className="text-gray-700 font-medium">{field.description}</p>
                                                {field.detailedDescription && (
                                                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{field.detailedDescription}</p>
                                                )}
                                                {field.constraints && (
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {field.constraints.map((constraint, idx) => (
                                                      <span key={idx} className="inline-block px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-600 font-medium">
                                                        {constraint}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="p-3 align-top">
                                                {field.example && (
                                                  <code className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 font-mono">
                                                    {field.example}
                                                  </code>
                                                )}
                                              </td>
                                              <td className="p-3 align-top text-gray-500 text-xs text-right">
                                                {['created_at', 'updated_at'].includes(field.name) ? (
                                                  <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-medium">Auto</span>
                                                ) : (
                                                  '2025-07-11'
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="mt-6 text-xs text-gray-500 flex items-center gap-2">
                                  <Icon icon="solar:info-circle-linear" className="w-4 h-4" />
                                  <span className="text-red-500">*</span> Required fields
                                </div>
                              </motion.div>
                            )
                          })()}
                        </AnimatePresence>
                      </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>

          {/* Blueprint Documentation Note */}
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <Icon icon="solar:info-square-bold-duotone" className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className={`text-lg font-bold text-gray-900 mb-3 ${rubik.className}`}>
                    How Table Definitions Are Structured
                  </h3>
                  <div className={`text-sm text-gray-700 space-y-3 ${montserrat.className}`}>
                    <p>
                      Each table definition in this blueprint follows a comprehensive format that captures the complete lifecycle 
                      and ecosystem of data management. Using the <strong>patients</strong> table as an example, here's how each 
                      component contributes to the full definition:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">●</span>
                          <div>
                            <strong>Table Relationships</strong> - Shows data connectivity through incoming references 
                            (9 tables point to patients) and outgoing references (2 foreign keys). Each table name is 
                            <span className="text-blue-600 underline">clickable</span> and navigates directly to that table's 
                            section, automatically expanding it for immediate viewing.
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-purple-600">●</span>
                          <div>
                            <strong>Active Triggers (6 items)</strong> - Automated database behaviors that fire on 
                            insert/update/delete operations, handling tasks like reference number generation, audit 
                            logging, and automation queueing.
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600">●</span>
                          <div>
                            <strong>Database Functions (6 items)</strong> - Server-side PostgreSQL functions for 
                            complex operations like patient search, activity tracking, and data aggregation that 
                            run directly in the database.
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="text-red-600">●</span>
                          <div>
                            <strong>Edge Functions (5 items)</strong> - Serverless functions running on Supabase Edge 
                            Runtime for AI-powered search, SMS/email gateways, and automation processing that extend 
                            beyond database capabilities.
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-amber-600">●</span>
                          <div>
                            <strong>Forms & Data Journeys (4 forms)</strong> - Interactive components with detailed 
                            step-by-step workflows showing how users interact with data, from form fields through 
                            validation to database storage.
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-indigo-600">●</span>
                          <div>
                            <strong>Data Dictionary</strong> - Complete field-level documentation with data types, 
                            constraints, validation rules, examples, and detailed descriptions for every column 
                            in the table.
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm mb-3">
                        <strong>Format Standard:</strong> This comprehensive structure (Relationships → Triggers → Functions → 
                        Edge Functions → Forms/Journeys → Data Dictionary) is the standard format for all tables in the system. 
                        Each section is collapsible to manage complexity while maintaining complete documentation. The "Last Updated" 
                        dates track when table definitions or their components were modified, ensuring version control and change tracking.
                      </p>
                      
                      <div className="border-t pt-3">
                        <p className="text-sm font-semibold mb-2">Interactive Features:</p>
                        <ul className="text-sm space-y-1">
                          <li>• <strong>Clickable Table Names:</strong> In relationships, click any table name to navigate directly to it</li>
                          <li>• <strong>Auto-Navigation:</strong> Clicking expands the target section and table automatically</li>
                          <li>• <strong>Color-Coded Tables:</strong> Each table has a unique color dot for visual identification</li>
                          <li>• <strong>Collapsible Sections:</strong> All sections can expand/collapse to manage information density</li>
                          <li>• <strong>Search Functionality:</strong> Use the top search bar to filter tables and components</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-amber-900 mb-2">Confirmation Requirements:</p>
                          <ul className="space-y-1 text-amber-800">
                            <li>• <strong>Triggers & Functions</strong> must be verified against actual database using MCP tools</li>
                            <li>• <strong>Edge Functions</strong> must exist in /supabase/functions directory</li>
                            <li>• <strong>Table Fields</strong> must match exact database schema (data types, constraints)</li>
                            <li>• <strong>Form Workflows</strong> must be tested against actual UI components</li>
                            <li>• <strong>Relationships</strong> must reflect real foreign key constraints</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:palette-bold-duotone" className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-purple-900 mb-2">Style Guidelines:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-purple-800">
                            <div>
                              <strong>Typography:</strong>
                              <ul className="mt-1 space-y-0.5 text-xs">
                                <li>• Headers: Rubik Bold font</li>
                                <li>• Code/Technical: Montserrat font</li>
                                <li>• Dates: Right-aligned, Montserrat</li>
                                <li>• Table names: Bold, clickable</li>
                              </ul>
                            </div>
                            <div>
                              <strong>Visual Elements:</strong>
                              <ul className="mt-1 space-y-0.5 text-xs">
                                <li>• Icons: Solar Bold Duotone set</li>
                                <li>• Colors: Table-specific dots</li>
                                <li>• Sections: Collapsible with counts</li>
                                <li>• Spacing: Compact, professional</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-blue-900 mb-2">Timestamp Documentation Rules:</p>
                          <ul className="space-y-1 text-blue-800">
                            <li>• <strong>Last Updated Dates</strong> must be updated whenever any component is modified</li>
                            <li>• <strong>Table Overview</strong> shows the most recent update across all components</li>
                            <li>• <strong>Individual Components</strong> (triggers, functions, forms) have their own dates</li>
                            <li>• <strong>Format</strong>: YYYY-MM-DD (e.g., 2025-01-13)</li>
                            <li>• <strong>Documentation Changes</strong> require updating both component date and commit message</li>
                          </ul>
                          <div className="mt-2 p-2 bg-blue-100 rounded text-xs">
                            <strong>Example:</strong> When updating a trigger, change its lastUpdated from "2024-12-15" to today's date, 
                            and document the change in git commit message.
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 italic mt-3">
                      This living documentation auto-updates as the system evolves. All components must be verified against the actual 
                      database schema, triggers, functions, and UI components to ensure accuracy. Never document assumed functionality - 
                      always confirm with MCP tools and actual codebase.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center gap-3 text-sm text-gray-500">
              <Icon icon="solar:database-bold-duotone" className="w-5 h-5" />
              <span>OneHealth System Blueprint v5.0</span>
              <span className="text-gray-300">•</span>
              <span>Living Documentation</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1">
                <Icon icon="solar:refresh-circle-linear" className="w-4 h-4" />
                Auto-updated
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Use this reference for system architecture, database schema, and workflow documentation
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}