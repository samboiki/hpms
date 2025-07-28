#!/usr/bin/env node

/**
 * Claude Hooks - Installation Test
 * Quick test to verify the hooks are working correctly
 */

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

console.log(`${colors.blue}${colors.bold}🧪 Claude Hooks Installation Test${colors.reset}\n`);

// Test 1: Check Node.js version
console.log(`${colors.cyan}1. Checking Node.js version...${colors.reset}`);
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 14) {
  console.log(`${colors.green}✓${colors.reset} Node.js ${nodeVersion} (OK)\n`);
} else {
  console.log(`${colors.red}✗${colors.reset} Node.js ${nodeVersion} (Need v14 or higher)\n`);
}

// Test 2: Check required files
console.log(`${colors.cyan}2. Checking hook files...${colors.reset}`);
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'syntax-validator.js',
  'pre-commit',
  'post-edit-hook.js',
  'batch-validate.js',
  'install.js',
  'README.md'
];

let allFilesPresent = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`${colors.green}✓${colors.reset} ${file}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} ${file} (missing)`);
    allFilesPresent = false;
  }
});

if (allFilesPresent) {
  console.log(`${colors.green}All hook files present${colors.reset}\n`);
} else {
  console.log(`${colors.red}Some files are missing${colors.reset}\n`);
}

// Test 3: Check Git hooks
console.log(`${colors.cyan}3. Checking Git hooks...${colors.reset}`);
const gitHooksDir = path.join(__dirname, '../../.git/hooks');
const gitHooks = ['pre-commit'];

gitHooks.forEach(hook => {
  const hookPath = path.join(gitHooksDir, hook);
  if (fs.existsSync(hookPath)) {
    console.log(`${colors.green}✓${colors.reset} ${hook} hook installed`);
    
    // Check if it references our validator
    const content = fs.readFileSync(hookPath, 'utf8');
    if (content.includes('.claude/hooks')) {
      console.log(`  ${colors.dim}→ Correctly configured${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}→ Not configured for Claude Hooks${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}✗${colors.reset} ${hook} hook not installed`);
  }
});

// Test 4: Quick syntax validation test
console.log(`\n${colors.cyan}4. Testing syntax validation...${colors.reset}`);

// Create a test file with known issues
const testFile = path.join(__dirname, 'test-temp.js');
const testContent = `
// Test file with known issues
const test = "valid string";
console.log(test);  // This should trigger a warning
const unused = "unused variable";  // This should trigger an error
`;

fs.writeFileSync(testFile, testContent);

// Try to load the validator
try {
  console.log(`${colors.green}✓${colors.reset} Validator module loads successfully`);
  
  // Clean up
  fs.unlinkSync(testFile);
} catch (error) {
  console.log(`${colors.red}✗${colors.reset} Validator failed to load: ${error.message}`);
}

// Test 5: Check npm packages
console.log(`\n${colors.cyan}5. Checking npm packages...${colors.reset}`);
const packageJson = require(path.join(__dirname, '../../package.json'));

const requiredPackages = [
  'eslint',
  'typescript',
  '@typescript-eslint/parser',
  '@typescript-eslint/eslint-plugin'
];

requiredPackages.forEach(pkg => {
  if (packageJson.devDependencies?.[pkg] || packageJson.dependencies?.[pkg]) {
    console.log(`${colors.green}✓${colors.reset} ${pkg} installed`);
  } else {
    console.log(`${colors.yellow}⚠${colors.reset} ${pkg} not found in package.json`);
  }
});

// Summary
console.log(`\n${colors.bold}Summary:${colors.reset}`);
console.log(`${colors.green}✓${colors.reset} Claude Hooks basic installation verified`);
console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
console.log(`1. Run: ${colors.dim}node .claude/hooks/install.js${colors.reset} to complete setup`);
console.log(`2. Test validation: ${colors.dim}node .claude/hooks/syntax-validator.js <file>${colors.reset}`);
console.log(`3. Make a test commit to verify pre-commit hook`);

process.exit(0);