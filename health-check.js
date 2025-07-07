#!/usr/bin/env node

/**
 * Health Check Script for Vite Dev Server
 * Monitors the development server and ensures it stays responsive
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const HEALTH_CHECK_URL = 'http://localhost:5173';
const CHECK_INTERVAL = 5000; // 5 seconds
const MAX_FAILURES = 3;

let failureCount = 0;

async function checkHealth() {
  try {
    const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${HEALTH_CHECK_URL}`, {
      timeout: 3000
    });
    
    const statusCode = stdout.trim();
    
    if (statusCode === '200' || statusCode === '000') {
      if (failureCount > 0) {
        console.log('✅ Server is back online!');
        failureCount = 0;
      }
      return true;
    } else {
      throw new Error(`Bad status code: ${statusCode}`);
    }
  } catch (error) {
    failureCount++;
    console.log(`❌ Health check failed (${failureCount}/${MAX_FAILURES}): ${error.message}`);
    
    if (failureCount >= MAX_FAILURES) {
      console.log('🚨 Server appears to be down! Attempting restart...');
      await restartServer();
      failureCount = 0;
    }
    
    return false;
  }
}

async function restartServer() {
  try {
    console.log('🔄 Restarting Vite server...');
    
    // Kill existing processes
    await execAsync('pkill -f "vite" || true');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start new process
    exec('npm run dev', { cwd: '/home/happy/projects/hpms' });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✨ Server restart initiated');
  } catch (error) {
    console.error('❌ Failed to restart server:', error.message);
  }
}

async function startMonitoring() {
  console.log('👀 Starting health monitoring...');
  console.log(`🎯 Monitoring: ${HEALTH_CHECK_URL}`);
  console.log(`⏱️  Check interval: ${CHECK_INTERVAL}ms`);
  console.log('─'.repeat(50));
  
  // Initial check
  await checkHealth();
  
  // Set up recurring checks
  setInterval(checkHealth, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Health monitor shutting down...');
  process.exit(0);
});

// Start monitoring
startMonitoring();