#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ports = [3000, 3001, 4000, 4001, 5000, 5001];

async function killPort(port) {
  try {
    // Check if port is in use
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    if (stdout.trim()) {
      const pids = stdout.trim().split('\n');
      console.log(`🔪 Killing processes on port ${port}: ${pids.join(', ')}`);
      
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
        } catch (error) {
          // Process might already be dead
        }
      }
      console.log(`✅ Port ${port} is now free`);
    } else {
      console.log(`✅ Port ${port} is already free`);
    }
  } catch (error) {
    // Port is free (lsof returns exit code 1 when no processes found)
    console.log(`✅ Port ${port} is free`);
  }
}

async function main() {
  console.log('🧹 Cleaning up development ports...');
  
  for (const port of ports) {
    await killPort(port);
  }
  
  console.log('🎉 All ports cleaned! You can now run npm run dev');
}

main().catch(console.error);