#!/usr/bin/env node
import { readFile, writeFile, existsSync } from 'fs/promises';
import { resolve } from 'path';

/**
 * Intelligent Agent Base Class
 * 
 * Provides core functionality for all HPMS-aware agents:
 * - HPMS domain knowledge and pattern recognition
 * - Persistent knowledge storage
 * - MCP tool integration
 * - Performance optimization through caching
 */
export class IntelligentAgent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.priority = config.priority || 5;
    
    // HPMS-specific configuration
    this.hpmsContext = config.hpmsContext || {};
    this.medicalPatterns = config.medicalPatterns || [];
    
    // Performance optimization
    this.knowledgeCache = new Map();
    this.patternCache = new Map();
    
    // File paths
    this.knowledgeFile = resolve('.claude/agent-knowledge', `${this.id}-knowledge.json`);
    this.cacheFile = resolve('.claude/performance-cache', `${this.id}-cache.json`);
    
    // Initialize HPMS patterns
    this.initializeHPMSPatterns();
  }

  /**
   * Initialize HPMS-specific patterns for lightning-fast recognition
   */
  initializeHPMSPatterns() {
    this.hpmsPatterns = {
      // Core HPMS table operations
      visitTableOps: /visits\.(insert|update|select|upsert)/gi,
      patientTableOps: /patients\.(insert|update|select)/gi,
      
      // Communication gateways (critical for security)
      smsGateway: /centralized-sms-gateway/gi,
      emailGateway: /centralized-email-gateway/gi,
      directSMS: /smsportal|send.*sms(?!.*gateway)/gi, // Anti-pattern
      
      // Medical form components
      medicalForms: /(Patient|Visit|Appointment|Medical|Invoice).*Form/gi,
      premiumComponents: /Premium(Appointment|Patient|Visit)/gi,
      
      // Security patterns
      practiceIsolation: /practice_id\s*(?:=|===|IN|WHERE)/gi,
      crossPracticeAccess: /practice_id.*(?:undefined|null|'')/gi, // Vulnerability
      
      // Performance issues
      unoptimizedMaps: /\.map\((?!.*memo)/gi,
      missingCallbacks: /onClick\s*=\s*\{[^}]*\}/gi,
      inefficientQueries: /SELECT \* FROM/gi,
      
      // React errors
      missingKeys: /<[^>]*map\([^}]*\)(?![^>]*key=)/gi,
      hookDependencies: /useEffect\([^,]*,\s*\[\]/gi,
      stateUpdates: /setState\([^)]*\)/gi,
      
      // Healthcare compliance
      unencryptedPatientData: /patient.*(?:ssn|id_number|medical)(?!.*encrypt)/gi,
      missingAuditLog: /(?:insert|update|delete)(?!.*audit)/gi,
      
      // HPMS workflow patterns
      appointmentFlow: /(schedule|book|create).*appointment/gi,
      visitWorkflow: /(start|complete|record).*visit/gi,
      billingProcess: /(generate|create|send).*invoice/gi
    };
  }

  /**
   * Load persistent knowledge from disk
   */
  async loadKnowledge() {
    try {
      if (existsSync(this.knowledgeFile)) {
        const data = await readFile(this.knowledgeFile, 'utf-8');
        const knowledge = JSON.parse(data);
        
        // Cache frequently accessed patterns
        if (knowledge.patterns) {
          this.patternCache.set('learned-patterns', knowledge.patterns);
        }
        
        return knowledge;
      }
    } catch (error) {
      console.warn(`Warning: Could not load knowledge for ${this.name}:`, error.message);
    }
    
    return { patterns: {}, statistics: {}, lastUpdated: null };
  }

  /**
   * Save knowledge to disk with performance optimization
   */
  async saveKnowledge(knowledge) {
    try {
      knowledge.lastUpdated = new Date().toISOString();
      knowledge.agentId = this.id;
      knowledge.agentName = this.name;
      
      await writeFile(this.knowledgeFile, JSON.stringify(knowledge, null, 2));
      
      // Update cache
      if (knowledge.patterns) {
        this.patternCache.set('learned-patterns', knowledge.patterns);
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving knowledge for ${this.name}:`, error.message);
      return false;
    }
  }

  /**
   * Analyze code for HPMS-specific patterns with lightning speed
   */
  analyzeHPMSContext(code, filename = '') {
    const context = {
      // File type detection
      isReactComponent: filename.endsWith('.tsx') || filename.endsWith('.jsx'),
      isTypeScript: filename.endsWith('.ts') || filename.endsWith('.tsx'),
      isSQL: filename.endsWith('.sql'),
      isEdgeFunction: filename.includes('supabase/functions'),
      
      // HPMS domain detection
      isPatientRelated: this.matchPattern(code, this.hpmsPatterns.patientTableOps),
      isVisitRelated: this.matchPattern(code, this.hpmsPatterns.visitTableOps),
      isMedicalForm: this.matchPattern(code, this.hpmsPatterns.medicalForms),
      isPremiumComponent: this.matchPattern(code, this.hpmsPatterns.premiumComponents),
      
      // Communication analysis
      usesSMSGateway: this.matchPattern(code, this.hpmsPatterns.smsGateway),
      usesEmailGateway: this.matchPattern(code, this.hpmsPatterns.emailGateway),
      hasDirectSMS: this.matchPattern(code, this.hpmsPatterns.directSMS), // Security issue
      
      // Security analysis
      hasPracticeIsolation: this.matchPattern(code, this.hpmsPatterns.practiceIsolation),
      hasCrossPracticeRisk: this.matchPattern(code, this.hpmsPatterns.crossPracticeAccess),
      hasUnencryptedPatientData: this.matchPattern(code, this.hpmsPatterns.unencryptedPatientData),
      
      // Performance analysis
      hasUnoptimizedMaps: this.matchPattern(code, this.hpmsPatterns.unoptimizedMaps),
      hasMissingCallbacks: this.matchPattern(code, this.hpmsPatterns.missingCallbacks),
      hasInefficientQueries: this.matchPattern(code, this.hpmsPatterns.inefficientQueries),
      
      // Error potential
      hasMissingKeys: this.matchPattern(code, this.hpmsPatterns.missingKeys),
      hasHookIssues: this.matchPattern(code, this.hpmsPatterns.hookDependencies),
      
      // Workflow analysis
      isAppointmentFlow: this.matchPattern(code, this.hpmsPatterns.appointmentFlow),
      isVisitWorkflow: this.matchPattern(code, this.hpmsPatterns.visitWorkflow),
      isBillingProcess: this.matchPattern(code, this.hpmsPatterns.billingProcess)
    };
    
    // Calculate complexity score
    context.complexityScore = this.calculateComplexity(code);
    
    // Determine priority based on HPMS importance
    context.hpmsPriority = this.calculateHPMSPriority(context);
    
    return context;
  }

  /**
   * Match pattern with caching for performance
   */
  matchPattern(code, pattern) {
    const cacheKey = `${pattern.source}-${code.length}`;
    
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey);
    }
    
    const matches = code.match(pattern) || [];
    const result = {
      found: matches.length > 0,
      count: matches.length,
      matches: matches.slice(0, 10) // Limit for performance
    };
    
    this.patternCache.set(cacheKey, result);
    return result;
  }

  /**
   * Calculate code complexity for prioritization
   */
  calculateComplexity(code) {
    const metrics = {
      lines: code.split('\n').length,
      cyclomaticComplexity: (code.match(/if|for|while|switch|catch|\?\s*:/g) || []).length,
      functionCount: (code.match(/function|=>\s*\{|\w+\s*\(/g) || []).length,
      importCount: (code.match(/^import/gm) || []).length,
      stateVariables: (code.match(/useState|useReducer|useContext/g) || []).length
    };
    
    // Weighted complexity score
    return (
      metrics.lines * 0.1 +
      metrics.cyclomaticComplexity * 2 +
      metrics.functionCount * 1.5 +
      metrics.importCount * 0.5 +
      metrics.stateVariables * 1.2
    );
  }

  /**
   * Calculate HPMS-specific priority for agent routing
   */
  calculateHPMSPriority(context) {
    let score = 0;
    
    // Critical security issues
    if (context.hasCrossPracticeRisk.found) score += 100;
    if (context.hasDirectSMS.found) score += 80;
    if (context.hasUnencryptedPatientData.found) score += 90;
    
    // Medical workflow importance
    if (context.isPatientRelated.found) score += 50;
    if (context.isVisitRelated.found) score += 60;
    if (context.isMedicalForm.found) score += 40;
    
    // Performance issues
    if (context.hasUnoptimizedMaps.found) score += 30;
    if (context.hasInefficientQueries.found) score += 40;
    
    // Error potential
    if (context.hasMissingKeys.found) score += 25;
    if (context.hasHookIssues.found) score += 35;
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Execute agent logic - to be implemented by subclasses
   */
  async execute(context) {
    throw new Error(`Agent ${this.name} must implement execute() method`);
  }

  /**
   * Generate execution report
   */
  generateReport(results) {
    return {
      agentId: this.id,
      agentName: this.name,
      timestamp: new Date().toISOString(),
      executionTime: results.executionTime || 0,
      issuesFound: results.issues?.length || 0,
      criticalIssues: results.issues?.filter(i => i.severity === 'critical').length || 0,
      autoFixesApplied: results.autoFixes?.length || 0,
      hpmsContext: results.hpmsContext || {},
      recommendations: results.recommendations || [],
      performanceMetrics: results.performanceMetrics || {}
    };
  }

  /**
   * Log activity for debugging and monitoring
   */
  async logActivity(activity, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agentId: this.id,
      activity,
      details,
      performanceMetrics: {
        memoryUsage: process.memoryUsage(),
        cacheSize: this.patternCache.size
      }
    };
    
    try {
      const logFile = resolve('.claude/workflow-logs', `${this.id}-activity.log`);
      await writeFile(logFile, JSON.stringify(logEntry) + '\n', { flag: 'a' });
    } catch (error) {
      console.warn(`Could not log activity for ${this.name}:`, error.message);
    }
  }
}

/**
 * Utility functions for all agents
 */
export const AgentUtils = {
  /**
   * Generate unique execution ID
   */
  generateExecutionId() {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Merge results from multiple agents intelligently
   */
  mergeAgentResults(results) {
    const merged = {
      executionId: this.generateExecutionId(),
      timestamp: new Date().toISOString(),
      agents: results.length,
      totalIssues: 0,
      criticalIssues: [],
      recommendations: [],
      autoFixes: [],
      performanceMetrics: {}
    };

    results.forEach(result => {
      if (result.issues) {
        merged.totalIssues += result.issues.length;
        merged.criticalIssues.push(...result.issues.filter(i => i.severity === 'critical'));
      }
      
      if (result.recommendations) {
        merged.recommendations.push(...result.recommendations);
      }
      
      if (result.autoFixes) {
        merged.autoFixes.push(...result.autoFixes);
      }
    });

    // Remove duplicates
    merged.criticalIssues = this.removeDuplicateIssues(merged.criticalIssues);
    merged.recommendations = this.removeDuplicateRecommendations(merged.recommendations);

    return merged;
  },

  /**
   * Remove duplicate issues based on location and type
   */
  removeDuplicateIssues(issues) {
    const seen = new Set();
    return issues.filter(issue => {
      const key = `${issue.type}-${issue.location}-${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  /**
   * Remove duplicate recommendations
   */
  removeDuplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter(rec => {
      const key = `${rec.type}-${rec.component}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
};

export default IntelligentAgent;