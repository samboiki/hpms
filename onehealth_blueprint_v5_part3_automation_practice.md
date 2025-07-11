# 🏥 ONEHEALTH SYSTEM BLUEPRINT V5.0 - PART 3: AUTOMATION & PRACTICE MANAGEMENT
**Version**: 5.0  
**Last Updated**: 2025-01-11 20:45:00 UTC

---

## 🤖 AUTOMATION TABLES (16 tables)

### 7.1 `automation_executions` - Automation Run History
**Created**: 2024-11-15 14:00:00 UTC | **Last Modified**: 2025-01-11 16:30:00 UTC
```sql
CREATE TABLE public.automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Trigger Information
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'patient.created', 'patient.birthday', 'patient.inactive',
        'appointment.created', 'appointment.reminder', 'appointment.cancelled',
        'appointment.no_show', 'appointment.rescheduled',
        'visit.completed', 'visit.followup_due',
        'invoice.created', 'invoice.sent', 'invoice.overdue',
        'payment.received', 'payment.reminder',
        'lab_results.ready', 'prescription.created',
        'custom', 'manual'
    )),
    trigger_entity_id UUID,
    trigger_entity_type TEXT,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_by UUID REFERENCES users(id),
    
    -- Automation Details
    automation_name TEXT NOT NULL,
    automation_template_id UUID REFERENCES automation_templates(id),
    
    -- Execution Details
    scheduled_for TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'scheduled', 'processing', 'completed', 
        'failed', 'cancelled', 'skipped'
    )),
    
    -- Channels & Recipients
    channels TEXT[] DEFAULT ARRAY['sms'],
    recipient_count INTEGER DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Data
    template_data JSONB NOT NULL DEFAULT '{}',
    execution_data JSONB DEFAULT '{}',
    
    -- Results
    results JSONB DEFAULT '{}',
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processing_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
);

-- Indexes
CREATE INDEX idx_automation_executions_practice ON automation_executions(practice_id);
CREATE INDEX idx_automation_executions_status ON automation_executions(status);
CREATE INDEX idx_automation_executions_trigger ON automation_executions(trigger_type);
CREATE INDEX idx_automation_executions_scheduled ON automation_executions(scheduled_for) WHERE status IN ('pending', 'scheduled');
CREATE INDEX idx_automation_executions_entity ON automation_executions(trigger_entity_id);

-- Triggers
-- 1. queue_automation_execution_trigger (AFTER INSERT)
-- 2. update_automation_executions_updated_at (BEFORE UPDATE)
-- 3. calculate_processing_time_trigger (BEFORE UPDATE OF completed_at)
```

### 7.2 `automation_queue` - Processing Queue
**Created**: 2024-11-15 15:00:00 UTC | **Last Modified**: 2025-01-11 18:00:00 UTC
```sql
CREATE TABLE public.automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES automation_executions(id) NOT NULL,
    
    -- Queue Management
    status TEXT DEFAULT 'queued' CHECK (status IN (
        'queued', 'processing', 'completed', 'failed', 'cancelled'
    )),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL,
    process_after TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Processing
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_automation_queue_status ON automation_queue(status);
CREATE INDEX idx_automation_queue_scheduled ON automation_queue(scheduled_for) WHERE status = 'queued';
CREATE INDEX idx_automation_queue_priority ON automation_queue(priority DESC, scheduled_for) WHERE status = 'queued';
CREATE INDEX idx_automation_queue_locked ON automation_queue(locked_by) WHERE locked_at IS NOT NULL;

-- Triggers
-- 1. notify_queue_webhook (AFTER INSERT) - Currently broken
-- 2. unlock_stale_items_trigger (CALLED BY CRON)
-- 3. update_automation_queue_updated_at (BEFORE UPDATE)
```

### 7.3 `automation_templates` - Automation Blueprints
**Created**: 2024-11-20 10:00:00 UTC | **Last Modified**: 2025-01-10 14:15:00 UTC
```sql
CREATE TABLE public.automation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    
    -- Template Info
    template_name TEXT NOT NULL,
    template_code TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    
    -- Trigger Configuration
    trigger_types TEXT[] NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',
    
    -- Timing
    delay_minutes INTEGER DEFAULT 0,
    send_time TIME,
    send_days_before INTEGER,
    send_days_after INTEGER,
    
    -- Channels
    channels JSONB DEFAULT '{"sms": true, "email": false, "whatsapp": false}',
    
    -- Content Templates
    sms_template_id UUID REFERENCES sms_templates(id),
    email_template_id UUID REFERENCES email_templates(id),
    
    -- Rules
    skip_weekends BOOLEAN DEFAULT true,
    skip_holidays BOOLEAN DEFAULT true,
    require_opt_in BOOLEAN DEFAULT true,
    max_sends_per_day INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system_template BOOLEAN DEFAULT false,
    
    -- Performance
    average_open_rate DECIMAL(5,2),
    average_response_rate DECIMAL(5,2),
    total_sent INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    last_used_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_automation_templates_practice ON automation_templates(practice_id);
CREATE INDEX idx_automation_templates_trigger ON automation_templates(trigger_types);
CREATE INDEX idx_automation_templates_active ON automation_templates(practice_id) WHERE is_active = true;

-- Triggers
-- 1. update_automation_templates_updated_at (BEFORE UPDATE)
-- 2. validate_template_channels_trigger (BEFORE INSERT, UPDATE)
```

### 7.4 `practice_automation_settings` - Practice-Specific Automation Config
**Created**: 2024-11-25 11:30:00 UTC | **Last Modified**: 2025-01-11 09:45:00 UTC
```sql
CREATE TABLE public.practice_automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) UNIQUE NOT NULL,
    
    -- Global Settings
    automations_enabled BOOLEAN DEFAULT true,
    
    -- Channel Settings
    sms_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    whatsapp_enabled BOOLEAN DEFAULT false,
    
    -- Timing Preferences
    business_hours_only BOOLEAN DEFAULT true,
    business_start_time TIME DEFAULT '08:00',
    business_end_time TIME DEFAULT '17:00',
    timezone TEXT DEFAULT 'Africa/Windhoek',
    
    -- Feature Toggles
    appointment_reminders_enabled BOOLEAN DEFAULT true,
    appointment_confirmations_enabled BOOLEAN DEFAULT true,
    birthday_messages_enabled BOOLEAN DEFAULT true,
    follow_up_reminders_enabled BOOLEAN DEFAULT true,
    payment_reminders_enabled BOOLEAN DEFAULT true,
    marketing_messages_enabled BOOLEAN DEFAULT false,
    
    -- Reminder Timing
    appointment_reminder_hours INTEGER DEFAULT 24,
    appointment_reminder_2_hours INTEGER,
    follow_up_days INTEGER DEFAULT 7,
    payment_reminder_days INTEGER DEFAULT 3,
    
    -- Templates
    default_appointment_reminder_template UUID REFERENCES sms_templates(id),
    default_birthday_template UUID REFERENCES sms_templates(id),
    default_follow_up_template UUID REFERENCES sms_templates(id),
    
    -- Limits
    max_messages_per_patient_per_day INTEGER DEFAULT 3,
    quiet_hours_start TIME DEFAULT '20:00',
    quiet_hours_end TIME DEFAULT '08:00',
    
    -- Opt-out Management
    respect_opt_outs BOOLEAN DEFAULT true,
    opt_out_keywords TEXT[] DEFAULT ARRAY['STOP', 'UNSUBSCRIBE', 'CANCEL'],
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_practice_automation_settings_practice ON practice_automation_settings(practice_id);

-- Triggers
-- 1. update_practice_automation_settings_updated_at (BEFORE UPDATE)
-- 2. validate_business_hours_trigger (BEFORE INSERT, UPDATE)
```

### 7.5 `follow_up_templates` - Medical Follow-up Configuration
**Created**: 2024-12-01 13:00:00 UTC | **Last Modified**: 2025-01-10 11:00:00 UTC
```sql
CREATE TABLE public.follow_up_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    
    -- Template Info
    template_name TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    icd10_codes TEXT[],
    
    -- Follow-up Schedule
    follow_ups JSONB NOT NULL DEFAULT '[]',
    /* Format:
    [{
        "days_after": 7,
        "message_type": "checkup_reminder",
        "sms_template_id": "uuid",
        "email_template_id": "uuid",
        "required": true
    }]
    */
    
    -- Rules
    applies_to_age_min INTEGER,
    applies_to_age_max INTEGER,
    applies_to_gender TEXT,
    priority TEXT DEFAULT 'normal',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_follow_up_templates_practice ON follow_up_templates(practice_id);
CREATE INDEX idx_follow_up_templates_condition ON follow_up_templates(condition_type);
CREATE INDEX idx_follow_up_templates_active ON follow_up_templates(practice_id) WHERE is_active = true;
```

---

## 🏢 PRACTICE MANAGEMENT TABLES (15 tables)

### 8.1 `practices` - Medical Practice/Clinic Entities
**Created**: 2024-05-15 08:30:00 UTC | **Last Modified**: 2025-01-11 15:20:00 UTC
```sql
CREATE TABLE public.practices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    practice_name TEXT NOT NULL,
    legal_name TEXT,
    practice_type TEXT NOT NULL CHECK (practice_type IN (
        'medical', 'dental', 'specialist', 'allied_health', 
        'veterinary', 'aesthetic', 'wellness'
    )),
    registration_number TEXT UNIQUE,
    tax_number TEXT,
    
    -- Contact Information
    primary_phone TEXT NOT NULL,
    secondary_phone TEXT,
    fax_number TEXT,
    email TEXT NOT NULL,
    website TEXT,
    
    -- Address
    physical_address TEXT NOT NULL,
    physical_suburb TEXT,
    physical_city TEXT NOT NULL,
    physical_state TEXT,
    physical_postal_code TEXT,
    physical_country TEXT DEFAULT 'Namibia',
    
    -- Postal Address
    postal_address TEXT,
    postal_suburb TEXT,
    postal_city TEXT,
    postal_state TEXT,
    postal_code TEXT,
    postal_country TEXT DEFAULT 'Namibia',
    
    -- Operating Hours
    operating_hours JSONB DEFAULT '{}',
    /* Format:
    {
        "monday": {"open": "08:00", "close": "17:00"},
        "tuesday": {"open": "08:00", "close": "17:00"},
        ...
    }
    */
    
    -- Banking Details
    bank_name TEXT,
    bank_branch TEXT,
    bank_account_number TEXT,
    bank_account_type TEXT,
    bank_branch_code TEXT,
    
    -- Settings
    currency TEXT DEFAULT 'NAD',
    timezone TEXT DEFAULT 'Africa/Windhoek',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    language TEXT DEFAULT 'en',
    
    -- Branding
    logo_url TEXT,
    primary_color TEXT DEFAULT '#1e40af',
    secondary_color TEXT DEFAULT '#3b82f6',
    
    -- Features
    features JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    
    -- Subscription
    subscription_plan TEXT DEFAULT 'trial',
    subscription_status TEXT DEFAULT 'active',
    trial_ends_at DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    onboarded_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_practices_type ON practices(practice_type);
CREATE INDEX idx_practices_active ON practices(is_active);
CREATE INDEX idx_practices_subscription ON practices(subscription_status);

-- Triggers
-- 1. update_practices_updated_at (BEFORE UPDATE)
-- 2. create_default_settings_trigger (AFTER INSERT)
-- 3. update_last_activity_trigger (AFTER UPDATE)
```

### 8.2 `branches` - Practice Branch Locations
**Created**: 2024-06-01 10:30:00 UTC | **Last Modified**: 2025-01-08 13:00:00 UTC
```sql
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Branch Information
    branch_name TEXT NOT NULL,
    branch_code TEXT,
    is_main_branch BOOLEAN DEFAULT false,
    
    -- Contact
    phone TEXT NOT NULL,
    email TEXT,
    fax TEXT,
    
    -- Address
    address TEXT NOT NULL,
    suburb TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Namibia',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Operating Hours
    operating_hours JSONB DEFAULT '{}',
    
    -- Manager
    branch_manager_id UUID REFERENCES users(id),
    
    -- Facilities
    facilities JSONB DEFAULT '[]',
    /* Format: ["parking", "wheelchair_access", "pharmacy", "laboratory", "xray"] */
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    opened_date DATE,
    closed_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_branches_practice ON branches(practice_id);
CREATE INDEX idx_branches_active ON branches(practice_id) WHERE is_active = true;
CREATE INDEX idx_branches_main ON branches(practice_id) WHERE is_main_branch = true;

-- Unique constraint
CREATE UNIQUE INDEX idx_branches_one_main ON branches(practice_id) WHERE is_main_branch = true;

-- Triggers
-- 1. ensure_one_main_branch_trigger (BEFORE INSERT, UPDATE)
-- 2. update_branches_updated_at (BEFORE UPDATE)
```

### 8.3 `doctor_branch_schedules` - Doctor Availability by Branch
**Created**: 2024-06-15 14:00:00 UTC | **Last Modified**: 2025-01-10 09:30:00 UTC
```sql
CREATE TABLE public.doctor_branch_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES users(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Schedule Type
    schedule_type TEXT DEFAULT 'regular' CHECK (schedule_type IN (
        'regular', 'temporary', 'overtime', 'on_call'
    )),
    
    -- Days
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    specific_date DATE,
    
    -- Time Slots
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Breaks
    break_start TIME,
    break_end TIME,
    
    -- Appointment Settings
    slot_duration_minutes INTEGER DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0,
    max_appointments INTEGER,
    
    -- Services
    services_offered TEXT[],
    consultation_types TEXT[],
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    notes TEXT
);

-- Indexes
CREATE INDEX idx_doctor_schedules_doctor ON doctor_branch_schedules(doctor_id);
CREATE INDEX idx_doctor_schedules_branch ON doctor_branch_schedules(branch_id);
CREATE INDEX idx_doctor_schedules_day ON doctor_branch_schedules(day_of_week);
CREATE INDEX idx_doctor_schedules_date ON doctor_branch_schedules(specific_date);
CREATE INDEX idx_doctor_schedules_active ON doctor_branch_schedules(doctor_id, branch_id) WHERE is_active = true;

-- Triggers
-- 1. validate_schedule_times_trigger (BEFORE INSERT, UPDATE)
-- 2. check_schedule_conflicts_trigger (BEFORE INSERT, UPDATE)
-- 3. update_doctor_branch_schedules_updated_at (BEFORE UPDATE)
```

### 8.4 `practice_settings` - Configuration Store
**Created**: 2024-07-01 12:00:00 UTC | **Last Modified**: 2025-01-11 14:00:00 UTC
```sql
CREATE TABLE public.practice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) UNIQUE NOT NULL,
    
    -- General Settings
    general_settings JSONB DEFAULT '{}',
    
    -- Clinical Settings
    clinical_settings JSONB DEFAULT '{
        "consultation_duration": 30,
        "enable_telemedicine": false,
        "require_vitals": true,
        "diagnosis_coding": "ICD10"
    }',
    
    -- Billing Settings
    billing_settings JSONB DEFAULT '{
        "tax_rate": 15,
        "payment_terms": 7,
        "enable_medical_aid": true,
        "invoice_prefix": "INV",
        "automatic_invoicing": true
    }',
    
    -- Communication Settings
    communication_settings JSONB DEFAULT '{
        "sms_sender_id": "ONEHEALTH",
        "email_from_name": null,
        "email_from_address": null,
        "appointment_reminder_hours": 24
    }',
    
    -- Queue Management
    queue_settings JSONB DEFAULT '{
        "enable_queue": true,
        "queue_display": true,
        "average_consultation_time": 30,
        "max_wait_time_minutes": 120
    }',
    
    -- Document Settings
    document_settings JSONB DEFAULT '{
        "letterhead_enabled": true,
        "include_logo": true,
        "footer_text": null,
        "prescription_template": "default"
    }',
    
    -- Integration Settings
    integration_settings JSONB DEFAULT '{}',
    
    -- Feature Flags
    features JSONB DEFAULT '{
        "inventory_management": false,
        "hr_management": true,
        "expense_tracking": true,
        "social_media": false,
        "ai_insights": false
    }',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_practice_settings_practice ON practice_settings(practice_id);

-- Triggers
-- 1. update_practice_settings_updated_at (BEFORE UPDATE)
-- 2. merge_settings_trigger (BEFORE UPDATE)
```

### 8.5 `practice_inventory` - Medical Supplies & Stock
**Created**: 2024-08-01 11:00:00 UTC | **Last Modified**: 2025-01-10 10:00:00 UTC
```sql
CREATE TABLE public.practice_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    
    -- Item Details
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    brand TEXT,
    manufacturer TEXT,
    
    -- Description
    description TEXT,
    unit_of_measure TEXT NOT NULL,
    pack_size INTEGER DEFAULT 1,
    
    -- Stock Levels
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    maximum_stock DECIMAL(10,2),
    reorder_level DECIMAL(10,2),
    reorder_quantity DECIMAL(10,2),
    
    -- Pricing
    cost_price DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    markup_percentage DECIMAL(5,2),
    
    -- Expiry
    is_expirable BOOLEAN DEFAULT false,
    expiry_date DATE,
    batch_number TEXT,
    lot_number TEXT,
    
    -- Storage
    storage_location TEXT,
    storage_conditions TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_consumable BOOLEAN DEFAULT true,
    is_prescription_required BOOLEAN DEFAULT false,
    
    -- Tracking
    last_purchase_date DATE,
    last_purchase_price DECIMAL(10,2),
    last_used_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_inventory_practice ON practice_inventory(practice_id);
CREATE INDEX idx_inventory_branch ON practice_inventory(branch_id);
CREATE INDEX idx_inventory_code ON practice_inventory(item_code);
CREATE INDEX idx_inventory_category ON practice_inventory(category);
CREATE INDEX idx_inventory_low_stock ON practice_inventory(practice_id) WHERE current_stock <= reorder_level;
CREATE INDEX idx_inventory_expiry ON practice_inventory(expiry_date) WHERE is_expirable = true;

-- Triggers
-- 1. update_inventory_stock_trigger (AFTER UPDATE OF current_stock)
-- 2. check_low_stock_trigger (AFTER UPDATE OF current_stock)
-- 3. update_practice_inventory_updated_at (BEFORE UPDATE)
```

### 8.6 `practice_expenses` - Expense Tracking
**Created**: 2024-08-15 13:30:00 UTC | **Last Modified**: 2025-01-10 12:00:00 UTC
```sql
CREATE TABLE public.practice_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    
    -- Expense Details
    expense_date DATE NOT NULL,
    expense_category TEXT NOT NULL CHECK (expense_category IN (
        'rent', 'utilities', 'salaries', 'supplies', 'equipment',
        'maintenance', 'insurance', 'marketing', 'professional_fees',
        'transport', 'communication', 'other'
    )),
    sub_category TEXT,
    description TEXT NOT NULL,
    
    -- Financial
    amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'NAD',
    
    -- Payment
    payment_method TEXT CHECK (payment_method IN (
        'cash', 'bank_transfer', 'credit_card', 'cheque', 'petty_cash'
    )),
    payment_reference TEXT,
    paid_to TEXT,
    
    -- Documentation
    invoice_number TEXT,
    receipt_number TEXT,
    attachment_urls JSONB DEFAULT '[]',
    
    -- Approval
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Recurring
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT,
    next_due_date DATE,
    
    -- Status
    status TEXT DEFAULT 'paid' CHECK (status IN (
        'pending', 'approved', 'paid', 'cancelled', 'reimbursed'
    )),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    notes TEXT
);

-- Indexes
CREATE INDEX idx_expenses_practice ON practice_expenses(practice_id);
CREATE INDEX idx_expenses_branch ON practice_expenses(branch_id);
CREATE INDEX idx_expenses_date ON practice_expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON practice_expenses(expense_category);
CREATE INDEX idx_expenses_status ON practice_expenses(status);
CREATE INDEX idx_expenses_recurring ON practice_expenses(next_due_date) WHERE is_recurring = true;

-- Triggers
-- 1. calculate_expense_total_trigger (BEFORE INSERT, UPDATE)
-- 2. update_practice_expenses_updated_at (BEFORE UPDATE)
-- 3. expense_approval_notification_trigger (AFTER UPDATE OF status)
```

### 8.7 `practice_social_accounts` - Social Media Integration
**Created**: 2024-10-01 09:00:00 UTC | **Last Modified**: 2025-01-10 16:30:00 UTC
```sql
CREATE TABLE public.practice_social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Platform
    platform TEXT NOT NULL CHECK (platform IN (
        'google_business', 'facebook', 'instagram', 'twitter',
        'linkedin', 'youtube', 'whatsapp_business', 'tiktok'
    )),
    
    -- Account Details
    account_id TEXT NOT NULL,
    account_name TEXT,
    account_handle TEXT,
    profile_url TEXT,
    
    -- Authentication
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Permissions
    permissions JSONB DEFAULT '[]',
    scope TEXT,
    
    -- Features
    features_enabled JSONB DEFAULT '{
        "auto_post": false,
        "review_monitoring": true,
        "message_sync": false,
        "analytics": true
    }',
    
    -- Stats
    followers_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    average_rating DECIMAL(3,2),
    review_count INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    connection_status TEXT DEFAULT 'connected',
    last_synced_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    connected_by UUID REFERENCES users(id),
    disconnected_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_social_accounts_practice ON practice_social_accounts(practice_id);
CREATE INDEX idx_social_accounts_platform ON practice_social_accounts(platform);
CREATE INDEX idx_social_accounts_active ON practice_social_accounts(practice_id) WHERE is_active = true;

-- Unique constraint
CREATE UNIQUE INDEX idx_social_accounts_unique ON practice_social_accounts(practice_id, platform, account_id);

-- Triggers
-- 1. update_practice_social_accounts_updated_at (BEFORE UPDATE)
-- 2. refresh_oauth_token_trigger (CALLED BY CRON)
```

### 8.8 `practice_oauth_credentials` - OAuth Integration Store
**Created**: 2024-10-15 11:00:00 UTC | **Last Modified**: 2025-01-10 17:00:00 UTC
```sql
CREATE TABLE public.practice_oauth_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Provider
    provider TEXT NOT NULL CHECK (provider IN (
        'google', 'microsoft', 'facebook', 'instagram', 
        'twitter', 'linkedin', 'zoom', 'calendly'
    )),
    
    -- OAuth Details
    client_id TEXT,
    client_secret TEXT,
    redirect_uri TEXT,
    
    -- Tokens
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ,
    
    -- Scope & Permissions
    scope TEXT,
    granted_permissions JSONB DEFAULT '[]',
    
    -- User Info
    oauth_user_id TEXT,
    oauth_user_email TEXT,
    oauth_user_name TEXT,
    
    -- Usage
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'expired', 'revoked', 'error'
    )),
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    authorized_by UUID REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_oauth_credentials_practice ON practice_oauth_credentials(practice_id);
CREATE INDEX idx_oauth_credentials_provider ON practice_oauth_credentials(provider);
CREATE INDEX idx_oauth_credentials_active ON practice_oauth_credentials(practice_id) WHERE is_active = true;

-- Unique constraint
CREATE UNIQUE INDEX idx_oauth_credentials_unique ON practice_oauth_credentials(practice_id, provider, oauth_user_id);

-- Triggers
-- 1. encrypt_oauth_tokens_trigger (BEFORE INSERT, UPDATE)
-- 2. update_practice_oauth_credentials_updated_at (BEFORE UPDATE)
-- 3. refresh_expired_tokens_trigger (CALLED BY CRON)
```

---

## 📊 SYSTEM & ADMIN TABLES (11 tables)

### 9.1 `admin_roles` - Role Definitions
**Created**: 2024-05-15 09:00:00 UTC | **Last Modified**: 2024-11-20 10:30:00 UTC
```sql
CREATE TABLE public.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT UNIQUE NOT NULL,
    role_code TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- Permissions
    permissions JSONB NOT NULL DEFAULT '{}',
    /* Format:
    {
        "patients": ["create", "read", "update", "delete"],
        "appointments": ["create", "read", "update"],
        "billing": ["read"],
        ...
    }
    */
    
    -- Hierarchy
    parent_role_id UUID REFERENCES admin_roles(id),
    hierarchy_level INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system_role BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_admin_roles_code ON admin_roles(role_code);
CREATE INDEX idx_admin_roles_active ON admin_roles(is_active);

-- Default roles
INSERT INTO admin_roles (role_name, role_code, is_system_role) VALUES
('Super Administrator', 'super_admin', true),
('Practice Administrator', 'practice_admin', true),
('Doctor', 'doctor', true),
('Nurse', 'nurse', true),
('Receptionist', 'receptionist', true),
('Billing Clerk', 'billing', true);

-- Triggers
-- 1. update_admin_roles_updated_at (BEFORE UPDATE)
-- 2. prevent_system_role_deletion_trigger (BEFORE DELETE)
```

### 9.2 `audit_logs` - System Audit Trail
**Created**: 2024-05-15 09:30:00 UTC | **Last Modified**: 2025-01-11 12:00:00 UTC
```sql
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT')),
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- Context
    user_id UUID REFERENCES users(id),
    practice_id UUID REFERENCES practices(id),
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    query_execution_time_ms INTEGER
);

-- Indexes
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Partitioning by month
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 9.3 `system_notifications` - System-Wide Notifications
**Created**: 2024-09-01 14:00:00 UTC | **Last Modified**: 2025-01-10 15:30:00 UTC
```sql
CREATE TABLE public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Notification Details
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'system_update', 'maintenance', 'security_alert', 'feature_announcement',
        'billing_notice', 'compliance_reminder', 'performance_alert'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Targeting
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN (
        'all', 'admins', 'doctors', 'staff', 'specific_practices'
    )),
    target_practices UUID[],
    
    -- Scheduling
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    
    -- Priority
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    requires_acknowledgment BOOLEAN DEFAULT false,
    
    -- Display
    display_type TEXT DEFAULT 'banner' CHECK (display_type IN (
        'banner', 'modal', 'toast', 'email'
    )),
    action_url TEXT,
    action_text TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_system_notifications_active ON system_notifications(start_date, end_date) WHERE is_active = true;
CREATE INDEX idx_system_notifications_type ON system_notifications(notification_type);
CREATE INDEX idx_system_notifications_priority ON system_notifications(priority);

-- Triggers
-- 1. update_system_notifications_updated_at (BEFORE UPDATE)
-- 2. send_critical_notification_trigger (AFTER INSERT WHERE priority = 'critical')
```

---

This is Part 3 covering Automation, Practice Management, and System tables. Continue with Part 4?