# OneHealth Automation Testing & Evaluation System

## Overview

This enhanced workflow includes comprehensive testing and evaluation capabilities inspired by advanced n8n patterns. It allows you to:

1. **Validate data** before processing
2. **Test automations** without sending real messages  
3. **Collect performance metrics**
4. **Log all test results** for analysis
5. **Handle errors gracefully** with detailed logging

## Key Features

### 1. Data Validation Node
The workflow now validates all incoming automation data:
- Checks for required fields (queue_id, practice_id, etc.)
- Validates email formats
- Validates phone number formats (international)
- Checks template availability
- Generates warnings and errors

### 2. Test Mode Support
Enable test mode to simulate sending without actually sending:
```sql
-- Create test automation
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode  -- New field!
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Patient',
    'patientEmail', 'test@example.com',
    'patientPhone', '+27123456789'
  ),
  NOW(),
  'queued',
  true  -- Test mode enabled!
);
```

### 3. Performance Metrics Collection
The workflow automatically collects:
- Total items processed
- Processing time per batch
- Average time per item
- Success/failure rates for SMS and Email
- Test vs production counts
- Overall success rate percentage

### 4. Comprehensive Logging

#### Test Logs Table
Stores validation errors, test results, and warnings:
```sql
SELECT * FROM automation_test_logs
WHERE practice_id = 'your-practice-id'
ORDER BY created_at DESC;
```

#### Performance Logs Table
Tracks performance metrics over time:
```sql
SELECT 
  timestamp,
  metrics->>'total_processed' as items,
  metrics->>'processing_time_ms' as time_ms,
  metrics->>'success_rate' as success_rate
FROM automation_performance_logs
ORDER BY timestamp DESC
LIMIT 10;
```

## Testing Workflows

### 1. Validation Testing
Test with invalid data to see validation in action:
```sql
-- Missing email
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Patient',
    'patientPhone': '+27123456789'
    -- Missing patientEmail!
  ),
  NOW(),
  'queued'
);
```

### 2. Load Testing
Test with multiple items:
```sql
-- Insert 50 test automations
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode
)
SELECT 
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Patient ' || generate_series,
    'patientEmail', 'test' || generate_series || '@example.com',
    'patientPhone', '+2712345' || lpad(generate_series::text, 4, '0')
  ),
  NOW(),
  'queued',
  true
FROM generate_series(1, 50);
```

### 3. Error Simulation
Test error handling:
```sql
-- Invalid phone format
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Patient',
    'patientEmail', 'test@example.com',
    'patientPhone', 'invalid-phone'  -- Will trigger warning
  ),
  NOW(),
  'queued',
  true
);
```

## Monitoring Dashboard Queries

### 1. Validation Error Summary
```sql
SELECT 
  test_type,
  COUNT(*) as error_count,
  jsonb_array_length(errors) as avg_errors,
  jsonb_array_length(warnings) as avg_warnings
FROM automation_test_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY test_type;
```

### 2. Performance Trends
```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  AVG((metrics->>'processing_time_ms')::int) as avg_time_ms,
  SUM((metrics->>'total_processed')::int) as total_processed,
  AVG((metrics->>'success_rate')::float) as avg_success_rate
FROM automation_performance_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

### 3. Test vs Production Ratio
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE test_mode = true) as test_count,
  COUNT(*) FILTER (WHERE test_mode = false OR test_mode IS NULL) as prod_count,
  ROUND(
    COUNT(*) FILTER (WHERE test_mode = true)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as test_percentage
FROM automation_queue
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;
```

## Best Practices

### 1. Always Test First
Before deploying new automation types:
1. Create test entries with `test_mode = true`
2. Verify templates render correctly
3. Check validation passes
4. Review test logs

### 2. Monitor Performance
Set up alerts for:
- Processing time > 5 seconds per item
- Success rate < 90%
- Validation errors > 10% of items

### 3. Regular Testing
Schedule regular test runs:
```sql
-- Weekly test automation
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode,
  metadata
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'system.test',
  jsonb_build_object(
    'test_type', 'weekly_check',
    'patientEmail', 'monitor@onehealth.com',
    'patientPhone', '+27123456789'
  ),
  NOW(),
  'queued',
  true,
  jsonb_build_object('automated_test', true)
);
```

## Troubleshooting

### Common Issues

1. **Validation Failures**
   - Check `automation_test_logs` for specific errors
   - Verify payload structure matches requirements
   - Ensure templates are configured

2. **Performance Issues**
   - Review `automation_performance_logs`
   - Check batch size (default: 10)
   - Monitor database query times

3. **Test Mode Not Working**
   - Ensure `test_mode` column exists
   - Check workflow recognizes test flag
   - Verify test results are logged

## Integration with Monitoring

### Grafana Dashboard
Create visualizations for:
- Real-time processing metrics
- Error rate trends
- Test coverage percentage
- Performance benchmarks

### Alerts
Set up n8n alerts for:
- Validation error spikes
- Performance degradation
- Failed automation percentage
- Test coverage drops

## Future Enhancements

1. **A/B Testing**
   - Test different templates
   - Compare engagement rates
   - Automatic winner selection

2. **Synthetic Monitoring**
   - Scheduled test runs
   - End-to-end validation
   - SLA tracking

3. **Advanced Analytics**
   - ML-based anomaly detection
   - Predictive failure analysis
   - Optimization recommendations