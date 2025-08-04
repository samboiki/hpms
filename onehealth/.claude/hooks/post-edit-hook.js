#!/usr/bin/env node

/**
 * Claude Hooks - Post-Edit Hook
 * Validates syntax after Edit/Write operations and provides intelligent feedback
 */

const path = require('path');
const fs = require('fs').promises;
const SyntaxValidator = require('./syntax-validator');

// ANSI colors
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

class PostEditValidator {
  constructor() {
    this.validator = null;
    this.contextCache = new Map();
  }

  async initialize() {
    const projectRoot = path.resolve(__dirname, '../..');
    this.validator = new SyntaxValidator(projectRoot);
    await this.validator.initialize();
  }

  async validateEdit(filePath, content, operation = 'edit') {
    console.log(`\n${colors.blue}${colors.bold}🔍 Claude Post-${operation} Validation${colors.reset}`);
    console.log(`${colors.dim}File: ${filePath}${colors.reset}\n`);

    try {
      // Validate the file
      const results = await this.validator.validateFile(filePath, content);
      
      // Format and display results
      this.displayResults(results, filePath);

      // Provide intelligent suggestions
      if (!results.valid || results.warnings.length > 0) {
        await this.provideSuggestions(results, filePath, content);
      }

      // Auto-fix if possible
      if (results.fixable && !results.valid) {
        await this.suggestAutoFix(filePath, results);
      }

      // Context-aware validation
      await this.performContextValidation(filePath, content);

      // Update context cache
      this.updateContextCache(filePath, results);

      return results;

    } catch (error) {
      console.error(`${colors.red}Validation error: ${error.message}${colors.reset}`);
      return {
        valid: false,
        errors: [{
          type: 'system',
          message: error.message,
          severity: 'error'
        }]
      };
    }
  }

  displayResults(results, filePath) {
    if (results.valid && results.warnings.length === 0) {
      console.log(`${colors.green}${colors.bold}✓ Syntax Valid${colors.reset}`);
      if (results.performance) {
        console.log(`${colors.dim}  Validated in ${results.performance.duration}ms${colors.reset}`);
      }
      return;
    }

    // Display errors
    if (results.errors.length > 0) {
      console.log(`${colors.red}${colors.bold}✗ Errors Found (${results.errors.length})${colors.reset}\n`);
      
      results.errors.forEach((error, index) => {
        this.displayError(error, index + 1);
      });
    }

    // Display warnings
    if (results.warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bold}⚠ Warnings (${results.warnings.length})${colors.reset}\n`);
      
      results.warnings.forEach((warning, index) => {
        this.displayWarning(warning, index + 1);
      });
    }
  }

  displayError(error, index) {
    const location = error.line ? `Line ${error.line}:${error.column}` : 'General';
    const badge = this.getErrorBadge(error.type);
    
    console.log(`  ${colors.red}${index}.${colors.reset} ${badge} ${location}`);
    console.log(`     ${colors.bold}${error.message}${colors.reset}`);
    
    if (error.rule) {
      console.log(`     ${colors.dim}Rule: ${error.rule}${colors.reset}`);
    }
    
    if (error.code) {
      console.log(`     ${colors.dim}Code: ${error.code}${colors.reset}`);
    }
  }

  displayWarning(warning, index) {
    const location = warning.line ? `Line ${warning.line}:${warning.column}` : 'General';
    const badge = this.getErrorBadge(warning.type);
    
    console.log(`  ${colors.yellow}${index}.${colors.reset} ${badge} ${location}`);
    console.log(`     ${warning.message}`);
    
    if (warning.rule) {
      console.log(`     ${colors.dim}Rule: ${warning.rule}${colors.reset}`);
    }
  }

  getErrorBadge(type) {
    const badges = {
      'typescript': `${colors.blue}[TS]${colors.reset}`,
      'eslint': `${colors.magenta}[ESLint]${colors.reset}`,
      'pattern': `${colors.cyan}[Pattern]${colors.reset}`,
      'security': `${colors.red}[Security]${colors.reset}`,
      'system': `${colors.yellow}[System]${colors.reset}`
    };
    
    return badges[type] || `${colors.dim}[${type}]${colors.reset}`;
  }

  async provideSuggestions(results, filePath, content) {
    console.log(`\n${colors.cyan}${colors.bold}💡 Suggestions:${colors.reset}\n`);

    const suggestions = [];

    // TypeScript-specific suggestions
    const tsErrors = results.errors.filter(e => e.type === 'typescript');
    if (tsErrors.length > 0) {
      suggestions.push(...this.getTypeScriptSuggestions(tsErrors));
    }

    // ESLint-specific suggestions
    const eslintErrors = results.errors.filter(e => e.type === 'eslint');
    if (eslintErrors.length > 0) {
      suggestions.push(...this.getESLintSuggestions(eslintErrors));
    }

    // Pattern-based suggestions
    const patternErrors = results.errors.filter(e => e.type === 'pattern');
    if (patternErrors.length > 0) {
      suggestions.push(...this.getPatternSuggestions(patternErrors));
    }

    // Security suggestions
    const securityErrors = results.errors.filter(e => e.type === 'security');
    if (securityErrors.length > 0) {
      suggestions.push(...this.getSecuritySuggestions(securityErrors));
    }

    // Display suggestions
    suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion}`);
    });

    // Quick fixes
    if (results.fixable) {
      console.log(`\n  ${colors.green}→${colors.reset} Run auto-fix: ${colors.cyan}node .claude/hooks/syntax-validator.js "${filePath}" fix${colors.reset}`);
    }
  }

  getTypeScriptSuggestions(errors) {
    const suggestions = [];
    
    for (const error of errors) {
      if (error.message.includes('any')) {
        suggestions.push('Define explicit types instead of using "any". Consider using unknown or a specific interface.');
      }
      if (error.message.includes('implicitly has type')) {
        suggestions.push('Add explicit type annotations to avoid implicit any types.');
      }
      if (error.message.includes('could be instantiated')) {
        suggestions.push('Add generic type constraints to ensure type safety.');
      }
    }

    return [...new Set(suggestions)];
  }

  getESLintSuggestions(errors) {
    const suggestions = [];
    
    for (const error of errors) {
      if (error.rule === 'no-unused-vars') {
        suggestions.push('Remove unused variables or prefix with underscore if intentionally unused.');
      }
      if (error.rule === 'react-hooks/exhaustive-deps') {
        suggestions.push('Include all dependencies in useEffect/useCallback/useMemo dependency arrays.');
      }
      if (error.rule === 'no-console') {
        suggestions.push('Use a proper logging service instead of console statements.');
      }
    }

    return [...new Set(suggestions)];
  }

  getPatternSuggestions(errors) {
    const suggestions = [];
    
    for (const error of errors) {
      if (error.message.includes('useState')) {
        suggestions.push('Provide initial state value: useState<Type>(initialValue)');
      }
      if (error.message.includes('className')) {
        suggestions.push('Use the cn() utility from lib/utils for conditional classes.');
      }
    }

    return [...new Set(suggestions)];
  }

  getSecuritySuggestions(errors) {
    const suggestions = [];
    
    for (const error of errors) {
      if (error.message.includes('credentials')) {
        suggestions.push('Move sensitive data to environment variables (.env.local).');
      }
      if (error.message.includes('dangerouslySetInnerHTML')) {
        suggestions.push('Sanitize HTML content or use a safe markdown renderer.');
      }
    }

    return [...new Set(suggestions)];
  }

  async suggestAutoFix(filePath, results) {
    console.log(`\n${colors.green}${colors.bold}🔧 Auto-fix Available${colors.reset}`);
    console.log(`Some issues can be automatically fixed.`);
    console.log(`\nWould you like to:`);
    console.log(`  1. View the proposed fixes`);
    console.log(`  2. Apply fixes automatically`);
    console.log(`  3. Skip auto-fix`);
  }

  async performContextValidation(filePath, content) {
    // Check if this is a component file
    if (filePath.includes('/components/') && content.includes('export')) {
      await this.validateComponent(filePath, content);
    }

    // Check if this is an API route
    if (filePath.includes('/api/') && filePath.endsWith('.ts')) {
      await this.validateAPIRoute(filePath, content);
    }

    // Check if this is a hook
    if (filePath.includes('/hooks/') || content.includes('function use')) {
      await this.validateHook(filePath, content);
    }
  }

  async validateComponent(filePath, content) {
    const issues = [];

    // Check for proper TypeScript props interface
    if (!content.includes('interface') && !content.includes('type') && content.includes('props')) {
      issues.push('Consider defining a TypeScript interface for component props');
    }

    // Check for memo usage on expensive components
    if (content.match(/map\s*\(/g) && !content.includes('React.memo')) {
      issues.push('Consider using React.memo for components that render lists');
    }

    if (issues.length > 0) {
      console.log(`\n${colors.cyan}Component Best Practices:${colors.reset}`);
      issues.forEach(issue => console.log(`  • ${issue}`));
    }
  }

  async validateAPIRoute(filePath, content) {
    const issues = [];

    // Check for error handling
    if (!content.includes('try') || !content.includes('catch')) {
      issues.push('Add proper error handling with try-catch blocks');
    }

    // Check for authentication
    if (!content.includes('auth') && !content.includes('session')) {
      issues.push('Consider adding authentication checks for API routes');
    }

    if (issues.length > 0) {
      console.log(`\n${colors.cyan}API Route Best Practices:${colors.reset}`);
      issues.forEach(issue => console.log(`  • ${issue}`));
    }
  }

  async validateHook(filePath, content) {
    const issues = [];

    // Check hook naming convention
    const hookNameMatch = content.match(/function\s+(use\w+)/);
    if (hookNameMatch && !hookNameMatch[1].match(/^use[A-Z]/)) {
      issues.push('Hook names should start with "use" followed by a capital letter');
    }

    // Check for proper cleanup
    if (content.includes('useEffect') && content.includes('addEventListener') && !content.includes('removeEventListener')) {
      issues.push('Add cleanup function to remove event listeners in useEffect');
    }

    if (issues.length > 0) {
      console.log(`\n${colors.cyan}Hook Best Practices:${colors.reset}`);
      issues.forEach(issue => console.log(`  • ${issue}`));
    }
  }

  updateContextCache(filePath, results) {
    this.contextCache.set(filePath, {
      timestamp: Date.now(),
      valid: results.valid,
      errorCount: results.errors.length,
      warningCount: results.warnings.length
    });

    // Clean old cache entries (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, value] of this.contextCache.entries()) {
      if (value.timestamp < oneHourAgo) {
        this.contextCache.delete(key);
      }
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      filesValidated: this.contextCache.size,
      totalErrors: 0,
      totalWarnings: 0,
      fileStats: []
    };

    for (const [filePath, stats] of this.contextCache.entries()) {
      report.totalErrors += stats.errorCount;
      report.totalWarnings += stats.warningCount;
      report.fileStats.push({
        file: filePath,
        valid: stats.valid,
        errors: stats.errorCount,
        warnings: stats.warningCount
      });
    }

    return report;
  }
}

// Export for use in other hooks
module.exports = PostEditValidator;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const operation = args[1] || 'edit';

  if (!filePath) {
    console.error('Usage: post-edit-hook.js <file-path> [operation]');
    process.exit(1);
  }

  const validator = new PostEditValidator();

  (async () => {
    await validator.initialize();
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Validate
    const results = await validator.validateEdit(filePath, content, operation);
    
    // Exit with appropriate code
    process.exit(results.valid ? 0 : 1);
  })().catch(error => {
    console.error(`${colors.red}Hook failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}