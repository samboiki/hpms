import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';
import chalk from 'chalk';

async function verifyFix() {
  const content = await fs.readFile('test-broken.jsx', 'utf-8');
  
  console.log(chalk.blue('ORIGINAL CODE:'));
  console.log(content);
  console.log('\n---\n');
  
  const validator = createValidator();
  const fixer = createAutoFixer();
  
  // Get validation issues
  const result = await validator.validateJSXStructure(content, 'test-broken.jsx');
  console.log(chalk.red(`Found ${result.issues.length} issues`));
  
  // Apply fix
  const fixed = await fixer.autoFix(content, result.issues, 'test-broken.jsx');
  
  console.log(chalk.green('\nFIXED CODE:'));
  console.log(fixed.code);
  
  // Save and re-validate
  await fs.writeFile('test-broken-fixed.jsx', fixed.code);
  
  console.log(chalk.blue('\n--- RE-VALIDATION ---\n'));
  const revalidation = await validator.validateJSXStructure(fixed.code, 'test-broken-fixed.jsx');
  
  if (revalidation.valid) {
    console.log(chalk.green('✅ SUCCESS! The code is now valid JSX!'));
  } else {
    console.log(chalk.red(`❌ Still has ${revalidation.issues.length} issues`));
    validator.generateReport(revalidation, fixed.code);
  }
}

verifyFix().catch(console.error);
