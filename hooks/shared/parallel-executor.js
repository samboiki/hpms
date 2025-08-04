#!/usr/bin/env node
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Parallel Agent Execution System
 * 
 * Executes multiple agents simultaneously for lightning-fast performance
 * Manages agent pooling, result merging, and error handling
 */
export class ParallelExecutor {
  constructor() {
    this.agentPool = new Map();
    this.executionQueue = [];
    this.maxConcurrentAgents = 10;
    this.executionMetrics = new Map();
    
    // Pre-warm critical agents
    this.preWarmCriticalAgents();
  }

  /**
   * Pre-warm the most commonly used agents for instant response
   */
  async preWarmCriticalAgents() {
    const criticalAgents = [
      'error-detective',
      'performance-engine', 
      'privacy-hipaa',
      'medical-validator',
      'standards-enforcer'
    ];

    try {
      for (const agentId of criticalAgents) {
        await this.preWarmAgent(agentId);
      }
    } catch (error) {
      console.warn('Warning: Could not pre-warm all critical agents:', error.message);
    }
  }

  /**
   * Pre-warm a specific agent by loading its configuration
   */
  async preWarmAgent(agentId) {
    if (this.agentPool.has(agentId)) {
      return this.agentPool.get(agentId);
    }

    try {
      const configPath = resolve('.claude/sub-agents', `${agentId}-agent.md`);
      const config = await this.loadAgentConfig(configPath);
      
      const agentInstance = {
        id: agentId,
        config,
        lastUsed: Date.now(),
        executionCount: 0,
        averageExecutionTime: 0,
        ready: true
      };

      this.agentPool.set(agentId, agentInstance);
      return agentInstance;
    } catch (error) {
      console.warn(`Could not pre-warm agent ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * Execute multiple agents in parallel with intelligent batching
   */
  async executeAgentsInParallel(agentIds, context) {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();
    
    console.log(`🚀 Executing ${agentIds.length} agents in parallel (${executionId})`);

    try {
      // Prepare agents for execution
      const preparedAgents = await this.prepareAgents(agentIds);
      
      // Create execution promises with timeout
      const executionPromises = preparedAgents.map(agent => 
        this.executeAgentWithTimeout(agent, context, 30000) // 30 second timeout
      );

      // Execute all agents in parallel
      const results = await Promise.allSettled(executionPromises);
      
      // Process results and handle failures gracefully
      const processedResults = this.processExecutionResults(results, agentIds);
      
      // Merge results intelligently
      const mergedResult = this.intelligentResultMerging(processedResults);
      
      // Update metrics
      const totalTime = Date.now() - startTime;
      this.updateExecutionMetrics(executionId, agentIds, totalTime, processedResults);
      
      console.log(`✅ Parallel execution completed in ${totalTime}ms`);
      
      return {
        executionId,
        totalTime,
        agentCount: agentIds.length,
        successCount: processedResults.filter(r => r.status === 'success').length,
        results: mergedResult
      };

    } catch (error) {
      console.error('❌ Parallel execution failed:', error.message);
      return {
        executionId,
        totalTime: Date.now() - startTime,
        agentCount: agentIds.length,
        successCount: 0,
        error: error.message,
        results: { issues: [], recommendations: [], autoFixes: [] }
      };
    }
  }

  /**
   * Prepare agents for execution (pre-warm if needed)
   */
  async prepareAgents(agentIds) {
    const preparedAgents = [];

    for (const agentId of agentIds) {
      let agent = this.agentPool.get(agentId);
      
      if (!agent) {
        agent = await this.preWarmAgent(agentId);
      }
      
      if (agent && agent.ready) {
        preparedAgents.push(agent);
      } else {
        console.warn(`⚠️ Agent ${agentId} not ready, skipping`);
      }
    }

    return preparedAgents;
  }

  /**
   * Execute single agent with timeout protection
   */
  async executeAgentWithTimeout(agent, context, timeout = 30000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Agent ${agent.id} timed out after ${timeout}ms`));
      }, timeout);

      // Execute agent via Claude Code sub-agent
      this.executeSubAgent(agent.id, context)
        .then(result => {
          clearTimeout(timeoutId);
          
          const executionTime = Date.now() - startTime;
          
          // Update agent metrics
          agent.lastUsed = Date.now();
          agent.executionCount++;
          agent.averageExecutionTime = 
            (agent.averageExecutionTime * (agent.executionCount - 1) + executionTime) / agent.executionCount;
          
          resolve({
            agentId: agent.id,
            executionTime,
            result,
            status: 'success'
          });
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject({
            agentId: agent.id,
            executionTime: Date.now() - startTime,
            error: error.message,
            status: 'failed'
          });
        });
    });
  }

  /**
   * Execute sub-agent via Claude Code Task tool
   */
  async executeSubAgent(agentId, context) {
    // This would integrate with Claude Code's Task tool
    // For now, simulating the execution structure
    
    const prompt = this.buildAgentPrompt(agentId, context);
    
    // In real implementation, this would use:
    // await runSubAgent(agentId, context)
    
    // Simulated agent execution based on agent type
    return this.simulateAgentExecution(agentId, context);
  }

  /**
   * Build context-aware prompt for sub-agent
   */
  buildAgentPrompt(agentId, context) {
    const basePrompt = `Execute ${agentId} analysis on the following code:`;
    
    const contextPrompt = [
      `File: ${context.file || 'unknown'}`,
      `Tool: ${context.tool || 'unknown'}`,
      `Content length: ${(context.content || '').length} characters`,
      '',
      'Code to analyze:',
      '```',
      context.content || '',
      '```',
      '',
      'Please provide:',
      '1. Issues found with severity levels',
      '2. Specific recommendations with code examples',
      '3. Auto-fix suggestions where appropriate',
      '4. HPMS-specific insights for healthcare context'
    ].join('\n');

    return `${basePrompt}\n\n${contextPrompt}`;
  }

  /**
   * Simulate agent execution (placeholder for real sub-agent integration)
   */
  async simulateAgentExecution(agentId, context) {
    // Simulate processing time based on agent type
    const processingTime = this.getSimulatedProcessingTime(agentId);
    await this.sleep(processingTime);

    // Return agent-specific simulated results
    return this.generateSimulatedResults(agentId, context);
  }

  /**
   * Get simulated processing time for different agent types
   */
  getSimulatedProcessingTime(agentId) {
    const processingTimes = {
      'error-detective': 150,
      'performance-engine': 200,
      'privacy-hipaa': 100,
      'medical-validator': 180,
      'standards-enforcer': 120,
      'code-review': 300,
      'schema-intelligence': 250,
      'gateway-monitor': 100
    };

    return processingTimes[agentId] || 200;
  }

  /**
   * Generate simulated results based on agent type
   */
  generateSimulatedResults(agentId, context) {
    const code = context.content || '';
    const results = {
      agentId,
      timestamp: new Date().toISOString(),
      issues: [],
      recommendations: [],
      autoFixes: [],
      hpmsContext: {},
      performanceMetrics: {}
    };

    // Agent-specific analysis simulation
    switch (agentId) {
      case 'error-detective':
        if (code.includes('.map(') && !code.includes('key=')) {
          results.issues.push({
            type: 'REACT_ERROR',
            severity: 'high',
            message: 'Missing key prop in map function',
            location: 'Component render',
            fix: 'Add unique key prop to mapped elements'
          });
        }
        break;

      case 'privacy-hipaa':
        if (code.match(/practice_id.*\|\|/)) {
          results.issues.push({
            type: 'CRITICAL_SECURITY',
            severity: 'critical',
            message: 'Cross-practice data access vulnerability',
            location: 'Practice ID handling',
            fix: 'Use getSafePracticeId(user) with validation'
          });
        }
        break;

      case 'performance-engine':
        if (code.includes('.map(') && !code.includes('memo')) {
          results.issues.push({
            type: 'PERFORMANCE',
            severity: 'medium',
            message: 'Unoptimized list rendering',
            location: 'Component render',
            fix: 'Wrap component in React.memo()'
          });
        }
        break;

      case 'medical-validator':
        if (code.includes('scheduled_date') && code.includes('visits')) {
          results.issues.push({
            type: 'MEDICAL_WORKFLOW',
            severity: 'high',
            message: 'Wrong date field for appointments',
            location: 'Database query',
            fix: 'Use visit_date instead of scheduled_date'
          });
        }
        break;
    }

    return results;
  }

  /**
   * Process execution results and handle failures
   */
  processExecutionResults(results, agentIds) {
    return results.map((result, index) => {
      const agentId = agentIds[index];
      
      if (result.status === 'fulfilled') {
        return {
          ...result.value,
          status: 'success'
        };
      } else {
        console.warn(`⚠️ Agent ${agentId} failed:`, result.reason);
        return {
          agentId,
          status: 'failed',
          error: result.reason,
          issues: [],
          recommendations: [],
          autoFixes: []
        };
      }
    });
  }

  /**
   * Intelligently merge results from multiple agents
   */
  intelligentResultMerging(results) {
    const merged = {
      executionSummary: {
        totalAgents: results.length,
        successfulAgents: results.filter(r => r.status === 'success').length,
        totalIssues: 0,
        criticalIssues: 0,
        totalRecommendations: 0,
        autoFixesAvailable: 0
      },
      issues: [],
      recommendations: [],
      autoFixes: [],
      agentReports: []
    };

    // Merge all results
    results.forEach(result => {
      if (result.status === 'success' && result.result) {
        const agentResult = result.result;
        
        // Merge issues
        if (agentResult.issues) {
          merged.issues.push(...agentResult.issues);
          merged.executionSummary.totalIssues += agentResult.issues.length;
          merged.executionSummary.criticalIssues += 
            agentResult.issues.filter(i => i.severity === 'critical').length;
        }

        // Merge recommendations
        if (agentResult.recommendations) {
          merged.recommendations.push(...agentResult.recommendations);
          merged.executionSummary.totalRecommendations += agentResult.recommendations.length;
        }

        // Merge auto-fixes
        if (agentResult.autoFixes) {
          merged.autoFixes.push(...agentResult.autoFixes);
          merged.executionSummary.autoFixesAvailable += agentResult.autoFixes.length;
        }

        // Store individual agent report
        merged.agentReports.push({
          agentId: result.agentId,
          executionTime: result.executionTime,
          issuesFound: agentResult.issues?.length || 0,
          recommendationsProvided: agentResult.recommendations?.length || 0
        });
      }
    });

    // Remove duplicates and prioritize
    merged.issues = this.removeDuplicateIssues(merged.issues);
    merged.recommendations = this.removeDuplicateRecommendations(merged.recommendations);
    merged.autoFixes = this.prioritizeAutoFixes(merged.autoFixes);

    return merged;
  }

  /**
   * Remove duplicate issues based on type and location
   */
  removeDuplicateIssues(issues) {
    const seen = new Set();
    return issues.filter(issue => {
      const key = `${issue.type}-${issue.location}-${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Remove duplicate recommendations
   */
  removeDuplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter(rec => {
      const key = `${rec.type}-${rec.component || rec.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Prioritize auto-fixes by severity and safety
   */
  prioritizeAutoFixes(autoFixes) {
    return autoFixes.sort((a, b) => {
      // Priority order: critical > high > medium > low
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityA = severityOrder[a.severity] || 0;
      const severityB = severityOrder[b.severity] || 0;
      
      return severityB - severityA;
    });
  }

  /**
   * Load agent configuration from file
   */
  async loadAgentConfig(configPath) {
    try {
      const content = await readFile(configPath, 'utf-8');
      // Parse markdown configuration file
      return this.parseAgentConfig(content);
    } catch (error) {
      throw new Error(`Could not load agent config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Parse agent configuration from markdown
   */
  parseAgentConfig(content) {
    // Basic parsing of agent configuration
    const config = {
      name: this.extractConfigValue(content, 'name') || 'Unknown Agent',
      description: this.extractConfigValue(content, 'description') || '',
      tools: this.extractConfigArray(content, 'tools') || [],
      priority: parseInt(this.extractConfigValue(content, 'priority')) || 5
    };

    return config;
  }

  /**
   * Extract configuration value from markdown content
   */
  extractConfigValue(content, key) {
    const regex = new RegExp(`${key}:\\s*(.+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract configuration array from markdown content
   */
  extractConfigArray(content, key) {
    const regex = new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`, 'i');
    const match = content.match(regex);
    if (match) {
      return match[1].split(',').map(item => item.trim().replace(/['"]/g, ''));
    }
    return [];
  }

  /**
   * Update execution metrics for performance monitoring
   */
  updateExecutionMetrics(executionId, agentIds, totalTime, results) {
    const metrics = {
      executionId,
      timestamp: Date.now(),
      agentIds,
      totalTime,
      agentCount: agentIds.length,
      successCount: results.filter(r => r.status === 'success').length,
      averageAgentTime: totalTime / agentIds.length,
      efficiency: results.filter(r => r.status === 'success').length / agentIds.length
    };

    this.executionMetrics.set(executionId, metrics);

    // Keep only recent metrics
    if (this.executionMetrics.size > 100) {
      const oldKeys = Array.from(this.executionMetrics.keys()).slice(0, 20);
      oldKeys.forEach(key => this.executionMetrics.delete(key));
    }
  }

  /**
   * Generate unique execution ID
   */
  generateExecutionId() {
    return `parallel-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Sleep utility for simulated delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution performance statistics
   */
  getPerformanceStats() {
    const metrics = Array.from(this.executionMetrics.values());
    
    if (metrics.length === 0) {
      return { message: 'No execution metrics available yet' };
    }

    return {
      totalExecutions: metrics.length,
      averageTotalTime: metrics.reduce((sum, m) => sum + m.totalTime, 0) / metrics.length,
      averageAgentCount: metrics.reduce((sum, m) => sum + m.agentCount, 0) / metrics.length,
      averageSuccessRate: metrics.reduce((sum, m) => sum + m.efficiency, 0) / metrics.length * 100,
      fastestExecution: Math.min(...metrics.map(m => m.totalTime)),
      slowestExecution: Math.max(...metrics.map(m => m.totalTime))
    };
  }

  /**
   * Clean up agent pool and metrics
   */
  cleanup() {
    this.agentPool.clear();
    this.executionMetrics.clear();
    this.executionQueue = [];
  }
}

export default ParallelExecutor;