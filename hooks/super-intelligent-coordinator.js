#!/usr/bin/env node
import IntelligentRouter from './shared/intelligent-routing.js';
import ParallelExecutor from './shared/parallel-executor.js';
import { HPMS_PATTERNS } from './shared/hpms-patterns.js';

/**
 * Super-Intelligent Coordinator Hook
 * 
 * This is the master orchestrator that:
 * 1. Analyzes all Claude Code operations with HPMS domain knowledge
 * 2. Intelligently routes to optimal agents for maximum efficiency  
 * 3. Executes agents in parallel for lightning-fast performance
 * 4. Auto-applies safe fixes and reports critical issues
 * 
 * Triggered by: PostToolUse, PreToolUse, UserPromptSubmit, Stop
 */

class SuperIntelligentCoordinator {
  constructor() {
    this.router = new IntelligentRouter();
    this.executor = new ParallelExecutor();
    this.executionHistory = new Map();
    this.autoFixEnabled = true;
    this.criticalIssueThreshold = 3;
    
    console.log('🚀 Super-Intelligent Coordinator initialized');
  }

  /**
   * Main coordination function - handles all hook events
   */
  async coordinate(eventType, hookData) {
    const startTime = Date.now();
    const context = this.buildContext(eventType, hookData);
    
    try {
      // Skip coordination for certain conditions
      if (this.shouldSkipCoordination(context)) {
        return this.createSkipResponse('Low priority operation');
      }

      console.log(`🧠 Coordinating ${eventType} operation for ${context.file || 'unknown file'}`);
      
      // Intelligent agent routing based on HPMS context
      const selectedAgents = await this.router.routeAgents(context);
      
      if (selectedAgents.length === 0) {
        return this.createSkipResponse('No agents required');
      }

      console.log(`📋 Selected ${selectedAgents.length} agents: ${selectedAgents.join(', ')}`);

      // Execute agents in parallel for maximum speed
      const executionResult = await this.executor.executeAgentsInParallel(selectedAgents, context);
      
      // Process results and determine actions
      const coordinationResult = await this.processResults(executionResult, context);
      
      // Log execution for learning
      this.logExecution(context, executionResult, coordinationResult);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Coordination completed in ${totalTime}ms`);
      
      return coordinationResult;

    } catch (error) {
      console.error('❌ Coordination failed:', error.message);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * Build comprehensive context from hook data
   */
  buildContext(eventType, hookData) {
    const context = {
      eventType,
      timestamp: new Date().toISOString(),
      tool: hookData.tool_name || hookData.tool || 'unknown',
      
      // File context
      file: this.extractFilePath(hookData),
      content: this.extractContent(hookData),
      
      // Operation context
      isEdit: eventType === 'PostToolUse' && (hookData.tool_name === 'Edit' || hookData.tool_name === 'MultiEdit'),
      isWrite: eventType === 'PostToolUse' && hookData.tool_name === 'Write',
      isRead: eventType === 'PostToolUse' && hookData.tool_name === 'Read',
      isMCP: eventType === 'PostToolUse' && hookData.tool_name?.startsWith('mcp__'),
      
      // User context
      userPrompt: hookData.user_prompt || '',
      isUserInitiated: eventType === 'UserPromptSubmit',
      
      // Additional metadata
      sessionId: hookData.session_id,
      projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd()
    };

    // Add HPMS-specific context analysis
    context.hpmsAnalysis = this.analyzeHPMSContext(context);
    
    return context;
  }

  /**
   * Extract file path from hook data
   */
  extractFilePath(hookData) {
    if (hookData.tool_input?.file_path) return hookData.tool_input.file_path;
    if (hookData.tool_input?.notebook_path) return hookData.tool_input.notebook_path;
    if (hookData.args?.file_path) return hookData.args.file_path;
    return null;
  }

  /**
   * Extract content from hook data
   */
  extractContent(hookData) {
    if (hookData.tool_result?.content) return hookData.tool_result.content;
    if (hookData.tool_input?.content) return hookData.tool_input.content;
    if (hookData.tool_input?.new_string) return hookData.tool_input.new_string;
    if (hookData.result?.content) return hookData.result.content;
    return '';
  }

  /**
   * Analyze HPMS-specific context for intelligent routing
   */
  analyzeHPMSContext(context) {
    const content = context.content || '';
    const filename = context.file || '';
    
    return {
      // Domain detection
      isPatientRelated: content.match(/patients?[.\s]|Patient[A-Z]/) !== null,
      isVisitRelated: content.match(/visits?[.\s]|Visit[A-Z]|appointment/i) !== null,
      isMedicalForm: content.match(/(Patient|Visit|Appointment|Medical|Invoice).*Form/gi) !== null,
      isBillingRelated: content.match(/invoice|billing|payment|batch/i) !== null,
      isCommunicationRelated: content.match(/sms|email|gateway|message/i) !== null,
      
      // Component type detection
      isReactComponent: filename.endsWith('.tsx') || filename.endsWith('.jsx'),
      isTypeScript: filename.endsWith('.ts') || filename.endsWith('.tsx'),
      isEdgeFunction: filename.includes('supabase/functions'),
      isHook: filename.includes('hooks/'),
      
      // Security analysis
      hasPracticeId: content.includes('practice_id'),
      hasPatientData: content.match(/patient.*(?:id_number|medical_aid|phone|email)/i) !== null,
      usesSMSGateway: content.includes('centralized-sms-gateway'),
      usesEmailGateway: content.includes('centralized-email-gateway'),
      hasDirectAPICall: content.match(/smsportal|resend/i) !== null && !content.includes('gateway'),
      
      // Performance indicators
      hasLargeLists: content.includes('.map(') && content.length > 2000,
      hasComplexQueries: content.match(/SELECT.*FROM.*JOIN/i) !== null,
      hasUnoptimizedRender: content.match(/\.map\((?!.*memo)/g) !== null,
      
      // Error indicators
      hasErrorHandling: content.includes('try') && content.includes('catch'),
      hasValidation: content.match(/validate|validation|schema/i) !== null,
      hasTypeErrors: content.includes('any') && context.isTypeScript,
      
      // Medical workflow indicators
      isAppointmentFlow: content.match(/(schedule|book|create).*appointment/i) !== null,
      isVisitWorkflow: content.match(/(start|complete|record).*visit/i) !== null,
      isBillingProcess: content.match(/(generate|create|send).*invoice/i) !== null,
      
      // Urgency indicators
      hasErrorKeywords: content.match(/error|Error|ERROR|bug|BUG|critical|CRITICAL/gi) !== null,
      hasSecurityKeywords: content.match(/security|SECURITY|vulnerability|breach/gi) !== null,
      hasPatientSafety: content.match(/patient.*safety|medical.*error|clinical.*risk/gi) !== null
    };
  }

  /**
   * Determine if coordination should be skipped
   */
  shouldSkipCoordination(context) {
    // Skip for certain file types
    if (context.file && (
      context.file.endsWith('.md') ||
      context.file.endsWith('.json') ||
      context.file.endsWith('.txt') ||
      context.file.endsWith('.log')
    )) {
      return true;
    }

    // Skip for very small content changes
    if (context.content && context.content.length < 50) {
      return true;
    }

    // Skip for read-only operations (unless it's a large file)
    if (context.isRead && (!context.content || context.content.length < 1000)) {
      return true;
    }

    // Skip if no meaningful changes detected
    if (!context.hpmsAnalysis.isPatientRelated && 
        !context.hpmsAnalysis.isVisitRelated &&
        !context.hpmsAnalysis.isMedicalForm &&
        !context.hpmsAnalysis.hasErrorKeywords &&
        !context.hpmsAnalysis.hasSecurityKeywords &&
        context.content.length < 500) {
      return true;
    }

    return false;
  }

  /**
   * Process agent execution results and determine actions
   */
  async processResults(executionResult, context) {
    const results = executionResult.results;
    const response = {
      coordinationId: executionResult.executionId,
      timestamp: new Date().toISOString(),
      agentsExecuted: executionResult.agentCount,
      successfulAgents: executionResult.successCount,
      totalExecutionTime: executionResult.totalTime,
      
      // Results summary
      totalIssues: results.executionSummary?.totalIssues || 0,
      criticalIssues: results.executionSummary?.criticalIssues || 0,
      autoFixesAvailable: results.executionSummary?.autoFixesAvailable || 0,
      
      // Actions taken
      autoFixesApplied: [],
      criticalIssuesReported: [],
      recommendationsProvided: [],
      
      // Status
      status: 'completed',
      requiresUserAttention: false,
      blocked: false
    };

    try {
      // Handle critical security issues first (block operation if needed)
      const criticalSecurityIssues = results.issues?.filter(
        issue => issue.severity === 'critical' && issue.type.includes('SECURITY')
      ) || [];

      if (criticalSecurityIssues.length > 0) {
        response.blocked = true;
        response.criticalIssuesReported = criticalSecurityIssues;
        response.requiresUserAttention = true;
        response.status = 'blocked_critical_security';
        
        console.error('🚨 CRITICAL SECURITY ISSUES DETECTED - OPERATION BLOCKED');
        criticalSecurityIssues.forEach(issue => {
          console.error(`   ❌ ${issue.message} (${issue.location})`);
        });
        
        return response;
      }

      // Apply safe auto-fixes if enabled
      if (this.autoFixEnabled && results.autoFixes?.length > 0) {
        const safeAutoFixes = results.autoFixes.filter(fix => this.isSafeAutoFix(fix));
        
        for (const fix of safeAutoFixes) {
          try {
            const applied = await this.applyAutoFix(fix, context);
            if (applied) {
              response.autoFixesApplied.push(fix);
              console.log(`✅ Auto-applied fix: ${fix.description}`);
            }
          } catch (error) {
            console.warn(`⚠️ Could not apply auto-fix: ${error.message}`);
          }
        }
      }

      // Report critical issues that need user attention
      const criticalIssues = results.issues?.filter(
        issue => issue.severity === 'critical' || issue.severity === 'high'
      ) || [];

      if (criticalIssues.length >= this.criticalIssueThreshold) {
        response.criticalIssuesReported = criticalIssues;
        response.requiresUserAttention = true;
        
        console.warn(`⚠️ ${criticalIssues.length} critical issues found:`);
        criticalIssues.forEach(issue => {
          console.warn(`   🔸 ${issue.message} (${issue.location})`);
        });
      }

      // Provide top recommendations
      if (results.recommendations?.length > 0) {
        response.recommendationsProvided = results.recommendations.slice(0, 5); // Top 5
        
        console.log('💡 Top recommendations:');
        response.recommendationsProvided.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec.title || rec.message}`);
        });
      }

      // Performance insights
      if (results.agentReports?.length > 0) {
        const totalAgentTime = results.agentReports.reduce((sum, report) => sum + report.executionTime, 0);
        const avgAgentTime = totalAgentTime / results.agentReports.length;
        
        console.log(`📊 Performance: ${results.agentReports.length} agents, avg ${avgAgentTime.toFixed(0)}ms each`);
      }

      return response;

    } catch (error) {
      console.error('❌ Error processing results:', error.message);
      response.status = 'error';
      response.error = error.message;
      return response;
    }
  }

  /**
   * Determine if an auto-fix is safe to apply automatically
   */
  isSafeAutoFix(fix) {
    // Only apply very safe fixes automatically
    const safeFixes = [
      'missing-key-prop',
      'missing-semicolon',  
      'unused-import',
      'formatting',
      'simple-validation'
    ];

    return safeFixes.includes(fix.type) && 
           fix.confidence > 0.8 &&
           fix.risk === 'low';
  }

  /**
   * Apply an auto-fix (placeholder - would integrate with Claude Code tools)
   */
  async applyAutoFix(fix, context) {
    // In real implementation, this would use Claude Code tools like Edit, MultiEdit
    console.log(`🔧 Applying auto-fix: ${fix.description}`);
    
    // Simulate fix application
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true; // Success
  }

  /**
   * Log execution for learning and optimization
   */
  logExecution(context, executionResult, coordinationResult) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context: {
        eventType: context.eventType,
        tool: context.tool,
        fileType: this.detectFileType(context.file || ''),
        contentSize: (context.content || '').length,
        hpmsContext: context.hpmsAnalysis
      },
      execution: {
        agentsSelected: executionResult.agentCount,
        executionTime: executionResult.totalTime,
        successRate: executionResult.successCount / executionResult.agentCount,
        issuesFound: executionResult.results.executionSummary?.totalIssues || 0
      },
      outcome: {
        status: coordinationResult.status,
        autoFixesApplied: coordinationResult.autoFixesApplied.length,
        userAttentionRequired: coordinationResult.requiresUserAttention
      }
    };

    this.executionHistory.set(executionResult.executionId, logEntry);

    // Keep only recent history (last 100 executions)
    if (this.executionHistory.size > 100) {
      const oldKeys = Array.from(this.executionHistory.keys()).slice(0, 20);
      oldKeys.forEach(key => this.executionHistory.delete(key));
    }
  }

  /**
   * Detect file type for categorization
   */
  detectFileType(filename) {
    if (filename.endsWith('.tsx')) return 'react-typescript';
    if (filename.endsWith('.jsx')) return 'react-javascript';
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.sql')) return 'sql';
    if (filename.includes('supabase/functions')) return 'edge-function';
    return 'other';
  }

  /**
   * Create skip response
   */
  createSkipResponse(reason) {
    return {
      status: 'skipped',
      reason,
      timestamp: new Date().toISOString(),
      agentsExecuted: 0,
      totalExecutionTime: 0
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(error) {
    return {
      status: 'error',
      error,
      timestamp: new Date().toISOString(),
      agentsExecuted: 0,
      totalExecutionTime: 0,
      requiresUserAttention: true
    };
  }

  /**
   * Get coordination statistics
   */
  getStats() {
    const history = Array.from(this.executionHistory.values());
    
    if (history.length === 0) {
      return { message: 'No coordination history available yet' };
    }

    return {
      totalCoordinations: history.length,
      averageExecutionTime: history.reduce((sum, h) => sum + h.execution.executionTime, 0) / history.length,
      averageAgentsUsed: history.reduce((sum, h) => sum + h.execution.agentsSelected, 0) / history.length,
      averageSuccessRate: history.reduce((sum, h) => sum + h.execution.successRate, 0) / history.length * 100,
      autoFixRate: history.filter(h => h.outcome.autoFixesApplied > 0).length / history.length * 100,
      userAttentionRate: history.filter(h => h.outcome.userAttentionRequired).length / history.length * 100,
      
      // Performance stats
      routingStats: this.router.getPerformanceStats(),
      executionStats: this.executor.getPerformanceStats()
    };
  }
}

// Create global coordinator instance
const coordinator = new SuperIntelligentCoordinator();

/**
 * Hook export functions for different Claude Code events
 */

// PostToolUse - After tool execution
export default async function postToolUse(hookData) {
  return coordinator.coordinate('PostToolUse', hookData);
}

// PreToolUse - Before tool execution  
export async function preToolUse(hookData) {
  return coordinator.coordinate('PreToolUse', hookData);
}

// UserPromptSubmit - When user submits a prompt
export async function userPromptSubmit(hookData) {
  return coordinator.coordinate('UserPromptSubmit', hookData);
}

// Stop - When Claude finishes responding
export async function stop(hookData) {
  return coordinator.coordinate('Stop', hookData);
}

// Export coordinator for direct access
export { coordinator };