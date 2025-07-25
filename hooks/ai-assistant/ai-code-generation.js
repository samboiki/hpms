#!/usr/bin/env node

/**
 * AI Code Generation Agent
 * 
 * MISSION: Generate high-quality, HPMS-aware code suggestions and auto-completions
 * FOCUS: Healthcare-specific patterns, Supabase integrations, React best practices
 * TARGET: Accelerate development while maintaining medical-grade quality
 */

import { IntelligentAgent } from '../shared/agent-base.js';
import { HpmsPatterns } from '../shared/hpms-patterns.js';

export class AICodeGenerationAgent extends IntelligentAgent {
  constructor() {
    super({
      id: 'ai-code-generation',
      name: '🤖 AI Code Generation Agent',
      hpmsContext: {
        codePatterns: {
          components: 'React functional components with TypeScript',
          styling: 'Tailwind CSS with healthcare color scheme',
          icons: 'Solar Bold Duotone icons via Iconify',
          stateManagement: 'Zustand for global state',
          dataFetching: 'React Query with Supabase',
          forms: 'React Hook Form with Zod validation'
        },
        medicalDomains: [
          'patient-registration',
          'appointment-scheduling',
          'visit-recording',
          'medical-records',
          'billing-invoicing',
          'lab-imaging',
          'prescriptions'
        ]
      }
    });
    
    this.codeTemplates = {
      // HPMS Component Templates
      medicalForm: this.getMedicalFormTemplate(),
      patientList: this.getPatientListTemplate(),
      appointmentScheduler: this.getAppointmentSchedulerTemplate(),
      supabaseService: this.getSupabaseServiceTemplate(),
      
      // Common Patterns
      errorBoundary: this.getErrorBoundaryTemplate(),
      loadingState: this.getLoadingStateTemplate(),
      emptyState: this.getEmptyStateTemplate(),
      
      // Healthcare-specific
      hipaaAudit: this.getHIPAAAuditTemplate(),
      practiceIsolation: this.getPracticeIsolationTemplate()
    };
    
    this.smartSuggestions = {
      visitWorkflow: [
        'Check patient exists',
        'Validate practice access',
        'Create visit record',
        'Log audit trail',
        'Send confirmation SMS'
      ],
      securityChecks: [
        'Verify practice_id',
        'Check user permissions',
        'Log HIPAA audit',
        'Validate data access'
      ]
    };
  }
  
  async analyzeContext(content, filename, cursorPosition) {
    const context = {
      componentType: this.detectComponentType(filename, content),
      currentFunction: this.getCurrentFunction(content, cursorPosition),
      imports: this.getImports(content),
      missingImports: [],
      suggestedCode: [],
      patterns: []
    };
    
    // Detect what user is trying to do
    const intention = this.detectIntention(content, cursorPosition);
    
    // Generate appropriate suggestions
    if (intention.type === 'component-creation') {
      context.suggestedCode.push(
        this.generateComponent(intention.details, context)
      );
    } else if (intention.type === 'supabase-query') {
      context.suggestedCode.push(
        this.generateSupabaseQuery(intention.details, context)
      );
    } else if (intention.type === 'form-validation') {
      context.suggestedCode.push(
        this.generateFormValidation(intention.details, context)
      );
    }
    
    // Check for missing imports
    context.missingImports = this.detectMissingImports(content, context.suggestedCode);
    
    return context;
  }
  
  detectComponentType(filename, content) {
    if (filename.includes('Visit')) return 'medical-visit';
    if (filename.includes('Patient')) return 'patient-management';
    if (filename.includes('Invoice')) return 'billing';
    if (filename.includes('Lab') || filename.includes('Imaging')) return 'diagnostics';
    if (content.includes('useForm')) return 'form-component';
    if (content.includes('useState')) return 'stateful-component';
    return 'generic-component';
  }
  
  getCurrentFunction(content, position) {
    // Find the function context at cursor position
    const lines = content.split('\n');
    let currentLine = 0;
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= position) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    
    // Search backwards for function declaration
    for (let i = currentLine; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('const') || line.includes('function') || line.includes('=>')) {
        return {
          line: i,
          content: line,
          type: this.detectFunctionType(line)
        };
      }
    }
    
    return null;
  }
  
  detectIntention(content, position) {
    const beforeCursor = content.substring(Math.max(0, position - 100), position);
    const afterCursor = content.substring(position, Math.min(content.length, position + 50));
    
    // Component creation patterns
    if (beforeCursor.includes('const') && afterCursor.includes('=')) {
      return {
        type: 'component-creation',
        details: {
          componentName: this.extractComponentName(beforeCursor, afterCursor)
        }
      };
    }
    
    // Supabase query patterns
    if (beforeCursor.includes('supabase') || beforeCursor.includes('from(')) {
      return {
        type: 'supabase-query',
        details: {
          table: this.extractTableName(beforeCursor, afterCursor),
          operation: this.extractOperation(beforeCursor)
        }
      };
    }
    
    // Form validation patterns
    if (beforeCursor.includes('useForm') || beforeCursor.includes('validation')) {
      return {
        type: 'form-validation',
        details: {
          formType: this.detectFormType(content)
        }
      };
    }
    
    return { type: 'unknown', details: {} };
  }
  
  generateComponent(details, context) {
    const { componentName } = details;
    const componentType = context.componentType;
    
    // Select appropriate template based on component type
    if (componentType === 'medical-visit') {
      return this.generateMedicalComponent(componentName);
    } else if (componentType === 'patient-management') {
      return this.generatePatientComponent(componentName);
    }
    
    // Default component template
    return {
      code: `export const ${componentName} = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        ${componentName}
      </h2>
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="mt-4">
          {/* Component content */}
        </div>
      )}
    </div>
  );
};`,
      imports: [
        "import { useState } from 'react';",
        "import { LoadingSpinner } from '@/components/ui/LoadingSpinner';"
      ]
    };
  }
  
  generateMedicalComponent(componentName) {
    return {
      code: `export const ${componentName} = ({ practiceId, patientId }) => {
  const [visitData, setVisitData] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  // HPMS Security: Always verify practice access
  useEffect(() => {
    if (!verifyPracticeAccess(user, practiceId)) {
      throw new Error('Unauthorized practice access');
    }
  }, [user, practiceId]);
  
  const loadVisitData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visits')
        .select(\`
          *,
          patient:patients!inner(
            id,
            full_name,
            system_patient_reference_number
          )
        \`)
        .eq('practice_id', practiceId)
        .eq('patient_id', patientId)
        .single();
        
      if (error) throw error;
      setVisitData(data);
      
      // HIPAA Audit
      await logAuditTrail({
        action: 'VIEW_VISIT',
        resource: 'visits',
        resourceId: data.id,
        practiceId,
        userId: user.id
      });
      
    } catch (error) {
      console.error('Error loading visit:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon icon="solar:health-bold-duotone" className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          Medical Visit Details
        </h2>
      </div>
      
      {loading ? (
        <LoadingSpinner />
      ) : visitData ? (
        <div className="space-y-4">
          <PatientHeader patient={visitData.patient} />
          <VisitDetails visit={visitData} />
          <VitalSigns visitId={visitData.id} />
        </div>
      ) : (
        <EmptyState 
          icon="solar:document-bold-duotone"
          message="No visit data found"
        />
      )}
    </div>
  );
};`,
      imports: [
        "import { useState, useEffect } from 'react';",
        "import { Icon } from '@iconify/react';",
        "import { supabase } from '@/lib/supabase';",
        "import { useAuth } from '@/hooks/useAuth';",
        "import { verifyPracticeAccess, logAuditTrail } from '@/services/securityService';",
        "import { LoadingSpinner } from '@/components/ui/LoadingSpinner';",
        "import { EmptyState } from '@/components/ui/EmptyState';",
        "import type { Visit } from '@/types/medical';"
      ]
    };
  }
  
  generateSupabaseQuery(details, context) {
    const { table, operation } = details;
    
    // Detect HPMS table and generate appropriate query
    if (HpmsPatterns.coreTables.includes(table)) {
      return this.generateHPMSQuery(table, operation);
    }
    
    // Generic query template
    return {
      code: `const { data, error } = await supabase
  .from('${table}')
  .select('*')
  .eq('practice_id', practiceId)
  .order('created_at', { ascending: false })
  .limit(50);

if (error) {
  console.error('Error fetching ${table}:', error);
  throw error;
}`,
      imports: ["import { supabase } from '@/lib/supabase';"]
    };
  }
  
  generateHPMSQuery(table, operation) {
    const queries = {
      patients: {
        select: `const { data: patients, error } = await supabase
  .from('patients')
  .select(\`
    *,
    visits(count),
    latest_visit:visits(
      visit_date,
      visit_type,
      status
    )
  \`)
  .eq('practice_id', practiceId)
  .ilike('full_name', \`%\${searchTerm}%\`)
  .order('created_at', { ascending: false })
  .limit(20);`,
        
        insert: `const { data: newPatient, error } = await supabase
  .from('patients')
  .insert({
    ...patientData,
    practice_id: practiceId,
    created_by: user.id,
    system_patient_reference_number: generatePatientRef()
  })
  .select()
  .single();
  
// Audit trail
await logAuditTrail({
  action: 'CREATE_PATIENT',
  resource: 'patients',
  resourceId: newPatient.id,
  practiceId,
  userId: user.id
});`
      },
      
      visits: {
        select: `const { data: visits, error } = await supabase
  .from('visits')
  .select(\`
    *,
    patient:patients!inner(
      id,
      full_name,
      system_patient_reference_number,
      id_number
    ),
    assigned_to:users!visits_assigned_to_user_id_fkey(
      id,
      full_name
    ),
    created_by:users!visits_created_by_fkey(
      id,
      full_name
    )
  \`)
  .eq('practice_id', practiceId)
  .gte('visit_date', startDate)
  .lte('visit_date', endDate)
  .order('visit_date', { ascending: false });`,
        
        insert: `// CRITICAL: visits table is the primary table for appointments
const { data: newVisit, error } = await supabase
  .from('visits')
  .insert({
    patient_id: patientId,
    practice_id: practiceId,
    branch_id: branchId,
    visit_date: visitDate, // NOT scheduled_date!
    visit_type: visitType,
    status: 'scheduled',
    assigned_to_user_id: doctorId,
    created_by: user.id
  })
  .select()
  .single();
  
// Send appointment confirmation
await communicationService.sendSMS({
  practiceId,
  recipientPhone: patient.phone,
  messageContent: \`Appointment confirmed for \${formatDate(visitDate)}\`,
  messageType: 'appointment_confirmation',
  patientId: patient.id,
  appointmentId: newVisit.id
});`
      }
    };
    
    return {
      code: queries[table]?.[operation] || queries[table]?.select || '',
      imports: [
        "import { supabase } from '@/lib/supabase';",
        "import { communicationService } from '@/services/communicationService';",
        "import { logAuditTrail } from '@/services/securityService';"
      ]
    };
  }
  
  generateFormValidation(details, context) {
    const { formType } = details;
    
    return {
      code: `const ${formType}Schema = z.object({
  // Patient Information
  patientId: z.string().uuid('Invalid patient ID'),
  
  // Visit Details
  visitDate: z.date({
    required_error: 'Visit date is required',
    invalid_type_error: 'Invalid date format'
  }),
  
  visitType: z.enum(['consultation', 'follow_up', 'emergency', 'procedure'], {
    required_error: 'Please select visit type'
  }),
  
  // Medical Information
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  
  // Vitals (optional but validated if provided)
  vitals: z.object({
    bloodPressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/, 'Format: 120/80').optional(),
    heartRate: z.number().min(40).max(200).optional(),
    temperature: z.number().min(35).max(42).optional(),
    weight: z.number().positive().optional()
  }).optional(),
  
  // Practice validation
  practiceId: z.string().uuid('Invalid practice ID'),
  branchId: z.string().uuid('Invalid branch ID')
});

const form = useForm<z.infer<typeof ${formType}Schema>>({
  resolver: zodResolver(${formType}Schema),
  defaultValues: {
    visitDate: new Date(),
    visitType: 'consultation',
    practiceId: currentPracticeId,
    branchId: currentBranchId
  }
});`,
      imports: [
        "import { z } from 'zod';",
        "import { useForm } from 'react-hook-form';",
        "import { zodResolver } from '@hookform/resolvers/zod';"
      ]
    };
  }
  
  getMedicalFormTemplate() {
    return `<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
  {/* Patient Selection */}
  <div>
    <label className="block text-sm font-medium text-gray-700">
      Patient
    </label>
    <PatientSearch
      practiceId={practiceId}
      onSelect={(patient) => setValue('patientId', patient.id)}
      error={errors.patientId?.message}
    />
  </div>
  
  {/* Visit Type */}
  <div>
    <label className="block text-sm font-medium text-gray-700">
      Visit Type
    </label>
    <select
      {...register('visitType')}
      className="mt-1 block w-full rounded-md border-gray-300"
    >
      <option value="consultation">Consultation</option>
      <option value="follow_up">Follow-up</option>
      <option value="emergency">Emergency</option>
      <option value="procedure">Procedure</option>
    </select>
  </div>
  
  {/* Submit */}
  <div className="flex justify-end gap-3">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={isSubmitting}
      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
    >
      {isSubmitting ? 'Saving...' : 'Save Visit'}
    </button>
  </div>
</form>`;
  }
  
  detectMissingImports(content, suggestedCode) {
    const missing = [];
    const existingImports = content.match(/import .* from .*/g) || [];
    
    suggestedCode.forEach(suggestion => {
      suggestion.imports?.forEach(imp => {
        if (!existingImports.some(existing => existing.includes(imp.split(' from ')[1]))) {
          missing.push(imp);
        }
      });
    });
    
    return [...new Set(missing)];
  }
  
  async execute(hookData) {
    const content = hookData.tool_result?.content || '';
    const filename = hookData.tool_input?.file_path || 'unknown';
    const cursorPosition = hookData.tool_input?.cursor_position || content.length;
    
    const analysis = await this.analyzeContext(content, filename, cursorPosition);
    
    if (analysis.suggestedCode.length === 0) {
      return { action: 'skip', reason: 'No code generation needed' };
    }
    
    const suggestions = {
      action: 'suggest',
      suggestions: analysis.suggestedCode,
      missingImports: analysis.missingImports,
      context: {
        componentType: analysis.componentType,
        currentFunction: analysis.currentFunction
      },
      tips: this.getContextualTips(analysis)
    };
    
    // Store generation history
    await this.storeKnowledge(`codegen-${filename}`, {
      timestamp: new Date().toISOString(),
      suggestions: analysis.suggestedCode.map(s => s.code.substring(0, 100) + '...'),
      componentType: analysis.componentType
    });
    
    return suggestions;
  }
  
  getContextualTips(analysis) {
    const tips = [];
    
    if (analysis.componentType === 'medical-visit') {
      tips.push('Remember: visits table is the primary table for appointments');
      tips.push('Always use visit_date, not scheduled_date');
      tips.push('Include HIPAA audit logging for all medical data access');
    }
    
    if (analysis.componentType === 'patient-management') {
      tips.push('Ensure practice isolation with practice_id checks');
      tips.push('Use system_patient_reference_number for external systems');
      tips.push('Patient data requires special privacy handling');
    }
    
    if (analysis.missingImports.length > 0) {
      tips.push('Don\'t forget to add the suggested imports at the top of your file');
    }
    
    return tips;
  }
  
  // Additional template methods
  getPatientListTemplate() {
    return {
      code: `<div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
  <table className="min-w-full divide-y divide-gray-300">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Patient
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Reference #
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Last Visit
        </th>
        <th className="relative px-6 py-3">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {patients.map((patient) => (
        <tr key={patient.id} className="hover:bg-gray-50">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center">
              <Icon icon="solar:user-bold-duotone" className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {patient.full_name}
                </div>
                <div className="text-sm text-gray-500">
                  {patient.email || patient.phone}
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {patient.system_patient_reference_number}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {patient.latest_visit?.[0]?.visit_date 
              ? formatDate(patient.latest_visit[0].visit_date)
              : 'No visits'
            }
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button
              onClick={() => onViewPatient(patient)}
              className="text-primary-600 hover:text-primary-900"
            >
              View
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>`
    };
  }
  
  getErrorBoundaryTemplate() {
    return {
      code: `export class MedicalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to error reporting service
    console.error('Medical component error:', error, errorInfo);
    
    // Log HIPAA audit for error access
    logAuditTrail({
      action: 'COMPONENT_ERROR',
      resource: this.props.componentName || 'unknown',
      error: error.message,
      practiceId: this.props.practiceId,
      userId: this.props.userId
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <Icon icon="solar:danger-triangle-bold-duotone" className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Something went wrong
              </h3>
              <p className="mt-2 text-sm text-red-700">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}`
    };
  }
  
  getHIPAAAuditTemplate() {
    return {
      code: `export async function logHIPAAAudit({
  action,
  resource,
  resourceId,
  practiceId,
  userId,
  patientId = null,
  metadata = {}
}) {
  try {
    const { error } = await supabase
      .from('hipaa_audit_logs')
      .insert({
        action,
        resource_type: resource,
        resource_id: resourceId,
        practice_id: practiceId,
        user_id: userId,
        patient_id: patientId,
        ip_address: await getUserIP(),
        user_agent: navigator.userAgent,
        metadata,
        timestamp: new Date().toISOString()
      });
      
    if (error) {
      console.error('Failed to log HIPAA audit:', error);
      // Still throw - audit logging failure is critical
      throw new Error('HIPAA audit logging failed');
    }
  } catch (error) {
    // For critical operations, consider blocking on audit failure
    if (action.includes('DELETE') || action.includes('EXPORT')) {
      throw error;
    }
    // For reads, log but don't block
    console.error('HIPAA audit error:', error);
  }
}`
    };
  }
  
  getPracticeIsolationTemplate() {
    return {
      code: `export function ensurePracticeIsolation(query, practiceId) {
  if (!practiceId) {
    throw new Error('Practice ID is required for data access');
  }
  
  // Always add practice_id filter
  return query.eq('practice_id', practiceId);
}

export function verifyPracticeAccess(user, practiceId, requiredRole = null) {
  // Check if user belongs to practice
  const userPractice = user.practices?.find(p => p.id === practiceId);
  
  if (!userPractice) {
    throw new Error('Unauthorized: User does not belong to this practice');
  }
  
  // Check role if specified
  if (requiredRole && userPractice.role !== requiredRole) {
    throw new Error(\`Unauthorized: Requires \${requiredRole} role\`);
  }
  
  return true;
}

// Usage in components
const loadPatients = async () => {
  verifyPracticeAccess(user, practiceId);
  
  let query = supabase
    .from('patients')
    .select('*');
    
  // Ensure practice isolation
  query = ensurePracticeIsolation(query, practiceId);
  
  const { data, error } = await query;
  // ...
};`
    };
  }
}

// Export for use in coordinator
export default AICodeGenerationAgent;