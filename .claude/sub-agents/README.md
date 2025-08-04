# Claude Code Sub-Agents System

## Overview
This directory contains 25 specialized sub-agents for the Healthcare Practice Management System (HPMS). Each agent has specific expertise and can be invoked by Claude Code to handle specialized tasks.

## Complete List of Sub-Agents (25 Total)

### 🏗️ System Architecture (3)
1. **schema-intelligence** - Database schema expert with persistent knowledge
2. **workflow-tracker** - Tracks workflows and maintains audit trails  
3. **agent-coordinator** - Coordinates multiple agents and prevents duplicate work

### 💻 Code Quality (4)
4. **code-standards-enforcer** - Enforces consistent code standards across all components
5. **error-detective** - Investigates and resolves complex errors
6. **import-doctor** - Manages and optimizes imports
7. **type-guardian** - Ensures TypeScript type safety

### ⚡ Performance (3)
8. **performance-optimizer** - Optimizes for <200ms response times
9. **performance-ninja** - Extreme performance optimization specialist (duplicate name, different focus)
10. **offline-resilience** - Implements offline functionality and caching

### 🎨 UI/UX (4)
11. **responsive-designer** - Creates responsive layouts for all devices
12. **mobile-architect** - Mobile-first healthcare UI specialist
13. **ui-modernizer** - Modernizes UI with premium design patterns
14. **code-beautifier** - Refactors code for readability

### 🔒 Security & Compliance (3)
15. **security-auditor** - Comprehensive security audits
16. **compliance-guardian** - HIPAA compliance and data privacy
17. **communication-gateway-monitor** - Ensures centralized SMS/Email usage

### 🏥 Healthcare Domain (2)
18. **medical-workflow-validator** - Validates medical workflows
19. **healthcare-optimizer** - Optimizes healthcare-specific processes

### 📊 Analytics & Insights (3)
20. **usage-tracker** - Tracks system usage and analytics
21. **data-analyst** - Provides data insights and trends
22. **test-coverage-analyzer** - Analyzes and improves test coverage

### 🔗 Integration & Architecture (2)
23. **api-validator** - Validates API patterns and performance
24. **relationship-mapper** - Maps database and component relationships

### 🚀 Advanced Features (1)
25. **realtime-expert** - Implements real-time features and WebSocket connections

## How to Use Sub-Agents

### Automatic Invocation
Claude Code will automatically select and use the appropriate sub-agent based on the task context.

### Manual Invocation
You can explicitly request a specific sub-agent:
```
"Use the performance-optimizer sub-agent to analyze this component"
"Have the security-auditor check this implementation"
```

### Sub-Agent Format
Each sub-agent file follows this structure:
```markdown
---
name: agent-name
description: Brief description of agent's purpose
tools: List of tools the agent can use
---

# Detailed system prompt and expertise
```

## Key Features

### 🧠 Persistent Knowledge
Many agents maintain knowledge between runs in `.claude/agent-knowledge/` to avoid repeated work.

### 📋 Workflow Tracking
The workflow-tracker agent logs all operations in `.claude/workflow-logs/` for complete audit trails.

### 🤝 Agent Coordination
The agent-coordinator prevents duplicate work and optimizes execution order when multiple agents are needed.

### 🎯 Specialized Expertise
Each agent has deep knowledge in their specific domain, following CLAUDE.md standards.

## Testing Sub-Agents

To test if sub-agents are working:
```bash
# List all sub-agents
ls -la .claude/sub-agents/

# Check a specific sub-agent
cat .claude/sub-agents/schema-intelligence.md

# The sub-agents will be used automatically by Claude Code
```

## Maintenance

- Sub-agents are version controlled with the project
- Update agent prompts as system evolves
- Add new agents as needed for new domains
- Remove deprecated agents when no longer needed

## Integration with CLAUDE.md

All sub-agents follow the standards defined in CLAUDE.md:
- Healthcare domain expertise
- Performance optimization focus
- Security-first approach
- Premium UI/UX standards
- Centralized communication gateways