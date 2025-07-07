-- 🏥 HPMS Database Health Fix Script
-- Generated: 2025-06-15T07:47:14.956Z
-- 
-- ⚠️  IMPORTANT: Review and test in development before applying to production!
-- 📋 Always backup your database before running this script!

-- =============================================================================
-- 🚨 CRITICAL FIXES (Run these first - they fix data integrity issues)
-- =============================================================================


-- MISSING_FOREIGN_KEY_CONSTRAINT - public
-- Column admin_user_id in public appears to be a foreign key but has no constraint
-- Add foreign key constraint for public.admin_user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE public ADD CONSTRAINT fk_public_admin_user_id 
--   FOREIGN KEY (admin_user_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - public
-- Column resource_id in public appears to be a foreign key but has no constraint
-- Add foreign key constraint for public.resource_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE public ADD CONSTRAINT fk_public_resource_id 
--   FOREIGN KEY (resource_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - admin_sessions
-- Column admin_user_id in admin_sessions appears to be a foreign key but has no constraint
-- Add foreign key constraint for admin_sessions.admin_user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE admin_sessions ADD CONSTRAINT fk_admin_sessions_admin_user_id 
--   FOREIGN KEY (admin_user_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - admin_users
-- Column role_id in admin_users appears to be a foreign key but has no constraint
-- Add foreign key constraint for admin_users.role_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE admin_users ADD CONSTRAINT fk_admin_users_role_id 
--   FOREIGN KEY (role_id) REFERENCES referenced_table(id);

-- MISSING_REQUIRED_HEALTHCARE_FIELDS - appointments
-- Appointments table missing critical fields: appointment_date
-- Add missing appointment fields

-- MISSING_FOREIGN_KEY_CONSTRAINT - appointments
-- Column doctor_id in appointments appears to be a foreign key but has no constraint
-- Add foreign key constraint for appointments.doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE appointments ADD CONSTRAINT fk_appointments_doctor_id 
--   FOREIGN KEY (doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - appointments
-- Column patient_id in appointments appears to be a foreign key but has no constraint
-- Add foreign key constraint for appointments.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE appointments ADD CONSTRAINT fk_appointments_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - appointments
-- Column practice_id in appointments appears to be a foreign key but has no constraint
-- Add foreign key constraint for appointments.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE appointments ADD CONSTRAINT fk_appointments_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - audit_logs
-- Column record_id in audit_logs appears to be a foreign key but has no constraint
-- Add foreign key constraint for audit_logs.record_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_record_id 
--   FOREIGN KEY (record_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - audit_logs
-- Column user_id in audit_logs appears to be a foreign key but has no constraint
-- Add foreign key constraint for audit_logs.user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user_id 
--   FOREIGN KEY (user_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_details
-- Column batch_header_id in batch_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_details.batch_header_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_details ADD CONSTRAINT fk_batch_details_batch_header_id 
--   FOREIGN KEY (batch_header_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_details
-- Column invoice_id in batch_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_details.invoice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_details ADD CONSTRAINT fk_batch_details_invoice_id 
--   FOREIGN KEY (invoice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_details
-- Column patient_id in batch_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_details.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_details ADD CONSTRAINT fk_batch_details_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_details
-- Column transaction_id in batch_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_details.transaction_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_details ADD CONSTRAINT fk_batch_details_transaction_id 
--   FOREIGN KEY (transaction_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_details
-- Column visit_id in batch_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_details.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_details ADD CONSTRAINT fk_batch_details_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_details
-- Column visit_service_id in batch_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_details.visit_service_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_details ADD CONSTRAINT fk_batch_details_visit_service_id 
--   FOREIGN KEY (visit_service_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_headers
-- Column practice_id in batch_headers appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_headers.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_headers ADD CONSTRAINT fk_batch_headers_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_submissions
-- Column batch_header_id in batch_submissions appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_submissions.batch_header_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_submissions ADD CONSTRAINT fk_batch_submissions_batch_header_id 
--   FOREIGN KEY (batch_header_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_submissions
-- Column email_id in batch_submissions appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_submissions.email_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_submissions ADD CONSTRAINT fk_batch_submissions_email_id 
--   FOREIGN KEY (email_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_submissions
-- Column practice_id in batch_submissions appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_submissions.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_submissions ADD CONSTRAINT fk_batch_submissions_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_trailer
-- Column batch_header_id in batch_trailer appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_trailer.batch_header_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_trailer ADD CONSTRAINT fk_batch_trailer_batch_header_id 
--   FOREIGN KEY (batch_header_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoice_services
-- Column invoice_id in invoice_services appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoice_services.invoice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoice_services ADD CONSTRAINT fk_invoice_services_invoice_id 
--   FOREIGN KEY (invoice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoice_services
-- Column tariff_id in invoice_services appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoice_services.tariff_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoice_services ADD CONSTRAINT fk_invoice_services_tariff_id 
--   FOREIGN KEY (tariff_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoices_enhanced
-- Column batch_id in invoices_enhanced appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoices_enhanced.batch_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoices_enhanced ADD CONSTRAINT fk_invoices_enhanced_batch_id 
--   FOREIGN KEY (batch_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoices_enhanced
-- Column patient_id in invoices_enhanced appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoices_enhanced.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoices_enhanced ADD CONSTRAINT fk_invoices_enhanced_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoices_enhanced
-- Column practice_id in invoices_enhanced appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoices_enhanced.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoices_enhanced ADD CONSTRAINT fk_invoices_enhanced_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoices_enhanced
-- Column practitioner_id in invoices_enhanced appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoices_enhanced.practitioner_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoices_enhanced ADD CONSTRAINT fk_invoices_enhanced_practitioner_id 
--   FOREIGN KEY (practitioner_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - invoices_enhanced
-- Column visit_id in invoices_enhanced appears to be a foreign key but has no constraint
-- Add foreign key constraint for invoices_enhanced.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE invoices_enhanced ADD CONSTRAINT fk_invoices_enhanced_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - lab_requests
-- Column lab_result_id in lab_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for lab_requests.lab_result_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE lab_requests ADD CONSTRAINT fk_lab_requests_lab_result_id 
--   FOREIGN KEY (lab_result_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - lab_requests
-- Column practice_id in lab_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for lab_requests.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE lab_requests ADD CONSTRAINT fk_lab_requests_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - lab_requests
-- Column requesting_doctor_id in lab_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for lab_requests.requesting_doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE lab_requests ADD CONSTRAINT fk_lab_requests_requesting_doctor_id 
--   FOREIGN KEY (requesting_doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - lab_requests
-- Column visit_id in lab_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for lab_requests.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE lab_requests ADD CONSTRAINT fk_lab_requests_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_REQUIRED_HEALTHCARE_FIELDS - lab_results
-- Lab results table missing critical fields: patient_id, test_name, result_value
-- Add missing lab result fields

-- MISSING_FOREIGN_KEY_CONSTRAINT - lab_results
-- Column visit_id in lab_results appears to be a foreign key but has no constraint
-- Add foreign key constraint for lab_results.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - media_files
-- Column visit_id in media_files appears to be a foreign key but has no constraint
-- Add foreign key constraint for media_files.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE media_files ADD CONSTRAINT fk_media_files_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - media_requests
-- Column media_result_id in media_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for media_requests.media_result_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE media_requests ADD CONSTRAINT fk_media_requests_media_result_id 
--   FOREIGN KEY (media_result_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - media_requests
-- Column practice_id in media_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for media_requests.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE media_requests ADD CONSTRAINT fk_media_requests_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - media_requests
-- Column requesting_doctor_id in media_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for media_requests.requesting_doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE media_requests ADD CONSTRAINT fk_media_requests_requesting_doctor_id 
--   FOREIGN KEY (requesting_doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - media_requests
-- Column visit_id in media_requests appears to be a foreign key but has no constraint
-- Add foreign key constraint for media_requests.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE media_requests ADD CONSTRAINT fk_media_requests_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - medical_aid_details
-- Column medical_aid_provider_id in medical_aid_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for medical_aid_details.medical_aid_provider_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE medical_aid_details ADD CONSTRAINT fk_medical_aid_details_medical_aid_provider_id 
--   FOREIGN KEY (medical_aid_provider_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - medical_aid_details
-- Column patient_id in medical_aid_details appears to be a foreign key but has no constraint
-- Add foreign key constraint for medical_aid_details.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE medical_aid_details ADD CONSTRAINT fk_medical_aid_details_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - medical_aid_schemes
-- Column provider_id in medical_aid_schemes appears to be a foreign key but has no constraint
-- Add foreign key constraint for medical_aid_schemes.provider_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE medical_aid_schemes ADD CONSTRAINT fk_medical_aid_schemes_provider_id 
--   FOREIGN KEY (provider_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - medical_aid_service_prices
-- Column provider_id in medical_aid_service_prices appears to be a foreign key but has no constraint
-- Add foreign key constraint for medical_aid_service_prices.provider_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE medical_aid_service_prices ADD CONSTRAINT fk_medical_aid_service_prices_provider_id 
--   FOREIGN KEY (provider_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - medical_aid_service_prices
-- Column scheme_id in medical_aid_service_prices appears to be a foreign key but has no constraint
-- Add foreign key constraint for medical_aid_service_prices.scheme_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE medical_aid_service_prices ADD CONSTRAINT fk_medical_aid_service_prices_scheme_id 
--   FOREIGN KEY (scheme_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - messages
-- Column template_id in messages appears to be a foreign key but has no constraint
-- Add foreign key constraint for messages.template_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE messages ADD CONSTRAINT fk_messages_template_id 
--   FOREIGN KEY (template_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - next_of_kin
-- Column patient_id in next_of_kin appears to be a foreign key but has no constraint
-- Add foreign key constraint for next_of_kin.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE next_of_kin ADD CONSTRAINT fk_next_of_kin_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - patient_documents
-- Column patient_id in patient_documents appears to be a foreign key but has no constraint
-- Add foreign key constraint for patient_documents.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE patient_documents ADD CONSTRAINT fk_patient_documents_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - patient_documents
-- Column visit_id in patient_documents appears to be a foreign key but has no constraint
-- Add foreign key constraint for patient_documents.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE patient_documents ADD CONSTRAINT fk_patient_documents_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - patients
-- Column practice_id in patients appears to be a foreign key but has no constraint
-- Add foreign key constraint for patients.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE patients ADD CONSTRAINT fk_patients_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_analytics
-- Column practice_id in practice_analytics appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_analytics.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_analytics ADD CONSTRAINT fk_practice_analytics_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_invitations
-- Column practice_id in practice_invitations appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_invitations.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_invitations ADD CONSTRAINT fk_practice_invitations_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_notification_templates
-- Column practice_id in practice_notification_templates appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_notification_templates.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_notification_templates ADD CONSTRAINT fk_practice_notification_templates_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_settings
-- Column practice_id in practice_settings appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_settings.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_settings ADD CONSTRAINT fk_practice_settings_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_sms_subscriptions
-- Column plan_id in practice_sms_subscriptions appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_sms_subscriptions.plan_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_sms_subscriptions ADD CONSTRAINT fk_practice_sms_subscriptions_plan_id 
--   FOREIGN KEY (plan_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_sms_subscriptions
-- Column practice_id in practice_sms_subscriptions appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_sms_subscriptions.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_sms_subscriptions ADD CONSTRAINT fk_practice_sms_subscriptions_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_staff
-- Column practice_id in practice_staff appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_staff.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_staff ADD CONSTRAINT fk_practice_staff_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_staff
-- Column user_id in practice_staff appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_staff.user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_staff ADD CONSTRAINT fk_practice_staff_user_id 
--   FOREIGN KEY (user_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_tariffs
-- Column practice_type_id in practice_tariffs appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_tariffs.practice_type_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_tariffs ADD CONSTRAINT fk_practice_tariffs_practice_type_id 
--   FOREIGN KEY (practice_type_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practices
-- Column admin_user_id in practices appears to be a foreign key but has no constraint
-- Add foreign key constraint for practices.admin_user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practices ADD CONSTRAINT fk_practices_admin_user_id 
--   FOREIGN KEY (admin_user_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practices
-- Column practice_type_id in practices appears to be a foreign key but has no constraint
-- Add foreign key constraint for practices.practice_type_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practices ADD CONSTRAINT fk_practices_practice_type_id 
--   FOREIGN KEY (practice_type_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - sms_portal_config
-- Column practice_id in sms_portal_config appears to be a foreign key but has no constraint
-- Add foreign key constraint for sms_portal_config.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE sms_portal_config ADD CONSTRAINT fk_sms_portal_config_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - sms_portal_config
-- Column sender_id in sms_portal_config appears to be a foreign key but has no constraint
-- Add foreign key constraint for sms_portal_config.sender_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE sms_portal_config ADD CONSTRAINT fk_sms_portal_config_sender_id 
--   FOREIGN KEY (sender_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - sms_templates
-- Column practice_id in sms_templates appears to be a foreign key but has no constraint
-- Add foreign key constraint for sms_templates.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE sms_templates ADD CONSTRAINT fk_sms_templates_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - sms_usage_logs
-- Column practice_id in sms_usage_logs appears to be a foreign key but has no constraint
-- Add foreign key constraint for sms_usage_logs.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE sms_usage_logs ADD CONSTRAINT fk_sms_usage_logs_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - sms_usage_logs
-- Column subscription_id in sms_usage_logs appears to be a foreign key but has no constraint
-- Add foreign key constraint for sms_usage_logs.subscription_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE sms_usage_logs ADD CONSTRAINT fk_sms_usage_logs_subscription_id 
--   FOREIGN KEY (subscription_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - users
-- Column practice_id in users appears to be a foreign key but has no constraint
-- Add foreign key constraint for users.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE users ADD CONSTRAINT fk_users_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visit_media
-- Column visit_id in visit_media appears to be a foreign key but has no constraint
-- Add foreign key constraint for visit_media.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visit_media ADD CONSTRAINT fk_visit_media_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visits
-- Column appointment_id in visits appears to be a foreign key but has no constraint
-- Add foreign key constraint for visits.appointment_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visits ADD CONSTRAINT fk_visits_appointment_id 
--   FOREIGN KEY (appointment_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visits
-- Column doctor_id in visits appears to be a foreign key but has no constraint
-- Add foreign key constraint for visits.doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visits ADD CONSTRAINT fk_visits_doctor_id 
--   FOREIGN KEY (doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visits
-- Column patient_id in visits appears to be a foreign key but has no constraint
-- Add foreign key constraint for visits.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visits ADD CONSTRAINT fk_visits_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visits
-- Column practice_id in visits appears to be a foreign key but has no constraint
-- Add foreign key constraint for visits.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visits ADD CONSTRAINT fk_visits_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - vitals
-- Column visit_id in vitals appears to be a foreign key but has no constraint
-- Add foreign key constraint for vitals.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE vitals ADD CONSTRAINT fk_vitals_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - Views
-- Column admin_user_id in Views appears to be a foreign key but has no constraint
-- Add foreign key constraint for Views.admin_user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE Views ADD CONSTRAINT fk_Views_admin_user_id 
--   FOREIGN KEY (admin_user_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - appointment_analytics
-- Table appointment_analytics has no 'id' primary key column
ALTER TABLE appointment_analytics ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - appointment_analytics
-- Column practice_id in appointment_analytics appears to be a foreign key but has no constraint
-- Add foreign key constraint for appointment_analytics.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE appointment_analytics ADD CONSTRAINT fk_appointment_analytics_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - batch_management_view
-- Table batch_management_view has no 'id' primary key column
ALTER TABLE batch_management_view ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_management_view
-- Column batch_id in batch_management_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_management_view.batch_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_management_view ADD CONSTRAINT fk_batch_management_view_batch_id 
--   FOREIGN KEY (batch_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_submission_summary
-- Column batch_header_id in batch_submission_summary appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_submission_summary.batch_header_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_submission_summary ADD CONSTRAINT fk_batch_submission_summary_batch_header_id 
--   FOREIGN KEY (batch_header_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - batch_submission_summary
-- Column practice_id in batch_submission_summary appears to be a foreign key but has no constraint
-- Add foreign key constraint for batch_submission_summary.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE batch_submission_summary ADD CONSTRAINT fk_batch_submission_summary_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - daily_financial_kpis
-- Table daily_financial_kpis has no 'id' primary key column
ALTER TABLE daily_financial_kpis ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_PRIMARY_KEY - financial_dashboard_fast
-- Table financial_dashboard_fast has no 'id' primary key column
ALTER TABLE financial_dashboard_fast ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - frequent_tariff_codes
-- Column practice_type_id in frequent_tariff_codes appears to be a foreign key but has no constraint
-- Add foreign key constraint for frequent_tariff_codes.practice_type_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE frequent_tariff_codes ADD CONSTRAINT fk_frequent_tariff_codes_practice_type_id 
--   FOREIGN KEY (practice_type_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - monthly_revenue_summary
-- Table monthly_revenue_summary has no 'id' primary key column
ALTER TABLE monthly_revenue_summary ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - patient_audit_logs
-- Column record_id in patient_audit_logs appears to be a foreign key but has no constraint
-- Add foreign key constraint for patient_audit_logs.record_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE patient_audit_logs ADD CONSTRAINT fk_patient_audit_logs_record_id 
--   FOREIGN KEY (record_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - patient_audit_logs
-- Column user_id in patient_audit_logs appears to be a foreign key but has no constraint
-- Add foreign key constraint for patient_audit_logs.user_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE patient_audit_logs ADD CONSTRAINT fk_patient_audit_logs_user_id 
--   FOREIGN KEY (user_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - payment_status_analytics
-- Table payment_status_analytics has no 'id' primary key column
ALTER TABLE payment_status_analytics ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - pending_requests_view
-- Column patient_id in pending_requests_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for pending_requests_view.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE pending_requests_view ADD CONSTRAINT fk_pending_requests_view_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - pending_requests_view
-- Column requesting_doctor_id in pending_requests_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for pending_requests_view.requesting_doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE pending_requests_view ADD CONSTRAINT fk_pending_requests_view_requesting_doctor_id 
--   FOREIGN KEY (requesting_doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - pending_requests_view
-- Column visit_id in pending_requests_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for pending_requests_view.visit_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE pending_requests_view ADD CONSTRAINT fk_pending_requests_view_visit_id 
--   FOREIGN KEY (visit_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - practice_tariffs_with_types
-- Column practice_type_id in practice_tariffs_with_types appears to be a foreign key but has no constraint
-- Add foreign key constraint for practice_tariffs_with_types.practice_type_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE practice_tariffs_with_types ADD CONSTRAINT fk_practice_tariffs_with_types_practice_type_id 
--   FOREIGN KEY (practice_type_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - service_performance_summary
-- Table service_performance_summary has no 'id' primary key column
ALTER TABLE service_performance_summary ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_PRIMARY_KEY - sms_analytics
-- Table sms_analytics has no 'id' primary key column
ALTER TABLE sms_analytics ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - sms_analytics
-- Column practice_id in sms_analytics appears to be a foreign key but has no constraint
-- Add foreign key constraint for sms_analytics.practice_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE sms_analytics ADD CONSTRAINT fk_sms_analytics_practice_id 
--   FOREIGN KEY (practice_id) REFERENCES referenced_table(id);

-- MISSING_PRIMARY_KEY - top_services_aggregate
-- Table top_services_aggregate has no 'id' primary key column
ALTER TABLE top_services_aggregate ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- MISSING_FOREIGN_KEY_CONSTRAINT - visit_details_view
-- Column appointment_id in visit_details_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for visit_details_view.appointment_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visit_details_view ADD CONSTRAINT fk_visit_details_view_appointment_id 
--   FOREIGN KEY (appointment_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visit_details_view
-- Column doctor_id in visit_details_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for visit_details_view.doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visit_details_view ADD CONSTRAINT fk_visit_details_view_doctor_id 
--   FOREIGN KEY (doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visit_details_view
-- Column patient_id in visit_details_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for visit_details_view.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visit_details_view ADD CONSTRAINT fk_visit_details_view_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visit_timeline_view
-- Column doctor_id in visit_timeline_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for visit_timeline_view.doctor_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visit_timeline_view ADD CONSTRAINT fk_visit_timeline_view_doctor_id 
--   FOREIGN KEY (doctor_id) REFERENCES referenced_table(id);

-- MISSING_FOREIGN_KEY_CONSTRAINT - visit_timeline_view
-- Column patient_id in visit_timeline_view appears to be a foreign key but has no constraint
-- Add foreign key constraint for visit_timeline_view.patient_id
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE visit_timeline_view ADD CONSTRAINT fk_visit_timeline_view_patient_id 
--   FOREIGN KEY (patient_id) REFERENCES referenced_table(id);



-- =============================================================================
-- ⚠️  MEDIUM PRIORITY FIXES (Audit trail and missing fields)
-- =============================================================================

-- ✅ No medium priority issues found!


-- =============================================================================
-- 🔧 GENERAL IMPROVEMENTS (Enhanced functionality)
-- =============================================================================

-- MISSING_AUDIT_TIMESTAMP - public
-- Table public missing updated_at for audit trail
ALTER TABLE public ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_public_updated_at 
  BEFORE UPDATE ON public
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - admin_roles
-- Table admin_roles missing updated_at for audit trail
ALTER TABLE admin_roles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_admin_roles_updated_at 
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - admin_sessions
-- Table admin_sessions missing updated_at for audit trail
ALTER TABLE admin_sessions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_admin_sessions_updated_at 
  BEFORE UPDATE ON admin_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - audit_logs
-- Table audit_logs missing updated_at for audit trail
ALTER TABLE audit_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_audit_logs_updated_at 
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - batch_trailer
-- Table batch_trailer missing updated_at for audit trail
ALTER TABLE batch_trailer ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_batch_trailer_updated_at 
  BEFORE UPDATE ON batch_trailer
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - invoice_services
-- Table invoice_services missing updated_at for audit trail
ALTER TABLE invoice_services ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_invoice_services_updated_at 
  BEFORE UPDATE ON invoice_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - lab_results
-- Table lab_results missing updated_at for audit trail
ALTER TABLE lab_results ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_lab_results_updated_at 
  BEFORE UPDATE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - medical_aid_schemes
-- Table medical_aid_schemes missing updated_at for audit trail
ALTER TABLE medical_aid_schemes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_medical_aid_schemes_updated_at 
  BEFORE UPDATE ON medical_aid_schemes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - medical_aid_service_prices
-- Table medical_aid_service_prices missing updated_at for audit trail
ALTER TABLE medical_aid_service_prices ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_medical_aid_service_prices_updated_at 
  BEFORE UPDATE ON medical_aid_service_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - next_of_kin
-- Table next_of_kin missing updated_at for audit trail
ALTER TABLE next_of_kin ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_next_of_kin_updated_at 
  BEFORE UPDATE ON next_of_kin
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - practice_invitations
-- Table practice_invitations missing updated_at for audit trail
ALTER TABLE practice_invitations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_practice_invitations_updated_at 
  BEFORE UPDATE ON practice_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - practice_staff
-- Table practice_staff missing updated_at for audit trail
ALTER TABLE practice_staff ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_practice_staff_updated_at 
  BEFORE UPDATE ON practice_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - sms_plans
-- Table sms_plans missing updated_at for audit trail
ALTER TABLE sms_plans ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_sms_plans_updated_at 
  BEFORE UPDATE ON sms_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - sms_usage_logs
-- Table sms_usage_logs missing updated_at for audit trail
ALTER TABLE sms_usage_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_sms_usage_logs_updated_at 
  BEFORE UPDATE ON sms_usage_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - users
-- Table users missing updated_at for audit trail
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - visit_media
-- Table visit_media missing updated_at for audit trail
ALTER TABLE visit_media ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_visit_media_updated_at 
  BEFORE UPDATE ON visit_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - appointment_analytics
-- Table appointment_analytics missing created_at for audit trail
ALTER TABLE appointment_analytics ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - appointment_analytics
-- Table appointment_analytics missing updated_at for audit trail
ALTER TABLE appointment_analytics ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_appointment_analytics_updated_at 
  BEFORE UPDATE ON appointment_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - batch_management_view
-- Table batch_management_view missing updated_at for audit trail
ALTER TABLE batch_management_view ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_batch_management_view_updated_at 
  BEFORE UPDATE ON batch_management_view
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - batch_submission_summary
-- Table batch_submission_summary missing created_at for audit trail
ALTER TABLE batch_submission_summary ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - batch_submission_summary
-- Table batch_submission_summary missing updated_at for audit trail
ALTER TABLE batch_submission_summary ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_batch_submission_summary_updated_at 
  BEFORE UPDATE ON batch_submission_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - daily_financial_kpis
-- Table daily_financial_kpis missing created_at for audit trail
ALTER TABLE daily_financial_kpis ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - daily_financial_kpis
-- Table daily_financial_kpis missing updated_at for audit trail
ALTER TABLE daily_financial_kpis ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_daily_financial_kpis_updated_at 
  BEFORE UPDATE ON daily_financial_kpis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - financial_dashboard_fast
-- Table financial_dashboard_fast missing created_at for audit trail
ALTER TABLE financial_dashboard_fast ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - financial_dashboard_fast
-- Table financial_dashboard_fast missing updated_at for audit trail
ALTER TABLE financial_dashboard_fast ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_financial_dashboard_fast_updated_at 
  BEFORE UPDATE ON financial_dashboard_fast
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - monthly_revenue_summary
-- Table monthly_revenue_summary missing created_at for audit trail
ALTER TABLE monthly_revenue_summary ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - monthly_revenue_summary
-- Table monthly_revenue_summary missing updated_at for audit trail
ALTER TABLE monthly_revenue_summary ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_monthly_revenue_summary_updated_at 
  BEFORE UPDATE ON monthly_revenue_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - patient_audit_logs
-- Table patient_audit_logs missing updated_at for audit trail
ALTER TABLE patient_audit_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_patient_audit_logs_updated_at 
  BEFORE UPDATE ON patient_audit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - payment_status_analytics
-- Table payment_status_analytics missing created_at for audit trail
ALTER TABLE payment_status_analytics ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - payment_status_analytics
-- Table payment_status_analytics missing updated_at for audit trail
ALTER TABLE payment_status_analytics ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_payment_status_analytics_updated_at 
  BEFORE UPDATE ON payment_status_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - pending_requests_view
-- Table pending_requests_view missing created_at for audit trail
ALTER TABLE pending_requests_view ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - pending_requests_view
-- Table pending_requests_view missing updated_at for audit trail
ALTER TABLE pending_requests_view ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_pending_requests_view_updated_at 
  BEFORE UPDATE ON pending_requests_view
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - service_performance_summary
-- Table service_performance_summary missing created_at for audit trail
ALTER TABLE service_performance_summary ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - service_performance_summary
-- Table service_performance_summary missing updated_at for audit trail
ALTER TABLE service_performance_summary ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_service_performance_summary_updated_at 
  BEFORE UPDATE ON service_performance_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - sms_analytics
-- Table sms_analytics missing created_at for audit trail
ALTER TABLE sms_analytics ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - sms_analytics
-- Table sms_analytics missing updated_at for audit trail
ALTER TABLE sms_analytics ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_sms_analytics_updated_at 
  BEFORE UPDATE ON sms_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING_AUDIT_TIMESTAMP - top_services_aggregate
-- Table top_services_aggregate missing created_at for audit trail
ALTER TABLE top_services_aggregate ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- MISSING_AUDIT_TIMESTAMP - top_services_aggregate
-- Table top_services_aggregate missing updated_at for audit trail
ALTER TABLE top_services_aggregate ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_top_services_aggregate_updated_at 
  BEFORE UPDATE ON top_services_aggregate
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- =============================================================================
-- 🔄 UTILITY FUNCTIONS (Triggers and automated updates)
-- =============================================================================

-- Create or update the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- 📊 PERFORMANCE INDEXES (Healthcare-optimized queries)
-- =============================================================================

-- These indexes are optimized for common healthcare workflows:
-- Patient searches, appointment scheduling, medical history, billing

-- Name-based patient searches: Index on last_name, first_name
CREATE INDEX IF NOT EXISTS idx_patients_last_name_first_name ON patients(last_name, first_name);

-- Age-based queries and validation: Index on date_of_birth
CREATE INDEX IF NOT EXISTS idx_patients_date_of_birth ON patients(date_of_birth);

-- ID number lookups: Index on id_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_id_number ON patients(id_number);

-- Appointment status filtering: Index on status
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Patient visit history: Index on patient_id, visit_date
CREATE INDEX IF NOT EXISTS idx_visits_patient_id_visit_date ON visits(patient_id, visit_date);

-- Daily patient load analysis: Index on visit_date
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);

-- Pending results tracking: Index on status
CREATE INDEX IF NOT EXISTS idx_lab_results_status ON lab_results(status);



-- =============================================================================
-- ✅ VERIFICATION QUERIES (Run these to verify the fixes)
-- =============================================================================

-- Check for tables without primary keys
SELECT table_name 
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = t.table_name 
      AND c.column_name = 'id'
  );

-- Check for tables without audit timestamps
SELECT table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = t.table_name AND column_name = 'created_at') as has_created_at,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = t.table_name AND column_name = 'updated_at') as has_updated_at
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 🎯 Success! Your HPMS database should now be optimized for healthcare workflows.
