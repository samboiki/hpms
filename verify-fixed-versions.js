import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';
import chalk from 'chalk';

async function verifyFixed() {
  const testFiles = [
    { original: 'test-broken.jsx', fixed: 'test-broken-fixed.jsx' },
    { original: 'final-test.jsx', fixed: 'final-test-fixed.jsx' }
  ];
  
  const validator = createValidator();
  const fixer = createAutoFixer();
  await fixer.init();
  
  for (const { original, fixed } of testFiles) {
    console.log(chalk.blue(`\n=== Processing ${original} ===`));
    
    try {
      // Read original
      const content = await fs.readFile(original, 'utf-8');
      
      // Validate original
      const result = await validator.validateJSXStructure(content, original);
      console.log(chalk.yellow(`Original: ${result.issues.length} issues`));
      
      // Apply fixes
      const fixResult = await fixer.autoFix(content, result.issues, original);
      
      // Save fixed version
      await fs.writeFile(fixed, fixResult.code);
      
      // Validate fixed version
      const fixedValidation = await validator.validateJSXStructure(fixResult.code, fixed);
      
      if (fixedValidation.valid) {
        console.log(chalk.green(`✅ Fixed version is valid JSX!`));
      } else {
        console.log(chalk.red(`❌ Fixed version still has ${fixedValidation.issues.length} issues`));
        validator.generateReport(fixedValidation, fixResult.code);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error processing ${original}:`, error.message));
    }
  }
}

verifyFixed().catch(console.error);
