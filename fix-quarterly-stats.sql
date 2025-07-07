-- Fix get_dashboard_stats function to include quarterly invoice calculations
-- This adds the missing quarterly fields that the finance card expects

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_practice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
  current_quarter INT;
  quarter_start_date DATE;
  quarter_end_date DATE;
BEGIN
  -- Calculate current quarter and date ranges
  current_quarter := EXTRACT(QUARTER FROM CURRENT_DATE);
  quarter_start_date := DATE_TRUNC('quarter', CURRENT_DATE)::DATE;
  quarter_end_date := (DATE_TRUNC('quarter', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day')::DATE;

  -- Build comprehensive stats as JSONB
  WITH patient_stats AS (
    SELECT 
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN LOWER(p.gender) = 'male' THEN p.id END) as male,
      COUNT(DISTINCT CASE WHEN LOWER(p.gender) = 'female' THEN p.id END) as female,
      COUNT(DISTINCT CASE WHEN p.created_at >= date_trunc('month', CURRENT_DATE) THEN p.id END) as new_this_month,
      COUNT(DISTINCT CASE WHEN p.created_at >= date_trunc('week', CURRENT_DATE) THEN p.id END) as new_this_week,
      COALESCE(AVG(EXTRACT(YEAR FROM age(p.date_of_birth))), 0) as average_age,
      COUNT(DISTINCT p.id) as active_patients
    FROM patients p
    WHERE p.practice_id = p_practice_id
  ),
  encounter_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN v.status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN v.status = 'pending' OR v.status = 'in-progress' OR (v.is_scheduled AND NOT v.is_confirmed) THEN 1 END) as pending,
      COUNT(CASE WHEN v.status = 'in-progress' THEN 1 END) as in_progress,
      COUNT(CASE WHEN v.scheduled_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as new_this_month,
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN v.status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100)
        ELSE 0 
      END as percentage_completed,
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN v.status = 'pending' OR v.status = 'in-progress' OR (v.is_scheduled AND NOT v.is_confirmed) THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100)
        ELSE 0 
      END as percentage_pending
    FROM visits v
    WHERE v.practice_id = p_practice_id
  ),
  invoice_stats AS (
    SELECT 
      -- Total invoice stats
      COUNT(*) as total_invoices,
      COALESCE(SUM(i.total), 0) as total_revenue,
      COUNT(CASE WHEN i.payment_status = 'paid' THEN 1 END) as paid_invoices,
      COUNT(CASE WHEN i.payment_status != 'paid' THEN 1 END) as outstanding_invoices,
      
      -- Quarterly invoice stats
      COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date THEN 1 END) as quarterly_invoices,
      COALESCE(SUM(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date THEN i.total ELSE 0 END), 0) as quarterly_revenue,
      COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date AND i.payment_status = 'paid' THEN 1 END) as quarterly_paid_invoices,
      COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date AND i.payment_status != 'paid' THEN 1 END) as quarterly_outstanding_invoices,
      
      -- Quarterly percentages
      CASE 
        WHEN COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date AND i.payment_status = 'paid' THEN 1 END)::NUMERIC / COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date THEN 1 END)::NUMERIC) * 100)
        ELSE 0 
      END as quarterly_percentage_paid,
      CASE 
        WHEN COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date AND i.payment_status != 'paid' THEN 1 END)::NUMERIC / COUNT(CASE WHEN i.issue_date >= quarter_start_date AND i.issue_date <= quarter_end_date THEN 1 END)::NUMERIC) * 100)
        ELSE 0 
      END as quarterly_percentage_outstanding
    FROM invoices_enhanced i
    WHERE i.practice_id = p_practice_id
  )
  SELECT jsonb_build_object(
    'patient', jsonb_build_object(
      'total', COALESCE(ps.total, 0),
      'male', COALESCE(ps.male, 0),
      'female', COALESCE(ps.female, 0),
      'newThisMonth', COALESCE(ps.new_this_month, 0),
      'newThisWeek', COALESCE(ps.new_this_week, 0),
      'averageAge', COALESCE(ps.average_age, 0),
      'activePatients', COALESCE(ps.active_patients, 0)
    ),
    'encounter', jsonb_build_object(
      'total', COALESCE(es.total, 0),
      'completed', COALESCE(es.completed, 0),
      'pending', COALESCE(es.pending, 0),
      'inProgress', COALESCE(es.in_progress, 0),
      'percentageCompleted', COALESCE(es.percentage_completed, 0),
      'percentagePending', COALESCE(es.percentage_pending, 0),
      'newThisMonth', COALESCE(es.new_this_month, 0)
    ),
    'invoice', jsonb_build_object(
      'totalInvoices', COALESCE(inv.total_invoices, 0),
      'totalRevenue', COALESCE(inv.total_revenue, 0),
      'quarterlyRevenue', COALESCE(inv.quarterly_revenue, 0),
      'quarterlyInvoices', COALESCE(inv.quarterly_invoices, 0),
      'quarterlyPaidInvoices', COALESCE(inv.quarterly_paid_invoices, 0),
      'quarterlyOutstandingInvoices', COALESCE(inv.quarterly_outstanding_invoices, 0),
      'quarterlyPercentagePaid', COALESCE(inv.quarterly_percentage_paid, 0),
      'quarterlyPercentageOutstanding', COALESCE(inv.quarterly_percentage_outstanding, 0),
      'currentQuarter', current_quarter
    ),
    'lastRefreshed', to_jsonb(NOW())
  ) INTO result
  FROM patient_stats ps
  CROSS JOIN encounter_stats es
  CROSS JOIN invoice_stats inv;
  
  RETURN result;
END;
$$;