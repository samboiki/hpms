-- Financial Analytics Performance Views
-- These views will dramatically improve loading performance by pre-calculating aggregates

-- 1. Monthly Revenue Summary View
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT 
    DATE_TRUNC('month', issue_date) as month,
    COUNT(*) as total_invoices,
    SUM(CAST(total AS NUMERIC)) as total_revenue,
    SUM(CAST(medical_aid_total AS NUMERIC)) as medical_aid_revenue,
    SUM(CAST(patient_total AS NUMERIC)) as self_pay_revenue,
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_invoices,
    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_invoices,
    AVG(CAST(total AS NUMERIC)) as avg_invoice_value
FROM invoices_enhanced 
WHERE issue_date IS NOT NULL
GROUP BY DATE_TRUNC('month', issue_date)
ORDER BY month DESC;

-- 2. Service Performance View
CREATE OR REPLACE VIEW service_performance_summary AS
SELECT 
    s.code,
    s.description,
    COUNT(*) as service_count,
    SUM(s.quantity) as total_quantity,
    SUM(CAST(s.total_price AS NUMERIC)) as total_revenue,
    SUM(CAST(s.medical_aid_covered AS NUMERIC)) as medical_aid_covered,
    SUM(CAST(s.patient_portion AS NUMERIC)) as patient_portion,
    AVG(CAST(s.unit_price AS NUMERIC)) as avg_unit_price,
    DATE_TRUNC('month', i.issue_date) as month
FROM invoice_services s
JOIN invoices_enhanced i ON s.invoice_id = i.id
WHERE i.issue_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY s.code, s.description, DATE_TRUNC('month', i.issue_date)
ORDER BY total_revenue DESC;

-- 3. Daily Financial KPIs View
CREATE OR REPLACE VIEW daily_financial_kpis AS
SELECT 
    issue_date,
    COUNT(*) as invoices_created,
    SUM(CAST(total AS NUMERIC)) as daily_revenue,
    SUM(CAST(medical_aid_total AS NUMERIC)) as daily_medical_aid,
    SUM(CAST(patient_total AS NUMERIC)) as daily_self_pay,
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as daily_paid,
    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as daily_pending
FROM invoices_enhanced 
WHERE issue_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY issue_date
ORDER BY issue_date DESC;

-- 4. Top Services Aggregate View
CREATE OR REPLACE VIEW top_services_aggregate AS
SELECT 
    s.description as service_name,
    s.code,
    COUNT(*) as frequency,
    SUM(CAST(s.total_price AS NUMERIC)) as total_revenue,
    AVG(CAST(s.unit_price AS NUMERIC)) as avg_price,
    SUM(s.quantity) as total_quantity,
    COUNT(DISTINCT s.invoice_id) as unique_invoices
FROM invoice_services s
JOIN invoices_enhanced i ON s.invoice_id = i.id
WHERE i.issue_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY s.description, s.code
ORDER BY total_revenue DESC
LIMIT 20;

-- 5. Payment Status Analytics View
CREATE OR REPLACE VIEW payment_status_analytics AS
SELECT 
    payment_status,
    COUNT(*) as invoice_count,
    SUM(CAST(total AS NUMERIC)) as total_amount,
    AVG(CAST(total AS NUMERIC)) as avg_amount,
    MIN(issue_date) as earliest_date,
    MAX(issue_date) as latest_date,
    DATE_TRUNC('month', issue_date) as month
FROM invoices_enhanced
WHERE issue_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY payment_status, DATE_TRUNC('month', issue_date)
ORDER BY month DESC, payment_status;

-- 6. Fast Financial Dashboard View (Main Performance Booster)
CREATE OR REPLACE VIEW financial_dashboard_fast AS
WITH current_period AS (
    SELECT 
        SUM(CAST(total AS NUMERIC)) as total_revenue,
        SUM(CAST(medical_aid_total AS NUMERIC)) as medical_aid_revenue,
        SUM(CAST(patient_total AS NUMERIC)) as self_pay_revenue,
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_invoices,
        SUM(CASE WHEN payment_status != 'paid' THEN CAST(total AS NUMERIC) ELSE 0 END) as outstanding_amount
    FROM invoices_enhanced 
    WHERE issue_date >= CURRENT_DATE - INTERVAL '30 days'
),
previous_period AS (
    SELECT 
        SUM(CAST(total AS NUMERIC)) as prev_revenue
    FROM invoices_enhanced 
    WHERE issue_date >= CURRENT_DATE - INTERVAL '60 days'
    AND issue_date < CURRENT_DATE - INTERVAL '30 days'
),
current_month AS (
    SELECT 
        SUM(CAST(total AS NUMERIC)) as monthly_revenue
    FROM invoices_enhanced 
    WHERE DATE_TRUNC('month', issue_date) = DATE_TRUNC('month', CURRENT_DATE)
)
SELECT 
    cp.*,
    pp.prev_revenue,
    cm.monthly_revenue,
    CASE 
        WHEN pp.prev_revenue > 0 THEN 
            ((cp.total_revenue - pp.prev_revenue) / pp.prev_revenue) * 100 
        ELSE 0 
    END as revenue_growth_percent,
    CASE 
        WHEN cp.total_invoices > 0 THEN 
            cp.total_revenue / cp.total_invoices 
        ELSE 0 
    END as avg_invoice_value
FROM current_period cp
CROSS JOIN previous_period pp
CROSS JOIN current_month cm;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_issue_date 
ON invoices_enhanced(issue_date) WHERE issue_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_payment_status 
ON invoices_enhanced(payment_status);

CREATE INDEX IF NOT EXISTS idx_invoice_services_description 
ON invoice_services(description);

-- Refresh these views (if using materialized views in production)
-- REFRESH MATERIALIZED VIEW monthly_revenue_summary;
-- REFRESH MATERIALIZED VIEW service_performance_summary;

GRANT SELECT ON monthly_revenue_summary TO authenticated;
GRANT SELECT ON service_performance_summary TO authenticated;
GRANT SELECT ON daily_financial_kpis TO authenticated;
GRANT SELECT ON top_services_aggregate TO authenticated;
GRANT SELECT ON payment_status_analytics TO authenticated;
GRANT SELECT ON financial_dashboard_fast TO authenticated;