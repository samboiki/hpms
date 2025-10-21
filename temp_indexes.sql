-- CRITICAL PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_practice_role ON users(practice_id, role);
CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status);
CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);
CREATE INDEX IF NOT EXISTS idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);
CREATE INDEX IF NOT EXISTS idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);
