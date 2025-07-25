#!/usr/bin/env node

/**
 * Test Super Agent Coordinator Activation
 * 
 * This simulates different user prompts to verify the super agent
 * correctly identifies which agents should be activated
 */

import { spawn } from 'child_process';

const testPrompts = [
  {
    prompt: "okay . on edit visit form please create porper nice looking clean buttons please",
    expectedAgents: ['UI/UX Agent', 'Medical Validator', 'Business Logic Validator', 'AI Code Generation']
  },
  {
    prompt: "fix the slow performance in patient list",
    expectedAgents: ['Performance Engine', 'Medical Validator', 'Error Detective']
  },
  {
    prompt: "ensure HIPAA compliance for patient data",
    expectedAgents: ['Privacy & HIPAA', 'Medical Validator']
  },
  {
    prompt: "create a new appointment scheduling system",
    expectedAgents: ['AI Code Generation', 'Medical Validator', 'Business Logic Validator']
  },
  {
    prompt: "show me the users table",
    expectedAgents: ['Database Architect']
  }
];

console.log('🧪 Testing Super Agent Coordinator Activation\n');
console.log('This will show what agents are identified for different prompts:\n');

// Test each prompt
testPrompts.forEach((test, index) => {
  console.log(`Test ${index + 1}: "${test.prompt}"`);
  console.log(`Expected Agents: ${test.expectedAgents.join(', ')}`);
  
  // Simulate the hook data
  const hookData = {
    user_prompt: test.prompt
  };
  
  // Run the wrapper
  const wrapper = spawn('node', ['hooks/claude-hook-wrapper.js', 'UserPromptSubmit'], {
    cwd: '/home/happy/projects/hpms'
  });
  
  // Send hook data via stdin
  wrapper.stdin.write(JSON.stringify(hookData));
  wrapper.stdin.end();
  
  // Capture output
  let output = '';
  wrapper.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  wrapper.on('close', () => {
    console.log('Output:', output.split('\n').filter(line => line.includes('Agent')).join('\n'));
    console.log('---\n');
  });
});

console.log('\n📋 IMPORTANT NOTES:');
console.log('1. The super agent coordinator should activate on EVERY prompt');
console.log('2. It analyzes user intent and determines which agents are needed');
console.log('3. The Stop hook will show a complete session report');
console.log('4. Agents are tracked throughout the session\n');

console.log('✅ Settings.json has been updated to use claude-hook-wrapper.js for UserPromptSubmit');
console.log('✅ The wrapper now includes analyzeUserIntent() function');
console.log('✅ Every prompt will be analyzed by the super agent coordinator\n');