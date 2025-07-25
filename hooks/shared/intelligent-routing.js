#!/usr/bin/env node
import { HPMS_PATTERNS, PatternDetectors } from './hpms-patterns.js';

/**
 * Intelligent Agent Routing System
 * 
 * Analyzes context and intelligently selects the optimal agents for maximum efficiency
 * Uses HPMS domain knowledge to make smart routing decisions
 */
export class IntelligentRouter {
  constructor() {
    this.routingCache = new Map();
    this.performanceMetrics = new Map();
    
    // Agent categories for intelligent routing
    this.agentCategories = {
      'system-architecture': ['schema-intelligence', 'workflow-tracker', 'coordinator', 'context-cache'],
      'code-quality': ['standards-enforcer', 'error-detective', 'import-doctor', 'type-guardian', 'code-review', 'refactoring-architect', 'code-smell-detector'],
      'performance': ['performance-engine', 'performance-profiler', 'offline-resilience', 'code-improvement'],
      'ui-ux': ['responsive-designer', 'mobile-architect', 'ui-modernizer', 'ux-flow-validator'],
      'security-compliance': ['security-auditor', 'compliance-guardian', 'privacy-hipaa', 'gateway-monitor'],
      'healthcare-domain': ['medical-validator', 'healthcare-optimizer', 'business-logic-validator'],
      'analytics-testing': ['usage-tracker', 'data-analyst', 'test-coverage', 'integration-testing'],
      'integration-deployment': ['api-validator', 'relationship-mapper', 'integration-specialist', 'deployment-readiness'],
      'ai-powered': ['ai-code-generation', 'documentation-generator']
    };
  }

  /**
   * Main routing function - selects optimal agents based on context
   */
  async routeAgents(context) {
    const startTime = Date.now();
    
    // Check cache for similar contexts
    const cacheKey = this.generateCacheKey(context);
    if (this.routingCache.has(cacheKey)) {
      const cached = this.routingCache.get(cacheKey);
      this.logRouting('cache-hit', cached.agents, Date.now() - startTime);
      return cached.agents;
    }

    // Analyze context for intelligent routing
    const analysis = this.analyzeContext(context);
    
    // Select agents based on analysis
    const selectedAgents = this.selectAgents(analysis);
    
    // Optimize execution order
    const optimizedOrder = this.optimizeExecutionOrder(selectedAgents, analysis);
    
    // Cache result
    this.routingCache.set(cacheKey, { 
      agents: optimizedOrder, 
      analysis, 
      timestamp: Date.now() 
    });
    
    const routingTime = Date.now() - startTime;
    this.logRouting('intelligent-selection', optimizedOrder, routingTime);
    
    return optimizedOrder;
  }

  /**
   * Deep context analysis using HPMS patterns
   */
  analyzeContext(context) {
    const analysis = {
      // Basic context
      tool: context.tool,
      fileType: this.detectFileType(context.file || ''),
      codeSize: (context.content || '').length,
      
      // HPMS domain analysis
      domain: this.analyzeDomain(context.content || ''),
      security: this.analyzeSecurityContext(context.content || ''),
      performance: this.analyzePerformanceContext(context.content || ''),
      medical: this.analyzeMedicalContext(context.content || ''),
      
      // Priority analysis
      urgency: this.calculateUrgency(context),
      complexity: this.calculateComplexity(context),
      risk: this.calculateRisk(context),
      
      // Agent requirements
      requiresRealtimeResponse: this.needsRealtimeResponse(context),
      requiresDeepAnalysis: this.needsDeepAnalysis(context),
      requiresAutoFix: this.needsAutoFix(context)
    };

    return analysis;
  }

  /**
   * Detect file type for context-aware routing
   */
  detectFileType(filename) {
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return 'react';
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.sql')) return 'sql';
    if (filename.includes('supabase/functions')) return 'edge-function';
    if (filename.includes('hooks/')) return 'hook';
    return 'unknown';
  }

  /**
   * Analyze HPMS domain context
   */
  analyzeDomain(code) {
    const domain = {
      isPatientRelated: false,
      isVisitRelated: false,
      isMedicalForm: false,
      isBillingRelated: false,
      isCommunicationRelated: false,
      isAppointmentRelated: false
    };

    // Patient-related patterns
    if (code.match(/patients?[.\s]|Patient[A-Z]/)) {
      domain.isPatientRelated = true;
    }

    // Visit-related patterns  
    if (code.match(/visits?[.\s]|Visit[A-Z]|appointment/i)) {
      domain.isVisitRelated = true;
      domain.isAppointmentRelated = true;
    }

    // Medical form detection
    if (code.match(HPMS_PATTERNS.COMPONENT_PATTERNS.premium.naming)) {
      domain.isMedicalForm = true;
    }

    // Communication patterns
    if (code.match(/sms|email|gateway|message/i)) {
      domain.isCommunicationRelated = true;
    }

    // Billing patterns
    if (code.match(/invoice|billing|payment|batch/i)) {
      domain.isBillingRelated = true;
    }

    return domain;
  }

  /**
   * Analyze security context for critical routing
   */
  analyzeSecurityContext(code) {
    const security = {
      hasCriticalIssues: false,
      hasPatientData: false,
      hasPracticeIsolation: false,
      hasGatewayUsage: false,
      violations: []
    };

    // Check for critical security violations
    security.violations = PatternDetectors.detectSecurityViolations(code);
    security.hasCriticalIssues = security.violations.some(v => v.severity === 'critical');

    // Patient data handling
    if (code.match(/patient.*(?:ssn|id_number|medical)/i)) {
      security.hasPatientData = true;
    }

    // Practice isolation
    if (code.match(/practice_id/)) {
      security.hasPracticeIsolation = true;
    }

    // Gateway usage
    if (code.match(/centralized-.*-gateway/)) {
      security.hasGatewayUsage = true;
    }

    return security;
  }

  /**
   * Analyze performance context
   */
  analyzePerformanceContext(code) {
    const performance = {
      hasPerformanceIssues: false,
      hasLargeLists: false,
      hasDatabaseQueries: false,
      hasUnoptimizedCode: false,
      issues: []
    };

    // Detect performance issues
    performance.issues = PatternDetectors.detectPerformanceIssues(code);
    performance.hasPerformanceIssues = performance.issues.length > 0;

    // Large list detection
    if (code.match(/\.map\s*\(/g) && code.length > 1000) {
      performance.hasLargeLists = true;
    }

    // Database query detection
    if (code.match(/SELECT|INSERT|UPDATE|DELETE/i)) {
      performance.hasDatabaseQueries = true;
    }

    // Unoptimized code patterns
    if (code.match(/\.map\((?!.*memo)/g)) {
      performance.hasUnoptimizedCode = true;
    }

    return performance;
  }

  /**
   * Analyze medical workflow context
   */
  analyzeMedicalContext(code) {
    const medical = {
      hasMedicalWorkflow: false,
      hasAppointmentFlow: false,
      hasVisitWorkflow: false,
      hasBillingProcess: false,
      violations: []
    };

    // Medical workflow detection
    medical.violations = PatternDetectors.detectMedicalWorkflowViolations(code);
    medical.hasMedicalWorkflow = medical.violations.length > 0;

    // Specific workflow detection
    if (code.match(/schedule|book|appointment/i)) {
      medical.hasAppointmentFlow = true;
    }

    if (code.match(/visit.*(?:start|complete|record)/i)) {
      medical.hasVisitWorkflow = true;
    }

    if (code.match(/invoice|billing|payment/i)) {
      medical.hasBillingProcess = true;
    }

    return medical;
  }

  /**
   * Calculate urgency based on context
   */
  calculateUrgency(context) {
    let urgency = 0;

    // Tool-based urgency
    if (context.tool === 'Edit' || context.tool === 'Write') urgency += 20;
    if (context.tool === 'MultiEdit') urgency += 30;

    // Content-based urgency
    const content = context.content || '';
    if (content.includes('error') || content.includes('Error')) urgency += 50;
    if (content.includes('critical') || content.includes('CRITICAL')) urgency += 70;
    if (content.includes('security') || content.includes('SECURITY')) urgency += 60;

    // HPMS-specific urgency
    if (content.includes('patient') && content.includes('practice_id')) urgency += 40;
    if (content.includes('centralized-') && content.includes('gateway')) urgency += 30;

    return Math.min(urgency, 100);
  }

  /**
   * Calculate complexity for agent selection
   */
  calculateComplexity(context) {
    const content = context.content || '';
    const lines = content.split('\n').length;
    const functions = (content.match(/function|=>/g) || []).length;
    const imports = (content.match(/^import/gm) || []).length;
    
    return Math.min((lines * 0.1) + (functions * 2) + (imports * 0.5), 100);
  }

  /**
   * Calculate risk level
   */
  calculateRisk(context) {
    let risk = 0;
    const content = context.content || '';

    // Security risks
    if (content.match(/practice_id.*\|\|/)) risk += 80;
    if (content.match(/smsportal|resend/i) && !content.includes('gateway')) risk += 70;
    
    // Medical workflow risks
    if (content.includes('visits') && content.includes('scheduled_date')) risk += 40;
    
    // Performance risks
    if (content.match(/SELECT \*/)) risk += 30;
    if (content.match(/\.map\((?!.*memo)/)) risk += 25;

    return Math.min(risk, 100);
  }

  /**
   * Select optimal agents based on analysis
   */
  selectAgents(analysis) {
    const selectedAgents = new Set();

    // Always include coordinator for complex operations
    if (analysis.complexity > 50 || analysis.urgency > 60) {
      selectedAgents.add('coordinator');
    }

    // Security-critical routing
    if (analysis.security.hasCriticalIssues) {
      selectedAgents.add('privacy-hipaa');
      selectedAgents.add('security-auditor');
      selectedAgents.add('gateway-monitor');
    }

    // Medical domain routing
    if (analysis.medical.hasMedicalWorkflow) {
      selectedAgents.add('medical-validator');
      selectedAgents.add('business-logic-validator');
      selectedAgents.add('healthcare-optimizer');
    }

    // Performance routing
    if (analysis.performance.hasPerformanceIssues) {
      selectedAgents.add('performance-engine');
      if (analysis.complexity > 70) {
        selectedAgents.add('performance-profiler');
      }
    }

    // Code quality routing
    if (analysis.fileType === 'react' || analysis.fileType === 'typescript') {
      selectedAgents.add('error-detective');
      selectedAgents.add('standards-enforcer');
      if (analysis.complexity > 60) {
        selectedAgents.add('code-review');
      }
    }

    // Database routing
    if (analysis.fileType === 'sql' || analysis.domain.isPatientRelated) {
      selectedAgents.add('schema-intelligence');
      selectedAgents.add('relationship-mapper');
    }

    // UI/UX routing
    if (analysis.domain.isMedicalForm) {
      selectedAgents.add('ui-modernizer');
      selectedAgents.add('ux-flow-validator');
      selectedAgents.add('responsive-designer');
    }

    // Communication routing
    if (analysis.domain.isCommunicationRelated) {
      selectedAgents.add('gateway-monitor');
      selectedAgents.add('api-validator');
    }

    // Auto-fix routing
    if (analysis.requiresAutoFix) {
      selectedAgents.add('code-improvement');
      selectedAgents.add('refactoring-architect');
    }

    // Ensure minimum viable agent set
    if (selectedAgents.size === 0) {
      selectedAgents.add('code-review');
      selectedAgents.add('standards-enforcer');
    }

    return Array.from(selectedAgents);
  }

  /**
   * Optimize execution order for maximum efficiency
   */
  optimizeExecutionOrder(agents, analysis) {
    // Priority-based ordering
    const priorityOrder = {
      // Security first (critical)
      'privacy-hipaa': 1,
      'security-auditor': 2,
      'gateway-monitor': 3,
      
      // Medical validation (high)
      'medical-validator': 4,
      'business-logic-validator': 5,
      
      // Code analysis (medium-high)
      'error-detective': 6,
      'code-review': 7,
      'standards-enforcer': 8,
      
      // Performance (medium)
      'performance-engine': 9,
      'performance-profiler': 10,
      
      // Architecture (medium-low)
      'schema-intelligence': 11,
      'relationship-mapper': 12,
      
      // Improvements (low)
      'code-improvement': 13,
      'refactoring-architect': 14,
      
      // Coordination (last)
      'coordinator': 15
    };

    // Sort by priority, with unknown agents at the end
    return agents.sort((a, b) => {
      const priorityA = priorityOrder[a] || 999;
      const priorityB = priorityOrder[b] || 999;
      return priorityA - priorityB;
    });
  }

  /**
   * Determine if realtime response is needed
   */
  needsRealtimeResponse(context) {
    return context.tool === 'Edit' && 
           (context.content || '').includes('error') &&
           (context.content || '').length < 5000;
  }

  /**
   * Determine if deep analysis is needed
   */
  needsDeepAnalysis(context) {
    return (context.content || '').length > 10000 ||
           (context.content || '').includes('complex') ||
           this.calculateComplexity(context) > 70;
  }

  /**
   * Determine if auto-fix is appropriate
   */
  needsAutoFix(context) {
    const content = context.content || '';
    return content.includes('eslint-disable') ||
           content.match(/TODO|FIXME|BUG/gi) ||
           content.includes('deprecated');
  }

  /**
   * Generate cache key for routing decisions
   */
  generateCacheKey(context) {
    const key = [
      context.tool,
      this.detectFileType(context.file || ''),
      this.calculateComplexity(context),
      this.calculateUrgency(context)
    ].join('-');
    
    return `routing-${key}`;
  }

  /**
   * Log routing decisions for optimization
   */
  logRouting(type, agents, executionTime) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      agents,
      executionTime,
      agentCount: agents.length
    };

    // Store metrics for analysis
    this.performanceMetrics.set(Date.now(), logEntry);
    
    // Keep only recent metrics (last 1000 entries)
    if (this.performanceMetrics.size > 1000) {
      const oldKeys = Array.from(this.performanceMetrics.keys()).slice(0, 100);
      oldKeys.forEach(key => this.performanceMetrics.delete(key));
    }
  }

  /**
   * Get routing performance statistics
   */
  getPerformanceStats() {
    const metrics = Array.from(this.performanceMetrics.values());
    
    return {
      totalRoutings: metrics.length,
      averageExecutionTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length,
      averageAgentCount: metrics.reduce((sum, m) => sum + m.agentCount, 0) / metrics.length,
      cacheHitRate: metrics.filter(m => m.type === 'cache-hit').length / metrics.length * 100
    };
  }
}

export default IntelligentRouter;