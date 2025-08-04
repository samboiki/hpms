#!/bin/bash

# Complete setup script for JSX validation system
# Run this from your project root: ~/projects/hpms

echo "🚀 Setting up JSX Validation System for Claude Code"
echo "Project: $(pwd)"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Create directory structure
echo -e "${BLUE}Creating .claude directory structure...${NC}"
mkdir -p .claude/transforms
mkdir -p .claude/backups

# Step 2: Create config.json
echo -e "${BLUE}Creating configuration file...${NC}"
cat > .claude/config.json << 'EOF'
{
  "autoFix": true,
  "strictMode": false,
  "backupBeforeFix": true,
  "enabledFor": [".jsx", ".tsx"],
  "maxAutoFixAttempts": 3,
  "reportStyle": "detailed",
  "customTransformsDir": ".claude/transforms"
}
EOF

# Step 3: Create jsx-validator.mjs
echo -e "${BLUE}Creating JSX validator...${NC}"
cat > .claude/jsx-validator.mjs << 'EOF'
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import chalk from 'chalk';

export class JSXValidator {
  constructor(config = {}) {
    this.config = {
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      sourceType: 'module',
      errorRecovery: false,
      ...config
    };
    this.issues = [];
  }

  async validateJSXStructure(code, filePath) {
    this.issues = [];
    const elementStack = [];
    
    try {
      const ast = parse(code, {
        ...this.config,
        errorRecovery: false
      });

      traverse.default(ast, {
        JSXElement: {
          enter(path) {
            const openingElement = path.node.openingElement;
            const closingElement = path.node.closingElement;
            
            if (openingElement && !openingElement.selfClosing) {
              const name = getElementName(openingElement.name);
              elementStack.push({
                name,
                line: openingElement.loc.start.line,
                column: openingElement.loc.start.column
              });
              
              if (closingElement) {
                const closingName = getElementName(closingElement.name);
                const expected = elementStack.pop();
                
                if (expected && expected.name !== closingName) {
                  this.issues.push({
                    type: 'mismatched-tag',
                    severity: 'error',
                    openingTag: expected,
                    closingTag: { 
                      name: closingName, 
                      line: closingElement.loc.end.line 
                    },
                    message: `Tag mismatch: <${expected.name}> closed with </${closingName}>`
                  });
                }
              }
            }
          },
          exit(path) {
            if (path.node.openingElement && 
                !path.node.openingElement.selfClosing && 
                !path.node.closingElement) {
              const name = getElementName(path.node.openingElement.name);
              this.issues.push({
                type: 'unclosed-tag',
                severity: 'error',
                line: path.node.openingElement.loc.start.line,
                name,
                message: `Unclosed tag <${name}>`
              });
            }
          }
        }
      });

      elementStack.forEach(({ name, line }) => {
        this.issues.push({
          type: 'unclosed-tag',
          severity: 'error',
          line,
          name,
          message: `Unclosed tag <${name}> at line ${line}`
        });
      });

      return {
        valid: this.issues.length === 0,
        issues: this.issues,
        ast
      };

    } catch (parseError) {
      return this.handleParseError(code, filePath, parseError);
    }
  }

  handleParseError(code, filePath, error) {
    const issues = [{
      type: 'parse-error',
      severity: 'error',
      line: error.loc?.line || 0,
      column: error.loc?.column || 0,
      message: error.message
    }];

    // Try to identify common JSX issues
    const lines = code.split('\n');
    const tagStack = [];
    
    lines.forEach((line, index) => {
      const openingMatches = line.match(/<([A-Za-z][A-Za-z0-9._]*|motion\.[A-Za-z]+)(?:\s|>)/g);
      const closingMatches = line.match(/<\/([A-Za-z][A-Za-z0-9._]*|motion\.[A-Za-z]+)>/g);
      
      if (openingMatches) {
        openingMatches.forEach(match => {
          const tagName = match.replace(/<|\s|>/g, '');
          if (!match.includes('/>')) {
            tagStack.push({ name: tagName, line: index + 1 });
          }
        });
      }
      
      if (closingMatches) {
        closingMatches.forEach(match => {
          const tagName = match.replace(/<\/|>/g, '');
          const lastTag = tagStack[tagStack.length - 1];
          
          if (!lastTag || lastTag.name !== tagName) {
            issues.push({
              type: 'tag-mismatch',
              severity: 'error',
              line: index + 1,
              expected: lastTag?.name || 'none',
              found: tagName,
              message: `Expected </${lastTag?.name || '???'}> but found </${tagName}>`
            });
          } else {
            tagStack.pop();
          }
        });
      }
    });

    return {
      valid: false,
      issues,
      originalError: error
    };
  }

  generateReport(validationResult, code) {
    const { issues } = validationResult;
    
    if (issues.length === 0) {
      console.log(chalk.green('✅ No JSX structure issues found!'));
      return;
    }

    console.log(chalk.red('\n═══ JSX Validation Report ═══\n'));
    
    issues.forEach(issue => {
      console.log(chalk.red(`⚠️  ${issue.message}`));
      if (issue.line) {
        console.log(chalk.gray(`   at line ${issue.line}`));
      }
    });
    
    console.log(chalk.red('\n════════════════════════════\n'));
  }
}

function getElementName(node) {
  if (t.isJSXIdentifier(node)) {
    return node.name;
  }
  if (t.isJSXMemberExpression(node)) {
    return `${getElementName(node.object)}.${node.property.name}`;
  }
  return 'unknown';
}

export function createValidator(config) {
  return new JSXValidator(config);
}
EOF

# Step 4: Create auto-fixer.mjs
echo -e "${BLUE}Creating auto-fixer...${NC}"
cat > .claude/auto-fixer.mjs << 'EOF'
import jscodeshift from 'jscodeshift';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import prettier from 'prettier';
import chalk from 'chalk';

export class JSXAutoFixer {
  constructor() {
    this.j = jscodeshift;
  }

  async init() {
    // Initialization if needed
  }

  async autoFix(code, issues, filePath) {
    let fixedCode = code;
    const appliedFixes = [];

    for (const issue of issues) {
      try {
        const result = await this.applyFix(fixedCode, issue);
        if (result.success) {
          fixedCode = result.code;
          appliedFixes.push(result.description);
        }
      } catch (error) {
        console.warn(`Failed to apply fix: ${error.message}`);
      }
    }

    if (appliedFixes.length > 0) {
      fixedCode = await this.formatCode(fixedCode, filePath);
    }

    return {
      code: fixedCode,
      fixed: appliedFixes.length > 0,
      appliedFixes
    };
  }

  async applyFix(code, issue) {
    const ast = this.j(code);
    
    switch (issue.type) {
      case 'unclosed-tag':
        return this.fixUnclosedTag(ast, issue);
      case 'mismatched-tag':
        return this.fixMismatchedTag(ast, issue);
      default:
        return { success: false };
    }
  }

  fixUnclosedTag(ast, issue) {
    const { name, line } = issue;
    let fixed = false;
    
    ast.find(this.j.JSXElement)
      .filter(path => {
        const opening = path.node.openingElement;
        return opening && 
               getElementName(opening.name) === name &&
               opening.loc.start.line === line &&
               !path.node.closingElement;
      })
      .forEach(path => {
        path.node.closingElement = this.j.jsxClosingElement(
          cloneJSXName(this.j, path.node.openingElement.name)
        );
        fixed = true;
      });
    
    return {
      success: fixed,
      code: ast.toSource(),
      description: `Added closing tag </${name}>`
    };
  }

  fixMismatchedTag(ast, issue) {
    const { openingTag, closingTag } = issue;
    let fixed = false;
    
    ast.find(this.j.JSXClosingElement)
      .filter(path => {
        return path.node.loc.end.line === closingTag.line;
      })
      .forEach(path => {
        path.node.name = createJSXName(this.j, openingTag.name);
        fixed = true;
      });
    
    return {
      success: fixed,
      code: ast.toSource(),
      description: `Fixed tag mismatch: </${closingTag.name}> → </${openingTag.name}>`
    };
  }

  async formatCode(code, filePath) {
    try {
      const config = await prettier.resolveConfig(filePath) || {};
      return prettier.format(code, {
        ...config,
        parser: filePath.endsWith('.tsx') ? 'typescript' : 'babel'
      });
    } catch (error) {
      return code;
    }
  }

  generateFixReport(result) {
    if (result.fixed) {
      console.log(chalk.green('\n✅ Applied fixes:'));
      result.appliedFixes.forEach(fix => {
        console.log(chalk.green(`   • ${fix}`));
      });
    }
  }
}

function getElementName(node) {
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${getElementName(node.object)}.${node.property.name}`;
  }
  return 'unknown';
}

function createJSXName(j, name) {
  if (name.includes('.')) {
    const parts = name.split('.');
    let result = j.jsxIdentifier(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      result = j.jsxMemberExpression(result, j.jsxIdentifier(parts[i]));
    }
    return result;
  }
  return j.jsxIdentifier(name);
}

function cloneJSXName(j, node) {
  if (node.type === 'JSXIdentifier') {
    return j.jsxIdentifier(node.name);
  }
  if (node.type === 'JSXMemberExpression') {
    return j.jsxMemberExpression(
      cloneJSXName(j, node.object),
      j.jsxIdentifier(node.property.name)
    );
  }
  return node;
}

export function createAutoFixer() {
  return new JSXAutoFixer();
}
EOF

# Step 5: Create the main hooks.mjs file
echo -e "${BLUE}Creating Claude hooks...${NC}"
cat > .claude/hooks.mjs << 'EOF'
import { createValidator } from './jsx-validator.mjs';
import { createAutoFixer } from './auto-fixer.mjs';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const validator = createValidator();
const autoFixer = createAutoFixer();
await autoFixer.init();

let config = {
  autoFix: true,
  strictMode: false,
  backupBeforeFix: true,
  enabledFor: ['.jsx', '.tsx'],
  maxAutoFixAttempts: 3
};

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
  }
};
EOF

# Step 6: Create a simple transform
echo -e "${BLUE}Creating transform for motion.div fixes...${NC}"
cat > .claude/transforms/fix-motion-tags.js << 'EOF'
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  // Fix motion.div closed with </div>
  root.find(j.JSXElement)
    .filter(path => {
      const opening = path.node.openingElement;
      const closing = path.node.closingElement;
      return opening && 
             getElementName(opening.name) === 'motion.div' &&
             closing &&
             getElementName(closing.name) === 'div';
    })
    .forEach(path => {
      path.node.closingElement.name = j.jsxMemberExpression(
        j.jsxIdentifier('motion'),
        j.jsxIdentifier('div')
      );
    });
  
  return root.toSource();
};

function getElementName(node) {
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${getElementName(node.object)}.${node.property.name}`;
  }
  return 'unknown';
}
EOF

# Step 7: Create test script
echo -e "${BLUE}Creating test script...${NC}"
cat > test-jsx.js << 'EOF'
#!/usr/bin/env node
import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';

async function test() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node test-jsx.js <file>');
    process.exit(1);
  }

  const validator = createValidator();
  const fixer = createAutoFixer();
  await fixer.init();

  const content = await fs.readFile(file, 'utf-8');
  const result = await validator.validateJSXStructure(content, file);
  
  validator.generateReport(result, content);
  
  if (!result.valid && process.argv[3] !== '--no-fix') {
    const fixed = await fixer.autoFix(content, result.issues, file);
    fixer.generateFixReport(fixed);
  }
}

test().catch(console.error);
EOF

chmod +x test-jsx.js

# Step 8: Update .gitignore
echo -e "${BLUE}Updating .gitignore...${NC}"
if ! grep -q ".claude/backups" .gitignore 2>/dev/null; then
    echo -e "\n# Claude Code backups\n.claude/backups/" >> .gitignore
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the system: node test-jsx.js src/components/YourComponent.jsx"
echo "2. Claude Code will now automatically validate JSX files"
echo "3. Configure settings in .claude/config.json if needed"
echo ""
echo -e "${GREEN}The system is now active for .jsx and .tsx files!${NC}"
