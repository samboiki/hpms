#!/usr/bin/env node

/**
 * Performance Engine Agent
 * 
 * MISSION: Optimize React components and database queries for sub-200ms performance
 * FOCUS: Healthcare applications - appointment schedulers, patient lists, medical forms
 * TARGET: Lightning-fast user experience for medical professionals
 */

import { IntelligentAgent } from '../shared/agent-base.js';
import { HpmsPatterns } from '../shared/hpms-patterns.js';
import { readFile } from 'fs/promises';

export class PerformanceEngineAgent extends IntelligentAgent {
  constructor() {
    super({
      id: 'performance-engine',
      name: '⚡ Performance Engine Agent',
      hpmsContext: {
        optimizationTargets: [
          'appointment-scheduler',
          'patient-list',
          'medical-forms',
          'visit-management',
          'invoice-processing'
        ],
        performanceGoals: {
          targetLoadTime: 200, // ms
          targetRenderTime: 50, // ms
          targetQueryTime: 100, // ms
          targetBundleSize: 500 // KB
        }
      }
    });
    
    this.performancePatterns = {
      // React Performance Anti-patterns
      unmemoizedComponents: /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{(?!.*React\.memo)/,
      inlineFunctions: /onClick=\{(?:\(\)\s*=>\s*|function)/,
      expensiveMapWithoutKeys: /\.map\([^)]+\)\s*(?!.*key=)/,
      largeListsWithoutVirtualization: /\.map\([^)]+\)[\s\S]{0,100}(patients|visits|appointments|invoices)/,
      unnecessaryRerenders: /useState.*\.map.*setState/,
      
      // Database Performance Issues
      selectStar: /SELECT\s+\*/i,
      missingIndexes: /(WHERE|JOIN)\s+\w+\s+(?!.*INDEX)/i,
      nPlusOneQueries: /await.*\.from\(.*\).*map.*await/,
      noLimitOnQueries: /\.from\(.*\)(?!.*\.limit\()/,
      
      // HPMS-Specific Performance Issues
      unoptimizedPatientSearch: /patients.*filter.*toLowerCase/,
      heavyMedicalCalculations: /(calculateAge|calculateDosage|processVitals).*map/,
      synchronousFileUploads: /await.*upload.*(?!Promise\.all)/,
      unbatchedNotifications: /sendSMS.*forEach|sendEmail.*forEach/
    };
    
    this.optimizationStrategies = {
      memoization: 'React.memo() with proper comparison',
      virtualization: 'react-window or react-virtualized for long lists',
      lazyLoading: 'React.lazy() and Suspense boundaries',
      queryOptimization: 'Proper indexes and query planning',
      caching: 'React Query with stale-while-revalidate',
      debouncing: 'Debounced search and form inputs',
      bundleSplitting: 'Dynamic imports for route-based splitting'
    };
  }
  
  async analyzePerformance(content, filename) {
    const issues = [];
    const metrics = await this.measurePerformance(content, filename);
    
    // Detect React performance issues
    if (this.performancePatterns.unmemoizedComponents.test(content)) {
      const componentMatch = content.match(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/);
      if (componentMatch && !content.includes(`React.memo(${componentMatch[1]})`)) {
        issues.push({
          type: 'react-performance',
          severity: 'high',
          issue: `Unmemoized component: ${componentMatch[1]}`,
          recommendation: `Wrap with React.memo() for performance`,
          fix: this.generateMemoFix(componentMatch[1], content)
        });
      }
    }
    
    // Check for inline functions causing unnecessary rerenders
    const inlineFunctions = content.match(this.performancePatterns.inlineFunctions);
    if (inlineFunctions) {
      issues.push({
        type: 'react-performance',
        severity: 'medium',
        issue: 'Inline function creates new reference on each render',
        recommendation: 'Use useCallback() or move function outside render',
        fix: this.generateCallbackFix(content)
      });
    }
    
    // HPMS-specific: Large medical lists without virtualization
    if (this.performancePatterns.largeListsWithoutVirtualization.test(content)) {
      issues.push({
        type: 'hpms-performance',
        severity: 'critical',
        issue: 'Large medical data list without virtualization',
        recommendation: 'Implement react-window for patient/visit lists',
        fix: this.generateVirtualizationFix(content)
      });
    }
    
    // Database performance checks
    if (filename.includes('service') || filename.includes('api')) {
      if (this.performancePatterns.selectStar.test(content)) {
        issues.push({
          type: 'database-performance',
          severity: 'high',
          issue: 'SELECT * query detected - fetching unnecessary data',
          recommendation: 'Specify exact columns needed',
          fix: this.generateSelectOptimization(content)
        });
      }
      
      if (this.performancePatterns.nPlusOneQueries.test(content)) {
        issues.push({
          type: 'database-performance',
          severity: 'critical',
          issue: 'N+1 query pattern detected',
          recommendation: 'Use JOIN or batch queries',
          fix: this.generateBatchQueryFix(content)
        });
      }
    }
    
    // HPMS Communication performance
    if (this.performancePatterns.unbatchedNotifications.test(content)) {
      issues.push({
        type: 'communication-performance',
        severity: 'high',
        issue: 'Unbatched SMS/Email sending detected',
        recommendation: 'Use Promise.all() for parallel sending',
        fix: this.generateBatchCommunicationFix(content)
      });
    }
    
    return {
      issues,
      metrics,
      optimizationScore: this.calculateOptimizationScore(issues, metrics)
    };
  }
  
  async measurePerformance(content, filename) {
    // Simulate performance metrics based on code analysis
    const metrics = {
      estimatedLoadTime: 150,
      componentComplexity: this.calculateComplexity(content),
      renderCycles: this.estimateRenderCycles(content),
      bundleImpact: this.estimateBundleSize(content)
    };
    
    // Adjust for HPMS-specific components
    if (filename.includes('Visit') || filename.includes('Patient')) {
      metrics.estimatedLoadTime += 50; // Medical components are heavier
    }
    
    return metrics;
  }
  
  calculateComplexity(content) {
    let complexity = 0;
    complexity += (content.match(/useState/g) || []).length * 10;
    complexity += (content.match(/useEffect/g) || []).length * 20;
    complexity += (content.match(/\.map\(/g) || []).length * 15;
    complexity += (content.match(/async\s+function/g) || []).length * 25;
    return complexity;
  }
  
  estimateRenderCycles(content) {
    let cycles = 1;
    cycles += (content.match(/setState/g) || []).length;
    cycles += (content.match(/forceUpdate/g) || []).length * 2;
    return cycles;
  }
  
  estimateBundleSize(content) {
    // Rough estimate in KB
    const baseSize = content.length / 1024;
    const imports = (content.match(/import/g) || []).length * 5;
    return Math.round(baseSize + imports);
  }
  
  calculateOptimizationScore(issues, metrics) {
    let score = 100;
    
    // Deduct points for issues
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 20;
      else if (issue.severity === 'high') score -= 10;
      else score -= 5;
    });
    
    // Deduct for poor metrics
    if (metrics.estimatedLoadTime > 200) score -= 15;
    if (metrics.componentComplexity > 100) score -= 10;
    if (metrics.bundleImpact > 50) score -= 10;
    
    return Math.max(0, score);
  }
  
  generateMemoFix(componentName, content) {
    return {
      description: `Wrap ${componentName} with React.memo()`,
      code: `export const ${componentName} = React.memo(${componentName}Original);`,
      impact: 'Prevents unnecessary re-renders when props haven\'t changed'
    };
  }
  
  generateCallbackFix(content) {
    return {
      description: 'Replace inline function with useCallback',
      code: `const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);

// Then use: onClick={handleClick}`,
      impact: 'Stable function reference prevents child re-renders'
    };
  }
  
  generateVirtualizationFix(content) {
    return {
      description: 'Implement react-window for large lists',
      code: `import { FixedSizeList } from 'react-window';

const VirtualizedPatientList = ({ patients }) => (
  <FixedSizeList
    height={600}
    itemCount={patients.length}
    itemSize={80}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <PatientCard patient={patients[index]} />
      </div>
    )}
  </FixedSizeList>
);`,
      impact: 'Only renders visible items, handles thousands of records smoothly'
    };
  }
  
  generateSelectOptimization(content) {
    return {
      description: 'Optimize SELECT query with specific columns',
      code: `// Instead of SELECT *
const { data } = await supabase
  .from('patients')
  .select('id, full_name, system_patient_reference_number, date_of_birth')
  .eq('practice_id', practiceId)
  .limit(50);`,
      impact: 'Reduces data transfer by 70%, faster queries'
    };
  }
  
  generateBatchQueryFix(content) {
    return {
      description: 'Fix N+1 query with proper JOIN',
      code: `// Instead of looping queries
const { data: patientsWithVisits } = await supabase
  .from('patients')
  .select(\`
    *,
    visits!inner (
      id,
      visit_date,
      visit_type,
      status
    )
  \`)
  .eq('practice_id', practiceId)
  .order('visits.visit_date', { ascending: false });`,
      impact: '1 query instead of N+1, 95% performance improvement'
    };
  }
  
  generateBatchCommunicationFix(content) {
    return {
      description: 'Batch SMS/Email sending',
      code: `// Parallel communication sending
const notifications = patients.map(patient => ({
  practiceId,
  recipientPhone: patient.phone,
  messageContent: generateMessage(patient),
  messageType: 'appointment_reminder',
  patientId: patient.id
}));

// Send all in parallel
const results = await Promise.all(
  notifications.map(notification => 
    communicationService.sendSMS(notification)
  )
);`,
      impact: 'Parallel execution reduces time by 80%'
    };
  }
  
  async execute(hookData) {
    const content = hookData.tool_result?.content || '';
    const filename = hookData.tool_input?.file_path || 'unknown';
    
    if (!content || filename === 'unknown') {
      return { action: 'skip', reason: 'No content to analyze' };
    }
    
    const analysis = await this.analyzePerformance(content, filename);
    
    if (analysis.issues.length === 0 && analysis.optimizationScore >= 90) {
      return {
        action: 'approve',
        reason: 'Performance is excellent',
        metrics: analysis.metrics
      };
    }
    
    // Generate performance report
    const report = {
      action: 'optimize',
      issues: analysis.issues,
      metrics: analysis.metrics,
      score: analysis.optimizationScore,
      recommendations: this.generateOptimizationPlan(analysis)
    };
    
    // Store performance metrics for tracking
    await this.storeKnowledge(`performance-${filename}`, {
      timestamp: new Date().toISOString(),
      score: analysis.optimizationScore,
      metrics: analysis.metrics,
      improvements: analysis.issues.map(i => i.recommendation)
    });
    
    return report;
  }
  
  generateOptimizationPlan(analysis) {
    const plan = [];
    
    if (analysis.issues.some(i => i.type === 'react-performance')) {
      plan.push({
        category: 'React Optimization',
        steps: [
          'Implement React.memo() for pure components',
          'Use useCallback() for event handlers',
          'Add useMemo() for expensive calculations',
          'Implement proper key props in lists'
        ]
      });
    }
    
    if (analysis.issues.some(i => i.type === 'database-performance')) {
      plan.push({
        category: 'Database Optimization',
        steps: [
          'Add proper indexes to frequently queried columns',
          'Use specific column selection instead of SELECT *',
          'Implement query result caching',
          'Use database views for complex queries'
        ]
      });
    }
    
    if (analysis.issues.some(i => i.type === 'hpms-performance')) {
      plan.push({
        category: 'HPMS-Specific Optimization',
        steps: [
          'Virtualize patient and appointment lists',
          'Implement pagination for medical records',
          'Cache practice settings and user preferences',
          'Optimize medical form validation'
        ]
      });
    }
    
    return plan;
  }
}

// Export for use in coordinator
export default PerformanceEngineAgent;