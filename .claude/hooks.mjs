import { createValidator } from './jsx-validator.mjs';
import { createAutoFixer } from './auto-fixer.mjs';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const validator = createValidator();
const autoFixer = createAutoFixer();
await autoFixer.init();

let config = {
  autoFix: true,
  strictMode: false,
  backupBeforeFix: true,
  enabledFor: ['.jsx', '.tsx'],
  maxAutoFixAttempts: 3,
  playCompletionSound: true
};

// Function to play completion sound
async function playCompletionSound() {
  if (!config.playCompletionSound) return;
  
  try {
    // Detect if running in WSL
    const { stdout: versionInfo } = await execAsync('uname -r');
    const isWSL = versionInfo.toLowerCase().includes('microsoft');
    
    if (isWSL) {
      // WSL: Use PowerShell to play Windows chime
      await execAsync(`powershell.exe -c "(New-Object Media.SoundPlayer 'C:\\\\Windows\\\\Media\\\\chimes.wav').PlaySync()"`);
    } else {
      // Native Linux/Mac
      const platform = process.platform;
      if (platform === 'darwin') {
        await execAsync('afplay /System/Library/Sounds/Glass.aiff');
      } else if (platform === 'linux') {
        await execAsync('paplay /usr/share/sounds/freedesktop/stereo/complete.oga');
      }
    }
    
    console.log(chalk.green('🔔 Task completed!'));
  } catch (error) {
    // Fallback to terminal bell
    console.log('\x07');
  }
}

try {
  const configFile = await fs.readFile('.claude/config.json', 'utf-8');
  config = { ...config, ...JSON.parse(configFile) };
} catch (error) {
  console.log('Using default config');
}

export default {
  beforeFileWrite: async ({ path: filePath, content }) => {
    const ext = path.extname(filePath);
    if (!config.enabledFor.includes(ext)) {
      return { path: filePath, content };
    }

    console.log(chalk.blue(`\n🔍 Validating JSX in ${filePath}...`));
    
    const validationResult = await validator.validateJSXStructure(content, filePath);
    
    if (validationResult.valid) {
      console.log(chalk.green('✅ JSX validation passed!\n'));
      return { path: filePath, content };
    }

    validator.generateReport(validationResult, content);

    if (config.autoFix) {
      console.log(chalk.yellow('\n🔧 Attempting auto-fix...\n'));
      
      const fixResult = await autoFixer.autoFix(
        content,
        validationResult.issues,
        filePath
      );
      
      if (fixResult.fixed) {
        autoFixer.generateFixReport(fixResult);
        
        const revalidation = await validator.validateJSXStructure(fixResult.code, filePath);
        if (revalidation.valid) {
          console.log(chalk.green('\n✅ Auto-fix successful!'));
          return { path: filePath, content: fixResult.code };
        }
      }
    }

    if (config.strictMode) {
      throw new Error(`JSX validation failed: ${validationResult.issues.length} issues found.`);
    }

    return { path: filePath, content };
  },
  
  afterFileWrite: async () => {
    // Play sound after successful file write
    await playCompletionSound();
  },
  
  afterToolUse: async ({ tool, success }) => {
    // Play sound after successful tool completion
    if (success && (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit')) {
      await playCompletionSound();
    }
  },
  
  onTaskComplete: async () => {
    // Play sound when a task is marked complete
    await playCompletionSound();
  },
  
  afterResponse: async () => {
    // Play sound after every response
    await playCompletionSound();
  },
  
  beforeResponse: async () => {
    // Optional: Play a different sound when starting to respond
    // await playStartSound();
  }
};
