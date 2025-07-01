/**
 * HPMS Smart Notification Triggers System
 * 
 * Comprehensive notification triggers for medical events with intelligent routing,
 * priority management, and automated follow-up sequences.
 * 
 * Built around visit-centric workflow with full audit trail.
 */

import { communicationService } from './communicationService';

// =============================================================================
// CORE TYPES & INTERFACES
// =============================================================================

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
export type NotificationChannel = 'sms' | 'email' | 'in_app' | 'push';
export type UserRole = 'doctor' | 'nurse' | 'admin' | 'receptionist' | 'patient';

export interface NotificationTrigger {
  id: string;
  name: string;
  description: string;
  category: 'visit' | 'diagnostic' | 'billing' | 'staff' | 'compliance' | 'emergency';
  priority: NotificationPriority;
  conditions: TriggerCondition[];
  actions: NotificationAction[];
  followUpSequence?: FollowUpStep[];
  enabled: boolean;
  practiceId?: string;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_null' | 'is_not_null' | 'between';
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface NotificationAction {
  type: 'send_notification' | 'create_task' | 'update_record' | 'escalate' | 'log_event';
  channel?: NotificationChannel;
  recipients: NotificationRecipient[];
  template: string;
  metadata?: Record<string, unknown>;
  delayMinutes?: number;
}

export interface NotificationRecipient {
  type: 'user' | 'role' | 'patient' | 'emergency_contact';
  identifier: string;
  conditions?: TriggerCondition[];
}

export interface FollowUpStep {
  delayHours: number;
  condition?: TriggerCondition[];
  actions: NotificationAction[];
  escalationLevel?: number;
}

export interface SmartRoutingRule {
  priority: NotificationPriority;
  userRole: UserRole;
  timeOfDay: 'business_hours' | 'after_hours' | 'emergency';
  preferredChannels: NotificationChannel[];
  escalationPath: string[];
}

// =============================================================================
// VISIT/APPOINTMENT WORKFLOW TRIGGERS
// =============================================================================

export const visitWorkflowTriggers: NotificationTrigger[] = [
  {
    id: 'visit_scheduled',
    name: 'Visit Scheduled',
    description: 'Notify relevant parties when a visit is scheduled',
    category: 'visit',
    priority: 'medium',
    conditions: [
      { field: 'is_scheduled', operator: 'equals', value: true },
      { field: 'scheduled_date', operator: 'is_not_null', value: null }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'appointment_confirmation_sms'
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'appointment_confirmation_email'
      },
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'user', identifier: 'doctor_id' }],
        template: 'doctor_appointment_scheduled'
      }
    ],
    followUpSequence: [
      {
        delayHours: 24,
        actions: [{
          type: 'send_notification',
          channel: 'sms',
          recipients: [{ type: 'patient', identifier: 'patient_id' }],
          template: 'appointment_reminder_24h'
        }]
      },
      {
        delayHours: 2,
        actions: [{
          type: 'send_notification',
          channel: 'sms',
          recipients: [{ type: 'patient', identifier: 'patient_id' }],
          template: 'appointment_reminder_2h'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'visit_confirmed',
    name: 'Visit Confirmed by Patient',
    description: 'Notify staff when patient confirms appointment',
    category: 'visit',
    priority: 'low',
    conditions: [
      { field: 'is_confirmed', operator: 'equals', value: true }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [
          { type: 'role', identifier: 'receptionist' },
          { type: 'user', identifier: 'doctor_id' }
        ],
        template: 'patient_confirmed_appointment'
      }
    ],
    enabled: true
  },

  {
    id: 'visit_no_show',
    name: 'Patient No-Show',
    description: 'Trigger when patient misses appointment without notice',
    category: 'visit',
    priority: 'high',
    conditions: [
      { field: 'scheduled_date', operator: 'less_than', value: 'CURRENT_DATE' },
      { field: 'is_checked_in', operator: 'equals', value: false },
      { field: 'is_cancelled', operator: 'equals', value: false }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'missed_appointment_followup'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'receptionist' }],
        template: 'schedule_followup_call',
        metadata: { taskType: 'patient_followup', priority: 'high' }
      },
      {
        type: 'update_record',
        recipients: [],
        template: 'mark_no_show',
        metadata: { field: 'status', value: 'no_show' }
      }
    ],
    followUpSequence: [
      {
        delayHours: 24,
        actions: [{
          type: 'send_notification',
          channel: 'email',
          recipients: [{ type: 'patient', identifier: 'patient_id' }],
          template: 'reschedule_missed_appointment'
        }]
      },
      {
        delayHours: 72,
        escalationLevel: 1,
        actions: [{
          type: 'create_task',
          recipients: [{ type: 'role', identifier: 'nurse' }],
          template: 'patient_welfare_check'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'visit_ready_for_doctor',
    name: 'Patient Ready for Doctor',
    description: 'Notify doctor when patient is ready to be seen',
    category: 'visit',
    priority: 'high',
    conditions: [
      { field: 'is_ready', operator: 'equals', value: true },
      { field: 'is_checked_in', operator: 'equals', value: true }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'user', identifier: 'doctor_id' }],
        template: 'patient_ready_notification'
      },
      {
        type: 'send_notification',
        channel: 'push',
        recipients: [{ type: 'user', identifier: 'doctor_id' }],
        template: 'patient_ready_push'
      }
    ],
    enabled: true
  },

  {
    id: 'visit_completed_needs_followup',
    name: 'Visit Completed - Follow-up Required',
    description: 'Trigger follow-up automation when visit requires follow-up',
    category: 'visit',
    priority: 'medium',
    conditions: [
      { field: 'status', operator: 'equals', value: 'completed' },
      { field: 'follow_up_required', operator: 'equals', value: true },
      { field: 'follow_up_date', operator: 'is_not_null', value: null }
    ],
    actions: [
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'receptionist' }],
        template: 'schedule_followup',
        metadata: { taskType: 'schedule_appointment', priority: 'medium' }
      }
    ],
    followUpSequence: [
      {
        delayHours: 168, // 1 week
        condition: [{ field: 'follow_up_date', operator: 'is_null', value: null }],
        actions: [{
          type: 'send_notification',
          channel: 'sms',
          recipients: [{ type: 'patient', identifier: 'patient_id' }],
          template: 'followup_reminder_patient'
        }]
      }
    ],
    enabled: true
  }
];

// =============================================================================
// LAB AND IMAGING RESULT TRIGGERS
// =============================================================================

export const diagnosticTriggers: NotificationTrigger[] = [
  {
    id: 'lab_results_critical',
    name: 'Critical Lab Results',
    description: 'Immediate notification for critical lab values',
    category: 'diagnostic',
    priority: 'critical',
    conditions: [
      { field: 'status', operator: 'equals', value: 'completed' },
      { field: 'priority', operator: 'equals', value: 'urgent' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'user', identifier: 'requested_by' }],
        template: 'critical_lab_results_sms'
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'user', identifier: 'requested_by' }],
        template: 'critical_lab_results_email'
      },
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [
          { type: 'user', identifier: 'requested_by' },
          { type: 'role', identifier: 'nurse' }
        ],
        template: 'critical_results_alert'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'user', identifier: 'requested_by' }],
        template: 'review_critical_results',
        metadata: { taskType: 'urgent_review', priority: 'critical' }
      }
    ],
    followUpSequence: [
      {
        delayHours: 1,
        condition: [{ field: 'acknowledged', operator: 'not_equals', value: true }],
        escalationLevel: 1,
        actions: [{
          type: 'send_notification',
          channel: 'sms',
          recipients: [{ type: 'role', identifier: 'admin' }],
          template: 'critical_results_escalation'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'imaging_results_available',
    name: 'Imaging Results Available',
    description: 'Notify when imaging results are ready for review',
    category: 'diagnostic',
    priority: 'medium',
    conditions: [
      { field: 'status', operator: 'equals', value: 'completed' },
      { field: 'report_text', operator: 'is_not_null', value: null }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'user', identifier: 'requested_by' }],
        template: 'imaging_results_ready'
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'user', identifier: 'requested_by' }],
        template: 'imaging_results_email'
      }
    ],
    followUpSequence: [
      {
        delayHours: 48,
        condition: [{ field: 'reviewed', operator: 'not_equals', value: true }],
        actions: [{
          type: 'send_notification',
          channel: 'in_app',
          recipients: [{ type: 'user', identifier: 'requested_by' }],
          template: 'pending_results_reminder'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'lab_request_overdue',
    name: 'Lab Request Overdue',
    description: 'Alert when lab results are overdue',
    category: 'diagnostic',
    priority: 'high',
    conditions: [
      { field: 'expected_results_date', operator: 'less_than', value: 'CURRENT_DATE' },
      { field: 'status', operator: 'not_equals', value: 'completed' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'role', identifier: 'nurse' }],
        template: 'overdue_lab_results'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'nurse' }],
        template: 'follow_up_lab_facility',
        metadata: { taskType: 'external_followup', priority: 'high' }
      }
    ],
    enabled: true
  }
];

// =============================================================================
// BILLING AND INVOICE TRIGGERS
// =============================================================================

export const billingTriggers: NotificationTrigger[] = [
  {
    id: 'invoice_generated',
    name: 'Invoice Generated',
    description: 'Send invoice to patient when created',
    category: 'billing',
    priority: 'medium',
    conditions: [
      { field: 'created_at', operator: 'is_not_null', value: null },
      { field: 'patient_id', operator: 'is_not_null', value: null }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'invoice_email_with_attachment'
      },
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'invoice_notification_sms'
      }
    ],
    enabled: true
  },

  {
    id: 'payment_overdue',
    name: 'Payment Overdue',
    description: 'Follow up on overdue payments',
    category: 'billing',
    priority: 'high',
    conditions: [
      { field: 'due_date', operator: 'less_than', value: 'CURRENT_DATE' },
      { field: 'payment_status', operator: 'not_equals', value: 'paid' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'payment_overdue_sms'
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'payment_overdue_email'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'follow_up_payment',
        metadata: { taskType: 'payment_followup', priority: 'high' }
      }
    ],
    followUpSequence: [
      {
        delayHours: 168, // 1 week
        escalationLevel: 1,
        actions: [{
          type: 'send_notification',
          channel: 'email',
          recipients: [{ type: 'patient', identifier: 'patient_id' }],
          template: 'final_payment_notice'
        }]
      },
      {
        delayHours: 336, // 2 weeks
        escalationLevel: 2,
        actions: [{
          type: 'create_task',
          recipients: [{ type: 'role', identifier: 'admin' }],
          template: 'payment_escalation',
          metadata: { taskType: 'debt_collection', priority: 'critical' }
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'medical_aid_claim_rejected',
    name: 'Medical Aid Claim Rejected',
    description: 'Handle medical aid claim rejections',
    category: 'billing',
    priority: 'high',
    conditions: [
      { field: 'medical_aid_status', operator: 'equals', value: 'rejected' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'medical_aid_rejection_alert'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'review_rejected_claim',
        metadata: { taskType: 'claim_review', priority: 'high' }
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'patient', identifier: 'patient_id' }],
        template: 'medical_aid_rejection_patient'
      }
    ],
    enabled: true
  }
];

// =============================================================================
// STAFF SCHEDULING AND HR TRIGGERS
// =============================================================================

export const staffTriggers: NotificationTrigger[] = [
  {
    id: 'timesheet_not_submitted',
    name: 'Timesheet Not Submitted',
    description: 'Remind staff to submit timesheets',
    category: 'staff',
    priority: 'medium',
    conditions: [
      { field: 'period_end_date', operator: 'less_than', value: 'CURRENT_DATE' },
      { field: 'status', operator: 'equals', value: 'draft' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'user', identifier: 'user_id' }],
        template: 'timesheet_reminder'
      },
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'user', identifier: 'user_id' }],
        template: 'timesheet_overdue_notification'
      }
    ],
    followUpSequence: [
      {
        delayHours: 24,
        escalationLevel: 1,
        actions: [{
          type: 'send_notification',
          channel: 'sms',
          recipients: [{ type: 'user', identifier: 'user_id' }],
          template: 'timesheet_urgent_reminder'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'leave_request_pending',
    name: 'Leave Request Pending Approval',
    description: 'Notify managers of pending leave requests',
    category: 'staff',
    priority: 'medium',
    conditions: [
      { field: 'status', operator: 'equals', value: 'pending' },
      { field: 'created_at', operator: 'greater_than', value: 'CURRENT_TIMESTAMP - INTERVAL \'24 hours\'' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'leave_request_approval_needed'
      },
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'pending_leave_request'
      }
    ],
    followUpSequence: [
      {
        delayHours: 48,
        actions: [{
          type: 'send_notification',
          channel: 'in_app',
          recipients: [{ type: 'role', identifier: 'admin' }],
          template: 'leave_request_escalation'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'payroll_processing_due',
    name: 'Payroll Processing Due',
    description: 'Alert HR when payroll processing is due',
    category: 'staff',
    priority: 'high',
    conditions: [
      { field: 'payroll_date', operator: 'equals', value: 'CURRENT_DATE + INTERVAL \'3 days\'' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'payroll_processing_reminder'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'process_payroll',
        metadata: { taskType: 'payroll_processing', priority: 'high' }
      }
    ],
    enabled: true
  }
];

// =============================================================================
// COMPLIANCE AND AUDIT TRIGGERS
// =============================================================================

export const complianceTriggers: NotificationTrigger[] = [
  {
    id: 'audit_log_anomaly',
    name: 'Audit Log Anomaly Detected',
    description: 'Alert on suspicious audit log patterns',
    category: 'compliance',
    priority: 'critical',
    conditions: [
      { field: 'failed_login_attempts', operator: 'greater_than', value: 5 },
      { field: 'time_window', operator: 'less_than', value: '30 minutes' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'security_alert_email'
      },
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'security_alert_sms'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'investigate_security_incident',
        metadata: { taskType: 'security_investigation', priority: 'critical' }
      }
    ],
    enabled: true
  },

  {
    id: 'patient_data_accessed',
    name: 'Patient Data Access Tracking',
    description: 'Log and monitor patient data access',
    category: 'compliance',
    priority: 'low',
    conditions: [
      { field: 'action', operator: 'equals', value: 'patient_record_viewed' }
    ],
    actions: [
      {
        type: 'log_event',
        recipients: [],
        template: 'patient_access_log',
        metadata: { 
          auditType: 'data_access',
          compliance: 'HIPAA',
          retentionYears: 7
        }
      }
    ],
    enabled: true
  },

  {
    id: 'backup_failure',
    name: 'System Backup Failure',
    description: 'Critical alert when backups fail',
    category: 'compliance',
    priority: 'critical',
    conditions: [
      { field: 'backup_status', operator: 'equals', value: 'failed' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'backup_failure_alert'
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'backup_failure_detailed'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'restore_backup_system',
        metadata: { taskType: 'system_maintenance', priority: 'critical' }
      }
    ],
    enabled: true
  }
];

// =============================================================================
// EMERGENCY AND URGENT CARE TRIGGERS
// =============================================================================

export const emergencyTriggers: NotificationTrigger[] = [
  {
    id: 'critical_patient_vitals',
    name: 'Critical Patient Vitals',
    description: 'Immediate alert for critical vital signs',
    category: 'emergency',
    priority: 'critical',
    conditions: [
      { 
        field: 'systolic_bp', 
        operator: 'greater_than', 
        value: 180,
        logicalOperator: 'OR'
      },
      { 
        field: 'diastolic_bp', 
        operator: 'greater_than', 
        value: 120,
        logicalOperator: 'OR'
      },
      { 
        field: 'heart_rate', 
        operator: 'greater_than', 
        value: 120,
        logicalOperator: 'OR'
      },
      { 
        field: 'oxygen_saturation', 
        operator: 'less_than', 
        value: 90
      }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [
          { type: 'user', identifier: 'doctor_id' },
          { type: 'role', identifier: 'nurse' }
        ],
        template: 'critical_vitals_alert'
      },
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [
          { type: 'user', identifier: 'doctor_id' },
          { type: 'role', identifier: 'nurse' }
        ],
        template: 'critical_vitals_dashboard'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'role', identifier: 'nurse' }],
        template: 'immediate_patient_assessment',
        metadata: { taskType: 'emergency_response', priority: 'critical' }
      }
    ],
    followUpSequence: [
      {
        delayHours: 0.25, // 15 minutes
        condition: [{ field: 'acknowledged', operator: 'not_equals', value: true }],
        escalationLevel: 1,
        actions: [{
          type: 'send_notification',
          channel: 'sms',
          recipients: [{ type: 'role', identifier: 'admin' }],
          template: 'critical_vitals_escalation'
        }]
      }
    ],
    enabled: true
  },

  {
    id: 'medication_allergy_alert',
    name: 'Medication Allergy Alert',
    description: 'Alert when prescribed medication conflicts with allergies',
    category: 'emergency',
    priority: 'critical',
    conditions: [
      { field: 'prescription', operator: 'contains', value: 'allergy_medication' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'in_app',
        recipients: [{ type: 'user', identifier: 'doctor_id' }],
        template: 'allergy_conflict_alert'
      },
      {
        type: 'send_notification',
        channel: 'push',
        recipients: [{ type: 'user', identifier: 'doctor_id' }],
        template: 'allergy_conflict_push'
      },
      {
        type: 'create_task',
        recipients: [{ type: 'user', identifier: 'doctor_id' }],
        template: 'review_prescription',
        metadata: { taskType: 'medication_review', priority: 'critical' }
      }
    ],
    enabled: true
  },

  {
    id: 'after_hours_emergency',
    name: 'After Hours Emergency Contact',
    description: 'Route emergency contacts outside business hours',
    category: 'emergency',
    priority: 'critical',
    conditions: [
      { field: 'visit_type', operator: 'equals', value: 'emergency' },
      { field: 'time_of_day', operator: 'equals', value: 'after_hours' }
    ],
    actions: [
      {
        type: 'send_notification',
        channel: 'sms',
        recipients: [{ type: 'role', identifier: 'on_call_doctor' }],
        template: 'after_hours_emergency'
      },
      {
        type: 'send_notification',
        channel: 'email',
        recipients: [{ type: 'role', identifier: 'admin' }],
        template: 'after_hours_emergency_log'
      }
    ],
    enabled: true
  }
];

// =============================================================================
// SMART ROUTING LOGIC
// =============================================================================

export const smartRoutingRules: SmartRoutingRule[] = [
  {
    priority: 'critical',
    userRole: 'doctor',
    timeOfDay: 'business_hours',
    preferredChannels: ['in_app', 'push', 'sms'],
    escalationPath: ['nurse', 'admin']
  },
  {
    priority: 'critical',
    userRole: 'doctor',
    timeOfDay: 'after_hours',
    preferredChannels: ['sms', 'email'],
    escalationPath: ['on_call_doctor', 'admin']
  },
  {
    priority: 'high',
    userRole: 'nurse',
    timeOfDay: 'business_hours',
    preferredChannels: ['in_app', 'email'],
    escalationPath: ['doctor', 'admin']
  },
  {
    priority: 'medium',
    userRole: 'patient',
    timeOfDay: 'business_hours',
    preferredChannels: ['sms', 'email'],
    escalationPath: []
  },
  {
    priority: 'low',
    userRole: 'admin',
    timeOfDay: 'business_hours',
    preferredChannels: ['in_app', 'email'],
    escalationPath: []
  }
];

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

export const notificationTemplates = {
  // Visit/Appointment Templates
  appointment_confirmation_sms: {
    content: "Hi {{patient_name}}, your appointment is confirmed for {{scheduled_date}} at {{scheduled_time}} with Dr. {{doctor_name}}. Reply CONFIRM to acknowledge.",
    variables: ['patient_name', 'scheduled_date', 'scheduled_time', 'doctor_name']
  },
  
  appointment_reminder_24h: {
    content: "Reminder: You have an appointment tomorrow {{scheduled_date}} at {{scheduled_time}} with Dr. {{doctor_name}} at {{practice_name}}. Reply CONFIRM if you're still coming.",
    variables: ['scheduled_date', 'scheduled_time', 'doctor_name', 'practice_name']
  },

  appointment_reminder_2h: {
    content: "Your appointment with Dr. {{doctor_name}} starts in 2 hours at {{scheduled_time}}. Please arrive 15 minutes early. {{practice_address}}",
    variables: ['doctor_name', 'scheduled_time', 'practice_address']
  },

  missed_appointment_followup: {
    content: "Hi {{patient_name}}, we missed you at your appointment today. Please call us at {{practice_phone}} to reschedule. We're concerned about your health.",
    variables: ['patient_name', 'practice_phone']
  },

  // Diagnostic Templates
  critical_lab_results_sms: {
    content: "URGENT: Critical lab results for {{patient_name}} ({{patient_id}}) require immediate attention. Please review immediately.",
    variables: ['patient_name', 'patient_id']
  },

  imaging_results_ready: {
    content: "Imaging results for {{patient_name}} are now available for review in the system.",
    variables: ['patient_name']
  },

  // Billing Templates
  invoice_notification_sms: {
    content: "Your invoice #{{invoice_number}} for {{total}} is now available. Due date: {{due_date}}. View online: {{invoice_link}}",
    variables: ['invoice_number', 'total', 'due_date', 'invoice_link']
  },

  payment_overdue_sms: {
    content: "Payment reminder: Invoice #{{invoice_number}} for {{total}} was due on {{due_date}}. Please settle to avoid service interruption.",
    variables: ['invoice_number', 'total', 'due_date']
  },

  // Emergency Templates
  critical_vitals_alert: {
    content: "CRITICAL VITALS ALERT: {{patient_name}} - BP: {{blood_pressure}}, HR: {{heart_rate}}, O2: {{oxygen_saturation}}%. Immediate attention required.",
    variables: ['patient_name', 'blood_pressure', 'heart_rate', 'oxygen_saturation']
  },

  allergy_conflict_alert: {
    content: "ALLERGY ALERT: Prescribed medication {{medication}} conflicts with {{patient_name}}'s known allergies: {{allergies}}",
    variables: ['medication', 'patient_name', 'allergies']
  }
};

// =============================================================================
// TRIGGER EXECUTION ENGINE
// =============================================================================

export class SmartNotificationEngine {
  private triggers: Map<string, NotificationTrigger> = new Map();
  private routingRules: SmartRoutingRule[] = smartRoutingRules;

  constructor() {
    this.initializeTriggers();
  }

  private initializeTriggers(): void {
    const allTriggers = [
      ...visitWorkflowTriggers,
      ...diagnosticTriggers,
      ...billingTriggers,
      ...staffTriggers,
      ...complianceTriggers,
      ...emergencyTriggers
    ];

    allTriggers.forEach(trigger => {
      this.triggers.set(trigger.id, trigger);
    });
  }

  /**
   * Process a data change event and execute matching triggers
   */
  async processEvent(
    tableName: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    oldRecord: Record<string, unknown>,
    newRecord: Record<string, unknown>,
    practiceId: string
  ): Promise<void> {
    console.log(`Processing ${eventType} event for ${tableName}`, { oldRecord, newRecord, practiceId });

    // Find triggers that match this event
    const matchingTriggers = Array.from(this.triggers.values()).filter(trigger => 
      trigger.enabled && 
      (!trigger.practiceId || trigger.practiceId === practiceId)
    );

    for (const trigger of matchingTriggers) {
      if (await this.evaluateTriggerConditions(trigger, newRecord || oldRecord)) {
        await this.executeTriggerActions(trigger, newRecord || oldRecord, practiceId);
        
        // Schedule follow-up sequences if they exist
        if (trigger.followUpSequence && trigger.followUpSequence.length > 0) {
          await this.scheduleFollowUpSequence(trigger, newRecord || oldRecord, practiceId);
        }
      }
    }
  }

  /**
   * Evaluate trigger conditions against a record
   */
  private async evaluateTriggerConditions(trigger: NotificationTrigger, record: Record<string, unknown>): Promise<boolean> {
    if (!trigger.conditions || trigger.conditions.length === 0) {
      return true;
    }

    let result = true;
    let currentLogicalOperator: 'AND' | 'OR' = 'AND';

    for (const condition of trigger.conditions) {
      const conditionResult = this.evaluateCondition(condition, record);
      
      if (currentLogicalOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      if (condition.logicalOperator) {
        currentLogicalOperator = condition.logicalOperator;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: TriggerCondition, record: Record<string, unknown>): boolean {
    const fieldValue = record[condition.field];
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'greater_than':
        return fieldValue > conditionValue;
      case 'less_than':
        return fieldValue < conditionValue;
      case 'contains':
        return fieldValue?.toString().includes(conditionValue);
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      case 'between':
        return Array.isArray(conditionValue) && 
               fieldValue >= conditionValue[0] && 
               fieldValue <= conditionValue[1];
      default:
        return false;
    }
  }

  /**
   * Execute all actions for a trigger
   */
  private async executeTriggerActions(
    trigger: NotificationTrigger, 
    record: Record<string, unknown>, 
    practiceId: string
  ): Promise<void> {
    for (const action of trigger.actions) {
      try {
        await this.executeAction(action, record, practiceId, trigger.priority);
      } catch (error) {
        console.error(`Failed to execute action for trigger ${trigger.id}:`, error);
        // Log error but continue with other actions
      }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: NotificationAction,
    record: any,
    practiceId: string,
    priority: NotificationPriority
  ): Promise<void> {
    switch (action.type) {
      case 'send_notification':
        await this.sendNotification(action, record, practiceId, priority);
        break;
      case 'create_task':
        await this.createTask(action, record, practiceId);
        break;
      case 'update_record':
        await this.updateRecord(action, record);
        break;
      case 'escalate':
        await this.escalateNotification(action, record, practiceId);
        break;
      case 'log_event':
        await this.logEvent(action, record, practiceId);
        break;
    }
  }

  /**
   * Send notification using centralized communication service
   */
  private async sendNotification(
    action: NotificationAction,
    record: any,
    practiceId: string,
    priority: NotificationPriority
  ): Promise<void> {
    const recipients = await this.resolveRecipients(action.recipients, record, practiceId);
    const template = notificationTemplates[action.template];
    
    if (!template) {
      console.error(`Template ${action.template} not found`);
      return;
    }

    const content = this.interpolateTemplate(template.content, record);

    for (const recipient of recipients) {
      if (action.channel === 'sms' && recipient.phone) {
        await communicationService.sendSMS({
          practiceId,
          recipientPhone: recipient.phone,
          messageContent: content,
          messageType: action.template,
          patientId: record.patient_id,
          appointmentId: record.id,
          metadata: { priority, ...action.metadata }
        });
      } else if (action.channel === 'email' && recipient.email) {
        await communicationService.sendEmail({
          practiceId,
          recipientEmail: recipient.email,
          subject: `${priority.toUpperCase()}: Healthcare Notification`,
          htmlContent: `<p>${content}</p>`,
          emailType: action.template,
          patientId: record.patient_id,
          metadata: { priority, ...action.metadata }
        });
      }
    }
  }

  /**
   * Resolve recipients based on recipient configuration
   */
  private async resolveRecipients(
    recipientConfigs: NotificationRecipient[],
    record: any,
    practiceId: string
  ): Promise<Array<{ id: string; email?: string; phone?: string }>> {
    const recipients: Array<{ id: string; email?: string; phone?: string }> = [];

    for (const config of recipientConfigs) {
      switch (config.type) {
        case 'user':
          // Resolve user by ID from record
          const userId = record[config.identifier];
          if (userId) {
            // This would typically query the users table
            recipients.push({ id: userId });
          }
          break;
        case 'role':
          // Resolve users by role in practice
          // This would query practice staff with specific role
          break;
        case 'patient':
          // Resolve patient contact info
          const patientId = record[config.identifier];
          if (patientId) {
            // This would query the patients table
            recipients.push({ id: patientId });
          }
          break;
      }
    }

    return recipients;
  }

  /**
   * Interpolate template variables with record data
   */
  private interpolateTemplate(template: string, record: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return record[key] || match;
    });
  }

  /**
   * Create a task/todo item
   */
  private async createTask(action: NotificationAction, record: any, practiceId: string): Promise<void> {
    // Implementation would create task in task management system
    console.log('Creating task:', action.template, record, practiceId);
  }

  /**
   * Update a record
   */
  private async updateRecord(action: NotificationAction, record: any): Promise<void> {
    // Implementation would update the original record
    console.log('Updating record:', action.metadata, record);
  }

  /**
   * Escalate notification to higher level
   */
  private async escalateNotification(action: NotificationAction, record: any, practiceId: string): Promise<void> {
    // Implementation would escalate to management/admin
    console.log('Escalating notification:', action, record, practiceId);
  }

  /**
   * Log event for audit trail
   */
  private async logEvent(action: NotificationAction, record: any, practiceId: string): Promise<void> {
    // Implementation would log to audit system
    console.log('Logging event:', action.template, record, practiceId);
  }

  /**
   * Schedule follow-up sequence
   */
  private async scheduleFollowUpSequence(
    trigger: NotificationTrigger,
    record: any,
    practiceId: string
  ): Promise<void> {
    if (!trigger.followUpSequence) return;

    for (const step of trigger.followUpSequence) {
      // Schedule each step with appropriate delay
      setTimeout(async () => {
        // Check conditions if they exist
        let shouldExecute = true;
        if (step.condition) {
          shouldExecute = await this.evaluateTriggerConditions({ 
            ...trigger, 
            conditions: step.condition 
          }, record);
        }

        if (shouldExecute) {
          for (const action of step.actions) {
            await this.executeAction(action, record, practiceId, trigger.priority);
          }
        }
      }, step.delayHours * 60 * 60 * 1000); // Convert hours to milliseconds
    }
  }

  /**
   * Get optimal routing for a notification
   */
  private getOptimalRouting(
    priority: NotificationPriority,
    userRole: UserRole,
    timeOfDay: 'business_hours' | 'after_hours' | 'emergency'
  ): SmartRoutingRule | undefined {
    return this.routingRules.find(rule => 
      rule.priority === priority && 
      rule.userRole === userRole && 
      rule.timeOfDay === timeOfDay
    );
  }
}

// Export singleton instance
export const smartNotificationEngine = new SmartNotificationEngine();