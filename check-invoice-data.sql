-- Check invoice data and quarterly calculations
SELECT 
  COUNT(*) as total_invoices,
  SUM(total::numeric) as total_revenue,
  AVG(total::numeric) as avg_invoice_amount,
  MIN(issue_date) as earliest_invoice,
  MAX(issue_date) as latest_invoice,
  COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN payment_status != 'paid' THEN 1 END) as outstanding_count
FROM invoices_enhanced 
WHERE practice_id IS NOT NULL;