#!/usr/bin/env node

/**
 * Claude Hooks - Batch Validation Utility
 * Validates multiple files with detailed reporting
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const SyntaxValidator = require('./syntax-validator');

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

class BatchValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.validator = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: [],
      byType: {
        typescript: { errors: 0, warnings: 0 },
        eslint: { errors: 0, warnings: 0 },
        pattern: { errors: 0, warnings: 0 },
        security: { errors: 0, warnings: 0 }
      }
    };
  }

  async initialize() {
    this.validator = new SyntaxValidator(this.projectRoot);
    await this.validator.initialize();
  }

  async validatePattern(pattern, options = {}) {
    console.log(`${colors.blue}${colors.bold}🔍 Claude Batch Validation${colors.reset}`);
    console.log(`${colors.dim}Pattern: ${pattern}${colors.reset}\n`);

    try {
      // Find files matching pattern
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: [
          '**/node_modules/**',
          '**/.next/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**'
        ]
      });

      if (files.length === 0) {
        console.log(`${colors.yellow}No files found matching pattern${colors.reset}`);
        return this.results;
      }

      console.log(`Found ${files.length} files to validate\n`);

      // Progress tracking
      const startTime = Date.now();
      let processed = 0;

      // Validate files in batches for better performance
      const batchSize = options.parallel ? 5 : 1;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const promises = batch.map(file => this.validateFile(file));
        
        await Promise.all(promises);
        
        processed += batch.length;
        this.showProgress(processed, files.length);
      }

      // Clear progress line
      process.stdout.write('\r' + ' '.repeat(80) + '\r');

      // Show results
      const duration = Date.now() - startTime;
      await this.showResults(duration);

      // Generate detailed report if requested
      if (options.report) {
        await this.generateDetailedReport(options.reportPath);
      }

      return this.results;

    } catch (error) {
      console.error(`${colors.red}Batch validation failed: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }

  async validateFile(relativePath) {
    const filePath = path.join(this.projectRoot, relativePath);
    
    try {
      const result = await this.validator.validateFile(filePath);
      
      this.results.total++;
      
      if (result.valid && result.warnings.length === 0) {
        this.results.passed++;
      } else if (result.valid) {
        this.results.passed++;
        this.results.warnings += result.warnings.length;
        this.updateTypeStats(result.warnings, 'warnings');
      } else {
        this.results.failed++;
        this.results.errors.push({
          file: relativePath,
          errors: result.errors,
          warnings: result.warnings
        });
        this.updateTypeStats(result.errors, 'errors');
        this.updateTypeStats(result.warnings, 'warnings');
      }
      
      return result;
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        file: relativePath,
        errors: [{
          type: 'system',
          message: error.message,
          severity: 'error'
        }],
        warnings: []
      });
      return null;
    }
  }

  updateTypeStats(items, category) {
    items.forEach(item => {
      if (this.results.byType[item.type]) {
        this.results.byType[item.type][category]++;
      }
    });
  }

  showProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((current / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    process.stdout.write(
      `\r${colors.cyan}Progress:${colors.reset} ${bar} ${percentage}% (${current}/${total})`
    );
  }

  async showResults(duration) {
    console.log(`\n${colors.bold}Validation Results:${colors.reset}`);
    console.log('─'.repeat(50));
    
    // Summary stats
    console.log(`Total files:    ${this.results.total}`);
    console.log(`${colors.green}Passed:${colors.reset}         ${this.results.passed}`);
    console.log(`${colors.red}Failed:${colors.reset}         ${this.results.failed}`);
    console.log(`${colors.yellow}Warnings:${colors.reset}       ${this.results.warnings}`);
    console.log(`Duration:       ${(duration / 1000).toFixed(2)}s`);
    console.log('─'.repeat(50));

    // Type breakdown
    console.log(`\n${colors.bold}Issues by Type:${colors.reset}`);
    Object.entries(this.results.byType).forEach(([type, stats]) => {
      if (stats.errors > 0 || stats.warnings > 0) {
        console.log(`  ${this.getTypeBadge(type)} Errors: ${stats.errors}, Warnings: ${stats.warnings}`);
      }
    });

    // Failed files
    if (this.results.errors.length > 0) {
      console.log(`\n${colors.red}${colors.bold}Failed Files:${colors.reset}`);
      
      this.results.errors.forEach(({ file, errors, warnings }) => {
        console.log(`\n  ${colors.bold}${file}${colors.reset}`);
        
        if (errors.length > 0) {
          console.log(`    ${colors.red}Errors (${errors.length}):${colors.reset}`);
          errors.slice(0, 3).forEach(error => {
            const location = error.line ? ` [${error.line}:${error.column}]` : '';
            console.log(`      • ${error.message}${location}`);
          });
          if (errors.length > 3) {
            console.log(`      ... and ${errors.length - 3} more`);
          }
        }
        
        if (warnings.length > 0) {
          console.log(`    ${colors.yellow}Warnings (${warnings.length}):${colors.reset}`);
          warnings.slice(0, 2).forEach(warning => {
            const location = warning.line ? ` [${warning.line}:${warning.column}]` : '';
            console.log(`      • ${warning.message}${location}`);
          });
          if (warnings.length > 2) {
            console.log(`      ... and ${warnings.length - 2} more`);
          }
        }
      });
    }

    // Performance metrics
    const perfReport = this.validator.getPerformanceReport();
    console.log(`\n${colors.dim}Performance: ${perfReport.averageTime} avg per file, ${perfReport.cacheHitRate} cache hits${colors.reset}`);
  }

  getTypeBadge(type) {
    const badges = {
      'typescript': `${colors.blue}[TS]${colors.reset}`,
      'eslint': `${colors.magenta}[ESLint]${colors.reset}`,
      'pattern': `${colors.cyan}[Pattern]${colors.reset}`,
      'security': `${colors.red}[Security]${colors.reset}`
    };
    return badges[type] || `[${type}]`;
  }

  async generateDetailedReport(outputPath) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings
      },
      byType: this.results.byType,
      performance: this.validator.getPerformanceReport(),
      files: {}
    };

    // Add detailed file information
    this.results.errors.forEach(({ file, errors, warnings }) => {
      report.files[file] = {
        valid: false,
        errors: errors,
        warnings: warnings
      };
    });

    const reportPath = outputPath || path.join(this.projectRoot, 'validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n${colors.green}✓${colors.reset} Detailed report saved to: ${reportPath}`);
  }

  async validateProject() {
    console.log(`${colors.blue}${colors.bold}🏗️  Full Project Validation${colors.reset}\n`);

    const patterns = [
      { pattern: 'src/**/*.{ts,tsx}', name: 'TypeScript files' },
      { pattern: 'src/**/*.{js,jsx}', name: 'JavaScript files' },
      { pattern: 'pages/**/*.{ts,tsx,js,jsx}', name: 'Pages (if any)' },
      { pattern: 'app/**/*.{ts,tsx,js,jsx}', name: 'App directory (if any)' }
    ];

    const allResults = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };

    for (const { pattern, name } of patterns) {
      console.log(`\n${colors.cyan}Validating ${name}...${colors.reset}`);
      
      // Reset results for this pattern
      this.results = {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        errors: [],
        byType: {
          typescript: { errors: 0, warnings: 0 },
          eslint: { errors: 0, warnings: 0 },
          pattern: { errors: 0, warnings: 0 },
          security: { errors: 0, warnings: 0 }
        }
      };

      await this.validatePattern(pattern, { parallel: true });

      // Aggregate results
      allResults.total += this.results.total;
      allResults.passed += this.results.passed;
      allResults.failed += this.results.failed;
      allResults.warnings += this.results.warnings;
    }

    // Final summary
    console.log(`\n${colors.bold}${colors.green}Project Validation Complete${colors.reset}`);
    console.log('═'.repeat(50));
    console.log(`Total files validated: ${allResults.total}`);
    console.log(`${colors.green}Passed:${colors.reset} ${allResults.passed}`);
    console.log(`${colors.red}Failed:${colors.reset} ${allResults.failed}`);
    console.log(`${colors.yellow}Total warnings:${colors.reset} ${allResults.warnings}`);
    console.log('═'.repeat(50));

    return allResults.failed === 0;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const validator = new BatchValidator();

  const commands = {
    help: () => {
      console.log(`${colors.bold}Claude Batch Validator${colors.reset}`);
      console.log('\nUsage:');
      console.log('  batch-validate.js <pattern> [options]');
      console.log('  batch-validate.js project');
      console.log('  batch-validate.js help');
      console.log('\nOptions:');
      console.log('  --parallel     Run validations in parallel');
      console.log('  --report       Generate detailed JSON report');
      console.log('  --report-path  Custom path for report file');
      console.log('\nExamples:');
      console.log('  batch-validate.js "src/**/*.tsx"');
      console.log('  batch-validate.js "src/components/**/*.{ts,tsx}" --parallel');
      console.log('  batch-validate.js project --report');
    },

    project: async () => {
      await validator.initialize();
      const success = await validator.validateProject();
      process.exit(success ? 0 : 1);
    },

    default: async (pattern) => {
      if (!pattern) {
        commands.help();
        process.exit(1);
      }

      const options = {
        parallel: args.includes('--parallel'),
        report: args.includes('--report'),
        reportPath: args.includes('--report-path') ? 
          args[args.indexOf('--report-path') + 1] : null
      };

      await validator.initialize();
      const results = await validator.validatePattern(pattern, options);
      process.exit(results.failed > 0 ? 1 : 0);
    }
  };

  if (command === 'help') {
    commands.help();
  } else if (command === 'project') {
    commands.project();
  } else {
    commands.default(command);
  }
}