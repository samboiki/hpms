#!/usr/bin/env node

/**
 * Claude Hooks - Syntax Validator Engine
 * World-class JavaScript/TypeScript syntax validation with smart error detection
 */

const { ESLint } = require('eslint');
const ts = require('typescript');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ANSI color codes for better error visibility
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

class SyntaxValidator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.eslint = null;
    this.tsConfigPath = null;
    this.cache = new Map();
    this.performanceMetrics = {
      totalValidations: 0,
      totalTime: 0,
      cacheHits: 0
    };
  }

  async initialize() {
    // Find ESLint config
    const eslintConfig = await this.findConfig('.eslintrc', ['.json', '.js', '.yaml', '.yml']);
    
    // Initialize ESLint with project config
    this.eslint = new ESLint({
      baseConfig: eslintConfig || {
        extends: ['next/core-web-vitals'],
        rules: {
          'no-console': 'warn',
          'no-unused-vars': 'error',
          '@typescript-eslint/no-explicit-any': 'error',
          '@typescript-eslint/no-unused-vars': 'error'
        }
      },
      fix: true,
      cache: true,
      cacheLocation: path.join(this.projectRoot, '.claude/hooks/.eslintcache')
    });

    // Find TypeScript config
    this.tsConfigPath = await this.findConfig('tsconfig', ['.json']);
  }

  async findConfig(baseName, extensions) {
    for (const ext of extensions) {
      const configPath = path.join(this.projectRoot, `${baseName}${ext}`);
      try {
        await fs.access(configPath);
        return require(configPath);
      } catch (e) {
        // Continue searching
      }
    }
    return null;
  }

  async validateFile(filePath, content = null) {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `${filePath}:${content ? content.length : 'file'}`;
    if (this.cache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.cache.get(cacheKey);
    }

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      fixable: false,
      fixed: false,
      performance: {}
    };

    try {
      // Read file content if not provided
      if (!content) {
        content = await fs.readFile(filePath, 'utf8');
      }

      // Determine file type
      const ext = path.extname(filePath);
      const isTypeScript = ['.ts', '.tsx'].includes(ext);
      const isJavaScript = ['.js', '.jsx'].includes(ext);

      if (!isTypeScript && !isJavaScript) {
        results.errors.push({
          type: 'file',
          message: 'Not a JavaScript/TypeScript file',
          severity: 'info'
        });
        return results;
      }

      // TypeScript validation
      if (isTypeScript) {
        const tsResults = await this.validateTypeScript(filePath, content);
        results.errors.push(...tsResults.errors);
        results.warnings.push(...tsResults.warnings);
        results.valid = results.valid && tsResults.valid;
      }

      // ESLint validation
      const eslintResults = await this.validateESLint(filePath, content);
      results.errors.push(...eslintResults.errors);
      results.warnings.push(...eslintResults.warnings);
      results.fixable = eslintResults.fixable;
      results.fixed = eslintResults.fixed;
      results.valid = results.valid && eslintResults.valid;

      // Smart error detection
      const smartErrors = await this.detectSmartErrors(content, isTypeScript);
      results.errors.push(...smartErrors);

      // Performance metrics
      const endTime = Date.now();
      results.performance = {
        duration: endTime - startTime,
        fileSize: content.length,
        errorCount: results.errors.length,
        warningCount: results.warnings.length
      };

      // Update metrics
      this.performanceMetrics.totalValidations++;
      this.performanceMetrics.totalTime += results.performance.duration;

      // Cache results
      this.cache.set(cacheKey, results);

      return results;
    } catch (error) {
      results.valid = false;
      results.errors.push({
        type: 'system',
        message: `Validation failed: ${error.message}`,
        severity: 'error'
      });
      return results;
    }
  }

  async validateTypeScript(filePath, content) {
    const results = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Create a temporary program for validation
      const compilerOptions = this.tsConfigPath ? 
        require(this.tsConfigPath).compilerOptions : 
        {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.React,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        };

      // Parse the file
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // Check for syntax errors
      const syntaxErrors = [];
      const checkNode = (node) => {
        if (node.kind === ts.SyntaxKind.Unknown) {
          syntaxErrors.push({
            type: 'typescript',
            line: ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1,
            column: ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).character + 1,
            message: 'Unknown syntax',
            severity: 'error'
          });
        }
        ts.forEachChild(node, checkNode);
      };
      checkNode(sourceFile);

      // Run TypeScript compiler
      const program = ts.createProgram([filePath], compilerOptions);
      const diagnostics = ts.getPreEmitDiagnostics(program);

      diagnostics.forEach(diagnostic => {
        const { line, character } = diagnostic.file ? 
          ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start) :
          { line: 0, character: 0 };

        const error = {
          type: 'typescript',
          line: line + 1,
          column: character + 1,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          code: `TS${diagnostic.code}`,
          severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning'
        };

        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          results.errors.push(error);
          results.valid = false;
        } else {
          results.warnings.push(error);
        }
      });

      results.errors.push(...syntaxErrors);
      if (syntaxErrors.length > 0) {
        results.valid = false;
      }

    } catch (error) {
      results.valid = false;
      results.errors.push({
        type: 'typescript',
        message: `TypeScript validation error: ${error.message}`,
        severity: 'error'
      });
    }

    return results;
  }

  async validateESLint(filePath, content) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      fixable: false,
      fixed: false
    };

    try {
      // Lint the file
      const lintResults = await this.eslint.lintText(content, {
        filePath: filePath
      });

      for (const result of lintResults) {
        if (result.errorCount > 0 || result.warningCount > 0) {
          result.messages.forEach(message => {
            const error = {
              type: 'eslint',
              line: message.line,
              column: message.column,
              message: message.message,
              rule: message.ruleId,
              severity: message.severity === 2 ? 'error' : 'warning',
              fixable: message.fix !== undefined
            };

            if (message.severity === 2) {
              results.errors.push(error);
              results.valid = false;
            } else {
              results.warnings.push(error);
            }

            if (message.fix) {
              results.fixable = true;
            }
          });
        }

        // Check if fixes were applied
        if (result.output && result.output !== content) {
          results.fixed = true;
          results.fixedContent = result.output;
        }
      }
    } catch (error) {
      results.valid = false;
      results.errors.push({
        type: 'eslint',
        message: `ESLint validation error: ${error.message}`,
        severity: 'error'
      });
    }

    return results;
  }

  async detectSmartErrors(content, isTypeScript) {
    const errors = [];

    // Common React/Next.js patterns
    const patterns = [
      {
        regex: /console\.(log|error|warn|info)/g,
        message: 'Console statements should be removed in production',
        severity: 'warning'
      },
      {
        regex: /import\s+.*\s+from\s+['"](?!@\/|\.\/|\.\.\/|react|next)/,
        message: 'Consider using path aliases (@/) for imports',
        severity: 'info'
      },
      {
        regex: /any(?:\s|>|,|\))/g,
        message: 'Avoid using "any" type in TypeScript',
        severity: 'warning',
        typeScriptOnly: true
      },
      {
        regex: /useState\s*\(\s*\)/g,
        message: 'useState should have an initial value or explicit type',
        severity: 'warning'
      },
      {
        regex: /useEffect\s*\(\s*\(\s*\)\s*=>\s*{[\s\S]*?}\s*\)/g,
        message: 'useEffect missing dependency array',
        severity: 'error'
      },
      {
        regex: /className\s*=\s*{[^}]*\?\s*['"][^'"]*['"]\s*:\s*['"]['"]}/g,
        message: 'Empty className in conditional - use clsx or cn utility',
        severity: 'info'
      }
    ];

    patterns.forEach(pattern => {
      if (pattern.typeScriptOnly && !isTypeScript) return;

      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const lines = content.substring(0, match.index).split('\n');
        errors.push({
          type: 'pattern',
          line: lines.length,
          column: lines[lines.length - 1].length + 1,
          message: pattern.message,
          severity: pattern.severity
        });
      }
    });

    // Check for common security issues
    const securityPatterns = [
      {
        regex: /dangerouslySetInnerHTML/g,
        message: 'Avoid dangerouslySetInnerHTML - potential XSS vulnerability',
        severity: 'error'
      },
      {
        regex: /eval\s*\(/g,
        message: 'Avoid eval() - security and performance risk',
        severity: 'error'
      },
      {
        regex: /(api|key|secret|password)\s*[:=]\s*['"]/gi,
        message: 'Potential hardcoded credentials detected',
        severity: 'error'
      }
    ];

    securityPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const lines = content.substring(0, match.index).split('\n');
        errors.push({
          type: 'security',
          line: lines.length,
          column: lines[lines.length - 1].length + 1,
          message: pattern.message,
          severity: pattern.severity
        });
      }
    });

    return errors;
  }

  formatResults(results, filePath) {
    const output = [];
    
    // Header
    if (results.valid) {
      output.push(`${colors.green}✓ Valid${colors.reset} ${filePath}`);
    } else {
      output.push(`${colors.red}✗ Invalid${colors.reset} ${filePath}`);
    }

    // Performance info
    if (results.performance) {
      output.push(`${colors.dim}  Validated in ${results.performance.duration}ms${colors.reset}`);
    }

    // Errors
    if (results.errors.length > 0) {
      output.push(`\n${colors.red}${colors.bold}Errors (${results.errors.length})${colors.reset}`);
      results.errors.forEach(error => {
        const location = error.line ? `${error.line}:${error.column}` : '';
        const rule = error.rule ? ` (${error.rule})` : '';
        output.push(`  ${colors.red}●${colors.reset} ${location} ${error.message}${rule}`);
      });
    }

    // Warnings
    if (results.warnings.length > 0) {
      output.push(`\n${colors.yellow}${colors.bold}Warnings (${results.warnings.length})${colors.reset}`);
      results.warnings.forEach(warning => {
        const location = warning.line ? `${warning.line}:${warning.column}` : '';
        const rule = warning.rule ? ` (${warning.rule})` : '';
        output.push(`  ${colors.yellow}●${colors.reset} ${location} ${warning.message}${rule}`);
      });
    }

    // Fix available
    if (results.fixable) {
      output.push(`\n${colors.cyan}ℹ${colors.reset} Some errors are auto-fixable`);
    }

    return output.join('\n');
  }

  async autoFix(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const results = await this.validateFile(filePath, content);

      if (results.fixed && results.fixedContent) {
        await fs.writeFile(filePath, results.fixedContent);
        return {
          success: true,
          message: 'Auto-fix applied successfully'
        };
      }

      return {
        success: false,
        message: results.fixable ? 'No auto-fix available' : 'No fixable errors found'
      };
    } catch (error) {
      return {
        success: false,
        message: `Auto-fix failed: ${error.message}`
      };
    }
  }

  getPerformanceReport() {
    const avgTime = this.performanceMetrics.totalValidations > 0 ?
      (this.performanceMetrics.totalTime / this.performanceMetrics.totalValidations).toFixed(2) :
      0;

    const cacheHitRate = this.performanceMetrics.totalValidations > 0 ?
      ((this.performanceMetrics.cacheHits / this.performanceMetrics.totalValidations) * 100).toFixed(1) :
      0;

    return {
      totalValidations: this.performanceMetrics.totalValidations,
      averageTime: `${avgTime}ms`,
      cacheHitRate: `${cacheHitRate}%`,
      totalTime: `${this.performanceMetrics.totalTime}ms`
    };
  }
}

module.exports = SyntaxValidator;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const command = args[1];

  if (!filePath) {
    console.error('Usage: syntax-validator.js <file-path> [command]');
    console.error('Commands: validate (default), fix, report');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '../..');
  const validator = new SyntaxValidator(projectRoot);

  (async () => {
    await validator.initialize();

    switch (command) {
      case 'fix':
        const fixResult = await validator.autoFix(filePath);
        console.log(fixResult.message);
        break;
      
      case 'report':
        const report = validator.getPerformanceReport();
        console.log('Performance Report:');
        console.log(JSON.stringify(report, null, 2));
        break;
      
      default:
        const results = await validator.validateFile(filePath);
        console.log(validator.formatResults(results, filePath));
        process.exit(results.valid ? 0 : 1);
    }
  })();
}