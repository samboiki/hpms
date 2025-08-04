#!/usr/bin/env node

/**
 * Claude Code Post-Edit Hook - World-Class Syntax Validation
 * Runs after every file edit to catch syntax errors before they reach the user
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Configuration
const config = {
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  eslintConfig: path.join(process.cwd(), '.eslintrc.json'),
  tsConfig: path.join(process.cwd(), 'tsconfig.json'),
  prettierConfig: path.join(process.cwd(), '.prettierrc'),
  maxErrors: 10,
  autoFix: true,
};

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
};

// Check if file should be validated
function shouldValidateFile(filePath) {
  const ext = path.extname(filePath);
  return config.fileExtensions.includes(ext);
}

// Run command with error handling
function runCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options,
    });
  } catch (error) {
    return {
      error: true,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      code: error.status,
    };
  }
}

// TypeScript syntax check
function checkTypeScript(filePath) {
  log.section('TypeScript Syntax Check');
  
  if (!fs.existsSync(config.tsConfig)) {
    log.warning('No tsconfig.json found, skipping TypeScript check');
    return { valid: true };
  }

  const result = runCommand(`npx tsc --noEmit --skipLibCheck "${filePath}"`);
  
  if (result.error) {
    log.error('TypeScript errors found:');
    console.error(result.stderr || result.stdout);
    return { valid: false, errors: result.stderr || result.stdout };
  }
  
  log.success('TypeScript syntax is valid');
  return { valid: true };
}

// ESLint check with auto-fix
function checkESLint(filePath) {
  log.section('ESLint Check');
  
  // First try to auto-fix
  if (config.autoFix) {
    log.info('Attempting to auto-fix issues...');
    runCommand(`npx eslint --fix "${filePath}"`, { stdio: 'ignore' });
  }
  
  // Then check for remaining issues
  const result = runCommand(`npx eslint "${filePath}" --format json`);
  
  if (result.error) {
    try {
      const eslintOutput = JSON.parse(result.stdout);
      const fileResult = eslintOutput[0];
      
      if (fileResult && fileResult.messages.length > 0) {
        log.error(`ESLint found ${fileResult.errorCount} errors and ${fileResult.warningCount} warnings:`);
        
        fileResult.messages.slice(0, config.maxErrors).forEach((msg) => {
          const type = msg.severity === 2 ? colors.red + 'error' : colors.yellow + 'warning';
          console.log(`  ${type}${colors.reset} ${msg.line}:${msg.column} ${msg.message} (${msg.ruleId})`);
        });
        
        if (fileResult.messages.length > config.maxErrors) {
          log.warning(`... and ${fileResult.messages.length - config.maxErrors} more issues`);
        }
        
        return { valid: false, errors: fileResult.messages };
      }
    } catch (e) {
      // If JSON parsing fails, show raw output
      console.error(result.stdout);
      return { valid: false, errors: result.stdout };
    }
  }
  
  log.success('ESLint check passed');
  return { valid: true };
}

// Prettier formatting
function formatWithPrettier(filePath) {
  log.section('Prettier Formatting');
  
  const result = runCommand(`npx prettier --write "${filePath}"`);
  
  if (!result.error) {
    log.success('Code formatted successfully');
    return true;
  }
  
  log.warning('Prettier formatting failed');
  return false;
}

// Check for common React/Next.js issues
function checkReactPatterns(filePath) {
  log.section('React/Next.js Pattern Check');
  
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for hooks in callbacks
  const hookInCallbackRegex = /\.(map|filter|forEach|reduce)\s*\([^)]*\)\s*{\s*use[A-Z]/;
  if (hookInCallbackRegex.test(content)) {
    issues.push('React Hooks cannot be called inside callbacks');
  }
  
  // Check for missing 'use client' in client components
  if (content.includes('useState') || content.includes('useEffect')) {
    if (!content.startsWith("'use client'") && !content.startsWith('"use client"')) {
      issues.push('Client component missing "use client" directive');
    }
  }
  
  // Check for unescaped entities
  const unescapedEntities = /[^\\]['"`]/g;
  const matches = content.match(unescapedEntities);
  if (matches && matches.length > 0) {
    log.warning('Possible unescaped entities detected');
  }
  
  if (issues.length > 0) {
    issues.forEach(issue => log.error(issue));
    return { valid: false, issues };
  }
  
  log.success('React patterns check passed');
  return { valid: true };
}

// Check for security issues
function checkSecurity(filePath) {
  log.section('Security Check');
  
  const content = fs.readFileSync(filePath, 'utf8');
  const warnings = [];
  
  // Check for hardcoded secrets
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
    /password\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][^"']+["']/i,
  ];
  
  secretPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      warnings.push('Possible hardcoded secret detected');
    }
  });
  
  // Check for dangerous patterns
  if (content.includes('dangerouslySetInnerHTML')) {
    warnings.push('Using dangerouslySetInnerHTML - ensure content is sanitized');
  }
  
  if (content.includes('eval(')) {
    warnings.push('Using eval() is dangerous and should be avoided');
  }
  
  if (warnings.length > 0) {
    warnings.forEach(warning => log.warning(warning));
  } else {
    log.success('No security issues detected');
  }
  
  return { warnings };
}

// Main validation function
async function validateFile(filePath) {
  console.log(`\n${colors.bold}${colors.blue}🔍 Validating: ${filePath}${colors.reset}`);
  
  if (!fs.existsSync(filePath)) {
    log.error('File does not exist');
    return false;
  }
  
  if (!shouldValidateFile(filePath)) {
    log.info('File type not supported for validation');
    return true;
  }
  
  let hasErrors = false;
  
  // Run all checks
  const tsResult = checkTypeScript(filePath);
  hasErrors = hasErrors || !tsResult.valid;
  
  const eslintResult = checkESLint(filePath);
  hasErrors = hasErrors || !eslintResult.valid;
  
  const reactResult = checkReactPatterns(filePath);
  hasErrors = hasErrors || !reactResult.valid;
  
  // Format with Prettier (non-blocking)
  formatWithPrettier(filePath);
  
  // Security check (non-blocking)
  checkSecurity(filePath);
  
  // Summary
  console.log(`\n${colors.bold}${hasErrors ? colors.red : colors.green}Summary:${colors.reset}`);
  if (hasErrors) {
    log.error('Validation failed - please fix the errors above');
    
    // Provide helpful suggestions
    console.log(`\n${colors.cyan}💡 Quick fixes:${colors.reset}`);
    console.log('  • Run "npm run lint:fix" to auto-fix ESLint issues');
    console.log('  • Check TypeScript errors with "npm run type-check"');
    console.log('  • Format code with "npm run format"');
  } else {
    log.success('All checks passed! ✨');
  }
  
  return !hasErrors;
}

// Get file path from arguments or environment
function getFilePath() {
  // Check command line arguments
  if (process.argv.length > 2) {
    return process.argv[2];
  }
  
  // Check environment variable (set by Claude Code)
  if (process.env.CLAUDE_EDITED_FILE) {
    return process.env.CLAUDE_EDITED_FILE;
  }
  
  return null;
}

// Main execution
async function main() {
  const filePath = getFilePath();
  
  if (!filePath) {
    log.error('No file path provided');
    process.exit(1);
  }
  
  const isValid = await validateFile(filePath);
  process.exit(isValid ? 0 : 1);
}

// Run the hook
main().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});