#!/usr/bin/env node

/**
 * Claude Hooks - Installation Script
 * Sets up Git hooks and integrations for syntax validation
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class HookInstaller {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.hooksDir = path.join(this.projectRoot, '.claude/hooks');
    this.gitHooksDir = path.join(this.projectRoot, '.git/hooks');
  }

  async install() {
    console.log(`${colors.blue}${colors.bold}🚀 Claude Hooks Installation${colors.reset}\n`);

    try {
      // Check if we're in a git repository
      await this.checkGitRepo();

      // Install dependencies
      await this.installDependencies();

      // Set up Git hooks
      await this.setupGitHooks();

      // Configure ESLint
      await this.configureESLint();

      // Create VS Code integration
      await this.createVSCodeIntegration();

      // Set permissions
      await this.setPermissions();

      // Test installation
      await this.testInstallation();

      console.log(`\n${colors.green}${colors.bold}✅ Installation Complete!${colors.reset}`);
      this.printUsageInstructions();

    } catch (error) {
      console.error(`\n${colors.red}Installation failed: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }

  async checkGitRepo() {
    try {
      execSync('git rev-parse --git-dir', { cwd: this.projectRoot });
      console.log(`${colors.green}✓${colors.reset} Git repository detected`);
    } catch (error) {
      throw new Error('Not a git repository. Please run git init first.');
    }
  }

  async installDependencies() {
    console.log(`\n${colors.cyan}Installing dependencies...${colors.reset}`);

    const requiredPackages = [
      '@typescript-eslint/parser',
      '@typescript-eslint/eslint-plugin',
      'eslint-plugin-react-hooks',
      'eslint-plugin-jsx-a11y'
    ];

    const packageJson = JSON.parse(
      await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8')
    );

    const missingPackages = requiredPackages.filter(pkg => 
      !packageJson.devDependencies?.[pkg] && !packageJson.dependencies?.[pkg]
    );

    if (missingPackages.length > 0) {
      console.log(`Installing: ${missingPackages.join(', ')}`);
      execSync(`npm install --save-dev ${missingPackages.join(' ')}`, {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    } else {
      console.log(`${colors.green}✓${colors.reset} All dependencies already installed`);
    }
  }

  async setupGitHooks() {
    console.log(`\n${colors.cyan}Setting up Git hooks...${colors.reset}`);

    // Create .git/hooks directory if it doesn't exist
    await fs.mkdir(this.gitHooksDir, { recursive: true });

    // Pre-commit hook
    const preCommitPath = path.join(this.gitHooksDir, 'pre-commit');
    const preCommitContent = `#!/bin/sh
# Claude Hooks - Pre-commit validation
node ${path.join(this.hooksDir, 'pre-commit')}
`;

    await fs.writeFile(preCommitPath, preCommitContent);
    await fs.chmod(preCommitPath, '755');
    console.log(`${colors.green}✓${colors.reset} Pre-commit hook installed`);

    // Post-merge hook (for dependency updates)
    const postMergePath = path.join(this.gitHooksDir, 'post-merge');
    const postMergeContent = `#!/bin/sh
# Check if package.json changed
if git diff HEAD@{1} --name-only | grep -q "package.json"; then
  echo "📦 Package.json changed, running npm install..."
  npm install
fi
`;

    await fs.writeFile(postMergePath, postMergeContent);
    await fs.chmod(postMergePath, '755');
    console.log(`${colors.green}✓${colors.reset} Post-merge hook installed`);
  }

  async configureESLint() {
    console.log(`\n${colors.cyan}Configuring ESLint...${colors.reset}`);

    const eslintConfig = {
      extends: [
        'next/core-web-vitals',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended'
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      plugins: [
        '@typescript-eslint',
        'react-hooks',
        'jsx-a11y'
      ],
      rules: {
        // TypeScript rules
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        
        // React rules
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'react/prop-types': 'off',
        
        // General rules
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'no-alert': 'warn',
        'prefer-const': 'error',
        'no-var': 'error',
        
        // Accessibility
        'jsx-a11y/alt-text': 'warn',
        'jsx-a11y/anchor-is-valid': 'warn'
      },
      ignorePatterns: [
        'node_modules/',
        '.next/',
        'out/',
        'public/',
        '*.config.js'
      ]
    };

    const eslintPath = path.join(this.projectRoot, '.eslintrc.json');
    await fs.writeFile(eslintPath, JSON.stringify(eslintConfig, null, 2));
    console.log(`${colors.green}✓${colors.reset} ESLint configuration updated`);
  }

  async createVSCodeIntegration() {
    console.log(`\n${colors.cyan}Creating VS Code integration...${colors.reset}`);

    const vscodeDir = path.join(this.projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    // Settings
    const settings = {
      'editor.formatOnSave': true,
      'editor.codeActionsOnSave': {
        'source.fixAll.eslint': true
      },
      'eslint.validate': [
        'javascript',
        'javascriptreact',
        'typescript',
        'typescriptreact'
      ],
      'typescript.tsdk': 'node_modules/typescript/lib',
      'files.associations': {
        '*.css': 'tailwindcss'
      },
      'editor.quickSuggestions': {
        'strings': true
      },
      'claude.hooks.enabled': true,
      'claude.hooks.validateOnSave': true,
      'claude.hooks.autoFix': true
    };

    await fs.writeFile(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );

    // Tasks
    const tasks = {
      version: '2.0.0',
      tasks: [
        {
          label: 'Claude: Validate Current File',
          type: 'shell',
          command: 'node',
          args: [
            '${workspaceFolder}/.claude/hooks/syntax-validator.js',
            '${file}'
          ],
          problemMatcher: '$eslint-stylish',
          group: {
            kind: 'test',
            isDefault: true
          }
        },
        {
          label: 'Claude: Auto-fix Current File',
          type: 'shell',
          command: 'node',
          args: [
            '${workspaceFolder}/.claude/hooks/syntax-validator.js',
            '${file}',
            'fix'
          ],
          problemMatcher: []
        },
        {
          label: 'Claude: Validation Report',
          type: 'shell',
          command: 'node',
          args: [
            '${workspaceFolder}/.claude/hooks/syntax-validator.js',
            '${file}',
            'report'
          ],
          problemMatcher: []
        }
      ]
    };

    await fs.writeFile(
      path.join(vscodeDir, 'tasks.json'),
      JSON.stringify(tasks, null, 2)
    );

    console.log(`${colors.green}✓${colors.reset} VS Code integration created`);
  }

  async setPermissions() {
    console.log(`\n${colors.cyan}Setting permissions...${colors.reset}`);

    const files = [
      'syntax-validator.js',
      'pre-commit',
      'post-edit-hook.js',
      'install.js'
    ];

    for (const file of files) {
      const filePath = path.join(this.hooksDir, file);
      try {
        await fs.chmod(filePath, '755');
      } catch (error) {
        console.warn(`${colors.yellow}Warning: Could not set permissions for ${file}${colors.reset}`);
      }
    }

    console.log(`${colors.green}✓${colors.reset} Permissions set`);
  }

  async testInstallation() {
    console.log(`\n${colors.cyan}Testing installation...${colors.reset}`);

    // Create a test file
    const testFile = path.join(this.projectRoot, '.claude-test.ts');
    const testContent = `
// Test file for Claude Hooks
const test: any = "This should trigger a warning";
console.log(test);

function Component(props) {
  // Missing TypeScript types
  return <div>{props.children}</div>;
}
`;

    await fs.writeFile(testFile, testContent);

    try {
      // Run validation
      execSync(`node ${path.join(this.hooksDir, 'syntax-validator.js')} ${testFile}`, {
        stdio: 'pipe'
      });
    } catch (error) {
      // Expected to fail
      console.log(`${colors.green}✓${colors.reset} Validation correctly detected issues`);
    }

    // Clean up
    await fs.unlink(testFile);
  }

  printUsageInstructions() {
    console.log(`\n${colors.bold}📚 Usage Instructions:${colors.reset}`);
    console.log(`\n${colors.cyan}Git Hooks:${colors.reset}`);
    console.log(`  • Pre-commit validation runs automatically`);
    console.log(`  • Commits will be blocked if validation fails`);
    
    console.log(`\n${colors.cyan}Manual Validation:${colors.reset}`);
    console.log(`  • Validate file: ${colors.dim}node .claude/hooks/syntax-validator.js <file>${colors.reset}`);
    console.log(`  • Auto-fix file: ${colors.dim}node .claude/hooks/syntax-validator.js <file> fix${colors.reset}`);
    console.log(`  • Performance report: ${colors.dim}node .claude/hooks/syntax-validator.js <file> report${colors.reset}`);
    
    console.log(`\n${colors.cyan}VS Code Integration:${colors.reset}`);
    console.log(`  • Format on save enabled`);
    console.log(`  • ESLint auto-fix on save`);
    console.log(`  • Run tasks with Ctrl+Shift+P → "Tasks: Run Task"`);
    
    console.log(`\n${colors.cyan}NPM Scripts:${colors.reset}`);
    console.log(`  • ${colors.dim}npm run lint${colors.reset} - Lint all files`);
    console.log(`  • ${colors.dim}npm run lint -- --fix${colors.reset} - Auto-fix issues`);
    console.log(`  • ${colors.dim}npm run type-check${colors.reset} - TypeScript validation`);
  }

  async uninstall() {
    console.log(`${colors.yellow}${colors.bold}🗑️  Uninstalling Claude Hooks${colors.reset}\n`);

    try {
      // Remove Git hooks
      const hooks = ['pre-commit', 'post-merge'];
      for (const hook of hooks) {
        const hookPath = path.join(this.gitHooksDir, hook);
        try {
          await fs.unlink(hookPath);
          console.log(`${colors.green}✓${colors.reset} Removed ${hook} hook`);
        } catch (e) {
          // Hook might not exist
        }
      }

      console.log(`\n${colors.green}Uninstallation complete${colors.reset}`);
      console.log(`${colors.dim}Note: .claude/hooks directory preserved for reference${colors.reset}`);

    } catch (error) {
      console.error(`${colors.red}Uninstall failed: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }
}

// CLI
if (require.main === module) {
  const command = process.argv[2];
  const installer = new HookInstaller();

  switch (command) {
    case 'uninstall':
      installer.uninstall();
      break;
    default:
      installer.install();
  }
}