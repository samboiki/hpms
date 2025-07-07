-- Performance optimization for dashboard queries
-- This migration creates materialized views and optimized indexes

-- Create materialized view for dashboard statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats_mv AS
WITH practice_stats AS (
  SELECT 
    p.practice_id,
    COUNT(DISTINCT p.id) as total_patients,
    COUNT(DISTINCT CASE WHEN p.gender = 'male' THEN p.id END) as male_patients,
    COUNT(DISTINCT CASE WHEN p.gender = 'female' THEN p.id END) as female_patients,
    COUNT(DISTINCT CASE WHEN p.created_at >= date_trunc('month', CURRENT_DATE) THEN p.id END) as new_patients_this_month,
    COUNT(DISTINCT CASE WHEN p.created_at >= date_trunc('week', CURRENT_DATE) THEN p.id END) as new_patients_this_week,
    AVG(EXTRACT(YEAR FROM age(p.date_of_birth))) as average_age
  FROM patients p
  GROUP BY p.practice_id
),
visit_stats AS (
  SELECT 
    v.practice_id,
    COUNT(*) as total_visits,
    COUNT(CASE WHEN v.scheduled_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as visits_this_month,
    COUNT(CASE WHEN v.status = 'completed' THEN 1 END) as completed_visits,
    COUNT(CASE WHEN v.status = 'pending' OR (v.is_scheduled AND NOT v.is_confirmed) THEN 1 END) as pending_visits,
    COUNT(CASE WHEN v.status = 'in-progress' THEN 1 END) as in_progress_visits,
    COUNT(CASE WHEN v.scheduled_date = CURRENT_DATE THEN 1 END) as visits_today
  FROM visits v
  WHERE v.practice_id IS NOT NULL
  GROUP BY v.practice_id
),
appointment_stats AS (
  SELECT 
    a.practice_id,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN a.date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as appointments_this_month,
    COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_appointments,
    COUNT(CASE WHEN a.date = CURRENT_DATE THEN 1 END) as appointments_today
  FROM appointments a
  WHERE a.practice_id IS NOT NULL
  GROUP BY a.practice_id
),
invoice_stats AS (
  SELECT 
    i.practice_id,
    COUNT(*) as total_invoices,
    SUM(i.total) as total_revenue,
    COUNT(CASE WHEN i.payment_status = 'paid' THEN 1 END) as paid_invoices,
    COUNT(CASE WHEN i.payment_status != 'paid' THEN 1 END) as unpaid_invoices,
    SUM(CASE WHEN i.payment_status != 'paid' THEN i.total ELSE 0 END) as outstanding_amount,
    SUM(CASE WHEN i.issue_date >= date_trunc('month', CURRENT_DATE) THEN i.total ELSE 0 END) as revenue_this_month
  FROM invoices_enhanced i
  WHERE i.practice_id IS NOT NULL
  GROUP BY i.practice_id
)
SELECT 
  p.practice_id,
  -- Patient stats
  COALESCE(ps.total_patients, 0) as total_patients,
  COALESCE(ps.male_patients, 0) as male_patients,
  COALESCE(ps.female_patients, 0) as female_patients,
  COALESCE(ps.new_patients_this_month, 0) as new_patients_this_month,
  COALESCE(ps.new_patients_this_week, 0) as new_patients_this_week,
  COALESCE(ps.average_age, 0) as average_patient_age,
  -- Visit stats
  COALESCE(vs.total_visits, 0) as total_visits,
  COALESCE(vs.visits_this_month, 0) as visits_this_month,
  COALESCE(vs.completed_visits, 0) as completed_visits,
  COALESCE(vs.pending_visits, 0) as pending_visits,
  COALESCE(vs.in_progress_visits, 0) as in_progress_visits,
  COALESCE(vs.visits_today, 0) as visits_today,
  -- Appointment stats
  COALESCE(apt.total_appointments, 0) as total_appointments,
  COALESCE(apt.appointments_this_month, 0) as appointments_this_month,
  COALESCE(apt.pending_appointments, 0) as pending_appointments,
  COALESCE(apt.appointments_today, 0) as appointments_today,
  -- Invoice stats
  COALESCE(inv.total_invoices, 0) as total_invoices,
  COALESCE(inv.total_revenue, 0) as total_revenue,
  COALESCE(inv.paid_invoices, 0) as paid_invoices,
  COALESCE(inv.unpaid_invoices, 0) as unpaid_invoices,
  COALESCE(inv.outstanding_amount, 0) as outstanding_amount,
  COALESCE(inv.revenue_this_month, 0) as revenue_this_month,
  -- Timestamp
  NOW() as last_updated
FROM practices p
LEFT JOIN practice_stats ps ON p.id = ps.practice_id
LEFT JOIN visit_stats vs ON p.id = vs.practice_id
LEFT JOIN appointment_stats apt ON p.id = apt.practice_id
LEFT JOIN invoice_stats inv ON p.id = inv.practice_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_mv_practice_id ON dashboard_stats_mv(practice_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_practice_created ON patients(practice_id, created_at);
CREATE INDEX IF NOT EXISTS idx_patients_practice_gender ON patients(practice_id, gender);
CREATE INDEX IF NOT EXISTS idx_visits_practice_date ON visits(practice_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_practice_status ON visits(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_practice_date ON appointments(practice_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_practice_status ON appointments(practice_id, status);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_visits_composite ON visits(practice_id, scheduled_date, status, is_cancelled);
CREATE INDEX IF NOT EXISTS idx_patients_composite ON patients(practice_id, created_at, gender);

-- Create function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_mv;
END;
$$;

-- Create a scheduled job to refresh the materialized view every 5 minutes
-- Note: This requires pg_cron extension which may need to be enabled
-- SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', 'SELECT refresh_dashboard_stats()');

-- Create optimized function to get dashboard stats with caching
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_practice_id UUID)
RETURNS TABLE (
  total_patients INT,
  male_patients INT,
  female_patients INT,
  new_patients_this_month INT,
  new_patients_this_week INT,
  average_patient_age NUMERIC,
  total_visits INT,
  visits_this_month INT,
  completed_visits INT,
  pending_visits INT,
  in_progress_visits INT,
  visits_today INT,
  total_appointments INT,
  appointments_this_month INT,
  pending_appointments INT,
  appointments_today INT,
  total_invoices INT,
  total_revenue NUMERIC,
  paid_invoices INT,
  unpaid_invoices INT,
  outstanding_amount NUMERIC,
  revenue_this_month NUMERIC,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- First try to get from materialized view
  RETURN QUERY
  SELECT 
    ds.total_patients,
    ds.male_patients,
    ds.female_patients,
    ds.new_patients_this_month,
    ds.new_patients_this_week,
    ds.average_patient_age,
    ds.total_visits,
    ds.visits_this_month,
    ds.completed_visits,
    ds.pending_visits,
    ds.in_progress_visits,
    ds.visits_today,
    ds.total_appointments,
    ds.appointments_this_month,
    ds.pending_appointments,
    ds.appointments_today,
    ds.total_invoices,
    ds.total_revenue,
    ds.paid_invoices,
    ds.unpaid_invoices,
    ds.outstanding_amount,
    ds.revenue_this_month,
    ds.last_updated
  FROM dashboard_stats_mv ds
  WHERE ds.practice_id = p_practice_id
  AND ds.last_updated > NOW() - INTERVAL '10 minutes'; -- Use cached data if less than 10 minutes old
  
  -- If no recent data found, calculate fresh
  IF NOT FOUND THEN
    RETURN QUERY
    WITH practice_stats AS (
      SELECT 
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT CASE WHEN p.gender = 'male' THEN p.id END) as male_patients,
        COUNT(DISTINCT CASE WHEN p.gender = 'female' THEN p.id END) as female_patients,
        COUNT(DISTINCT CASE WHEN p.created_at >= date_trunc('month', CURRENT_DATE) THEN p.id END) as new_patients_this_month,
        COUNT(DISTINCT CASE WHEN p.created_at >= date_trunc('week', CURRENT_DATE) THEN p.id END) as new_patients_this_week,
        AVG(EXTRACT(YEAR FROM age(p.date_of_birth)))::NUMERIC as average_age
      FROM patients p
      WHERE p.practice_id = p_practice_id
    ),
    visit_stats AS (
      SELECT 
        COUNT(*) as total_visits,
        COUNT(CASE WHEN v.scheduled_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as visits_this_month,
        COUNT(CASE WHEN v.status = 'completed' THEN 1 END) as completed_visits,
        COUNT(CASE WHEN v.status = 'pending' OR (v.is_scheduled AND NOT v.is_confirmed) THEN 1 END) as pending_visits,
        COUNT(CASE WHEN v.status = 'in-progress' THEN 1 END) as in_progress_visits,
        COUNT(CASE WHEN v.scheduled_date = CURRENT_DATE THEN 1 END) as visits_today
      FROM visits v
      WHERE v.practice_id = p_practice_id
    ),
    appointment_stats AS (
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN a.date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as appointments_this_month,
        COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_appointments,
        COUNT(CASE WHEN a.date = CURRENT_DATE THEN 1 END) as appointments_today
      FROM appointments a
      WHERE a.practice_id = p_practice_id
    ),
    invoice_stats AS (
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(i.total), 0) as total_revenue,
        COUNT(CASE WHEN i.payment_status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN i.payment_status != 'paid' THEN 1 END) as unpaid_invoices,
        COALESCE(SUM(CASE WHEN i.payment_status != 'paid' THEN i.total ELSE 0 END), 0) as outstanding_amount,
        COALESCE(SUM(CASE WHEN i.issue_date >= date_trunc('month', CURRENT_DATE) THEN i.total ELSE 0 END), 0) as revenue_this_month
      FROM invoices_enhanced i
      WHERE i.practice_id = p_practice_id
    )
    SELECT 
      COALESCE(ps.total_patients, 0)::INT,
      COALESCE(ps.male_patients, 0)::INT,
      COALESCE(ps.female_patients, 0)::INT,
      COALESCE(ps.new_patients_this_month, 0)::INT,
      COALESCE(ps.new_patients_this_week, 0)::INT,
      COALESCE(ps.average_age, 0),
      COALESCE(vs.total_visits, 0)::INT,
      COALESCE(vs.visits_this_month, 0)::INT,
      COALESCE(vs.completed_visits, 0)::INT,
      COALESCE(vs.pending_visits, 0)::INT,
      COALESCE(vs.in_progress_visits, 0)::INT,
      COALESCE(vs.visits_today, 0)::INT,
      COALESCE(apt.total_appointments, 0)::INT,
      COALESCE(apt.appointments_this_month, 0)::INT,
      COALESCE(apt.pending_appointments, 0)::INT,
      COALESCE(apt.appointments_today, 0)::INT,
      COALESCE(inv.total_invoices, 0)::INT,
      COALESCE(inv.total_revenue, 0),
      COALESCE(inv.paid_invoices, 0)::INT,
      COALESCE(inv.unpaid_invoices, 0)::INT,
      COALESCE(inv.outstanding_amount, 0),
      COALESCE(inv.revenue_this_month, 0),
      NOW()
    FROM practice_stats ps
    CROSS JOIN visit_stats vs
    CROSS JOIN appointment_stats apt
    CROSS JOIN invoice_stats inv;
  END IF;
END;
$$;

-- Grant permissions
GRANT SELECT ON dashboard_stats_mv TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID) TO authenticated;

-- Initial refresh
SELECT refresh_dashboard_stats();