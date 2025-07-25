# 🎯 HPMS Agent System Usage Guide

## Overview
The HPMS project has a sophisticated 30-agent AI system that monitors, detects, and fixes issues in real-time. This guide explains how to properly utilize this infrastructure.

## 🧠 Core Components

### 1. Super-Intelligent Coordinator
- **Location**: `hooks/super-intelligent-coordinator.js`
- **Purpose**: Master orchestrator for all operations
- **Triggers**: PostToolUse, PreToolUse, UserPromptSubmit, Stop

### 2. Agent Categories

#### 🏗️ System Architecture Agents
- Schema Intelligence Agent
- Workflow Tracker
- Context Cache Manager

#### 🔍 Code Quality Agents
- Error Detective (React errors, hooks)
- Standards Enforcer
- Type Guardian
- Code Review Agent

#### ⚡ Performance Agents
- Performance Engine (<200ms targets)
- Performance Profiler
- Offline Resilience

#### 🔒 Security & Compliance
- Privacy & HIPAA Agent
- Security Auditor
- Gateway Monitor (SMS/Email)

#### 🏥 Healthcare Domain
- Medical Validator
- Healthcare Optimizer
- Business Logic Validator

#### 📊 Analytics & Testing
- Usage Tracker
- Test Coverage Analyzer
- Integration Testing

## 🚀 How Agents Work

### Detection Flow
1. **Hook Trigger** → File edit/tool use
2. **Coordinator Analysis** → Context building
3. **Intelligent Routing** → Select optimal agents
4. **Parallel Execution** → Multiple agents run simultaneously
5. **Result Processing** → Apply fixes/report issues

### Agent Capabilities

#### Document Generation Agent (Example)
```javascript
// Detects patterns like:
- patientId: false/undefined/null
- Missing validation before API calls
- Incorrect document generation parameters

// Provides fixes:
- Validation code snippets
- Error handling improvements
- Performance optimizations
```

## 📝 Current Invoice Generation Fix

### The Issue
```javascript
// Problem: patientId can be false
const invoiceRequest = {
  patientId, // Sometimes false!
  visitId,
  services
};
```

### Agent Detection
The Document Generation Agent specifically looks for:
```javascript
missingPatientId: /patientId:\s*(false|undefined|null)/gi
```

### Agent-Recommended Fix
```javascript
// Validate before invoice generation
if (!patientId || patientId === false) {
  console.error('Cannot generate invoice: Invalid patient ID');
  throw new Error('Patient ID is required');
}
```

## 🔧 Using Agents Effectively

### 1. Let Agents Run on File Edits
- Agents automatically analyze when you edit files
- They provide real-time feedback and fixes

### 2. Check Agent Reports
- Look for console output from agents
- Review suggested fixes and apply them

### 3. Create Agent-Specific Tests
- Write tests that validate agent detections
- Ensure fixes are properly applied

### 4. Add New Patterns
- Agents learn from patterns
- Add new detection patterns as issues arise

## 🎯 Best Practices

### 1. Trust the Agents
- They have deep HPMS domain knowledge
- They catch issues humans might miss

### 2. Run in Parallel
- Agents execute simultaneously for speed
- Don't disable parallel execution

### 3. Update Agent Knowledge
- Agents store learned patterns
- Review `.claude/agent-knowledge/` periodically

### 4. Use Type-Safe Code
- Agents work better with TypeScript
- Avoid `any` types

## 🚨 Common Issues Agents Catch

1. **Missing Keys in React Maps**
2. **Hook Dependency Arrays**
3. **Cross-Practice Data Access**
4. **Direct SMS/Email (not using gateways)**
5. **Performance Issues (>200ms operations)**
6. **Missing Audit Trails**
7. **Invalid Patient/Visit IDs**
8. **Unencrypted Patient Data**

## 💡 Tips for Maximum Benefit

1. **Enable All Hooks** in `.claude/settings.json`
2. **Run `npm run lint` regularly** - agents enhance linting
3. **Check agent logs** in `.claude/agent-knowledge/`
4. **Add domain patterns** to `hooks/shared/hpms-patterns.js`
5. **Create agent tests** for critical workflows

## 🔮 Future Enhancements

1. **Real-time Dashboard** - Live agent activity monitoring
2. **Auto-PR Creation** - Agents create PRs for fixes
3. **Learning Mode** - Agents learn from code reviews
4. **Cross-Agent Communication** - Agents collaborate on complex issues

---

Remember: The agent system is your AI-powered development team. Use it wisely and it will catch issues before they reach production!