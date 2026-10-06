import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';

interface TableField {
  name: string;
  dataType: string;
  description: string;
  required?: boolean;
}

interface DatabaseTable {
  name: string;
  purpose: string;
  keyRelations: string[];
  timestamps: string[];
  fields?: TableField[];
  triggers?: string[];
}

interface Section {
  id: string;
  title: string;
  icon: string;
  lastUpdated: string;
  description: string;
  tables: DatabaseTable[];
  color: string;
  bgGradient: string;
}

const SystemBlueprint: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('patients');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

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
            { name: 'id', dataType: 'UUID', description: 'Primary key, unique identifier for the patient' },
            { name: 'system_patient_reference_number', dataType: 'TEXT', description: 'Auto-generated patient reference (e.g., P000001)' },
            { name: 'government_id_number', dataType: 'TEXT', description: 'National identification number' },
            { name: 'first_name', dataType: 'TEXT', description: 'Patient\'s first name', required: true },
            { name: 'middle_name', dataType: 'TEXT', description: 'Patient\'s middle name (optional)' },
            { name: 'last_name', dataType: 'TEXT', description: 'Patient\'s last name', required: true },
            { name: 'date_of_birth', dataType: 'DATE', description: 'Patient\'s birth date' },
            { name: 'gender', dataType: 'TEXT', description: 'Gender (male/female/other)' },
            { name: 'phone', dataType: 'TEXT', description: 'Primary contact number' },
            { name: 'email', dataType: 'TEXT', description: 'Email address' },
            { name: 'address', dataType: 'TEXT', description: 'Physical address' },
            { name: 'city', dataType: 'TEXT', description: 'City of residence' },
            { name: 'country', dataType: 'TEXT', description: 'Country (default: Namibia)' },
            { name: 'occupation', dataType: 'TEXT', description: 'Patient\'s occupation' },
            { name: 'emergency_contact_name', dataType: 'TEXT', description: 'Emergency contact person' },
            { name: 'emergency_contact_phone', dataType: 'TEXT', description: 'Emergency contact number' },
            { name: 'blood_type', dataType: 'TEXT', description: 'Blood type (A+, B+, O+, etc.)' },
            { name: 'allergies', dataType: 'TEXT', description: 'Known allergies' },
            { name: 'chronic_conditions', dataType: 'TEXT', description: 'Chronic medical conditions' },
            { name: 'practice_id', dataType: 'UUID', description: 'Associated practice ID' },
            { name: 'branch_id', dataType: 'UUID', description: 'Associated branch ID' },
            { name: 'created_at', dataType: 'TIMESTAMPTZ', description: 'Record creation timestamp' },
            { name: 'updated_at', dataType: 'TIMESTAMPTZ', description: 'Last update timestamp' },
            { name: 'created_by', dataType: 'UUID', description: 'User who created the record' },
            { name: 'updated_by', dataType: 'UUID', description: 'User who last updated the record' }
          ],
          triggers: [
            'assign_system_patient_reference_number_trigger - Auto-generates patient reference numbers',
            'update_patients_updated_at - Updates timestamp on record modification',
            'audit_patients_trigger - Creates audit trail for all changes'
          ]
        },
        {
          name: 'medical_aid_details',
          purpose: 'Insurance/medical aid information',
          keyRelations: ['patient_id → patients.id', 'medical_aid_id → medical_aid_providers.id'],
          timestamps: ['created_at', 'updated_at']
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
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
    setExpandedTable(null);
  };

  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white shadow-xl"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon icon="solar:blueprint-bold-duotone" className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">OneHealth System Blueprint</h1>
              <p className="text-white/80 mt-1">Version 5.0 • Last Updated: 2025-07-11 12:00:00 UTC</p>
            </div>
          </div>
          <p className="text-white/90 leading-relaxed">
            This is the master blueprint for the OneHealth system. It serves as a living document for system architecture, 
            workflows, and components, ensuring traceability and efficient development.
          </p>
        </motion.div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {sections.map((section, index) => (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => toggleSection(section.id)}
              className={`p-4 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 
                ${expandedSection === section.id ? 'ring-2 ring-offset-2 ring-' + section.color + '-500' : ''}`}
            >
              <Icon icon={section.icon} className={`w-8 h-8 text-${section.color}-500 mx-auto mb-2`} />
              <p className="text-sm font-medium text-gray-700">{section.title}</p>
            </motion.button>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-4">
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
                    <h2 className="text-xl font-semibold text-gray-800">{section.title}</h2>
                    <p className="text-sm text-gray-500">Last updated: {section.lastUpdated}</p>
                  </div>
                </div>
                <Icon
                  icon={expandedSection === section.id ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                  className="w-5 h-5 text-gray-400"
                />
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
                      <p className="text-gray-600 mb-6">{section.description}</p>

                      {/* Tables Overview */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Icon icon="solar:database-bold-duotone" className="w-5 h-5" />
                          Database Tables Overview
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="text-left text-sm text-gray-600">
                                <th className="pb-3 pr-4">Table Name</th>
                                <th className="pb-3 pr-4">Purpose</th>
                                <th className="pb-3 pr-4">Key Relations</th>
                                <th className="pb-3">Timestamps</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm">
                              {section.tables.map((table) => (
                                <tr key={table.name} className="border-t border-gray-200">
                                  <td className="py-3 pr-4">
                                    {/* Only tables with documented fields have a details panel to open */}
                                    {table.fields ? (
                                      <button
                                        onClick={() => toggleTable(table.name)}
                                        className="font-mono text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                        aria-expanded={expandedTable === table.name}
                                        title="Show fields"
                                      >
                                        {table.name}
                                        <Icon icon="solar:info-circle-bold" className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <span className="font-mono text-gray-700">{table.name}</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-gray-600">{table.purpose}</td>
                                  <td className="py-3 pr-4">
                                    {table.keyRelations.map((relation, idx) => (
                                      <div key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mb-1 inline-block mr-1">
                                        {relation}
                                      </div>
                                    ))}
                                  </td>
                                  <td className="py-3 text-gray-500 text-xs">
                                    {table.timestamps.map((ts) => (
                                      <div key={ts} className="font-mono">{ts}</div>
                                    ))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Expanded Table Details */}
                      <AnimatePresence>
                        {expandedTable && section.tables.find(t => t.name === expandedTable)?.fields && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 bg-blue-50 rounded-lg p-6"
                          >
                            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                              <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
                              Table: <code className="bg-white px-2 py-1 rounded">{expandedTable}</code>
                            </h4>
                            
                            {/* Fields Table */}
                            <div className="bg-white rounded-lg overflow-hidden mb-4">
                              <table className="w-full">
                                <thead className="bg-gray-100">
                                  <tr className="text-left text-sm text-gray-600">
                                    <th className="p-3">Field Name</th>
                                    <th className="p-3">Data Type</th>
                                    <th className="p-3">Description</th>
                                  </tr>
                                </thead>
                                <tbody className="text-sm">
                                  {section.tables.find(t => t.name === expandedTable)?.fields?.map((field) => (
                                    <tr key={field.name} className="border-t border-gray-100 hover:bg-gray-50">
                                      <td className="p-3">
                                        <span className="font-mono font-semibold">
                                          {field.name}
                                          {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <code className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                          {field.dataType}
                                        </code>
                                      </td>
                                      <td className="p-3 text-gray-600">{field.description}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Triggers */}
                            {section.tables.find(t => t.name === expandedTable)?.triggers && (
                              <div className="bg-green-100 rounded-lg p-4">
                                <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                                  <Icon icon="solar:bolt-bold-duotone" className="w-5 h-5" />
                                  Active Triggers
                                </h5>
                                {section.tables.find(t => t.name === expandedTable)?.triggers?.map((trigger, idx) => (
                                  <div key={idx} className="text-sm text-green-700 flex items-center gap-2 mb-1">
                                    <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                                    <code>{trigger}</code>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-4 text-xs text-gray-500">
                              <span className="text-red-500">*</span> Required fields
                            </div>
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

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-8">
          <p>OneHealth System Blueprint v5.0 • Living Documentation</p>
          <p className="mt-1">Use this reference for system architecture and database schema</p>
        </div>
      </div>
    </div>
  );
};

export default SystemBlueprint;