import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';
import chalk from 'chalk';

async function checkFinalFix() {
  // Read the original broken file
  const content = await fs.readFile('final-test.jsx', 'utf-8');
  
  const validator = createValidator();
  const fixer = createAutoFixer();
  
  // Apply fixes
  const result = await validator.validateJSXStructure(content, 'final-test.jsx');
  const fixed = await fixer.autoFix(content, result.issues, 'final-test.jsx');
  
  console.log(chalk.green('FIXED CODE:'));
  console.log(fixed.code);
  
  // Save it
  await fs.writeFile('final-test-fixed.jsx', fixed.code);
  
  // Re-validate to make sure it's completely fixed
  const revalidation = await validator.validateJSXStructure(fixed.code, 'final-test-fixed.jsx');
  
  console.log('\n' + chalk.blue('VALIDATION RESULT:'));
  if (revalidation.valid) {
    console.log(chalk.green('✅ All JSX issues resolved!'));
  } else {
    console.log(chalk.yellow(`⚠️  ${revalidation.issues.length} issues remain`));
    validator.generateReport(revalidation, fixed.code);
  }
}

checkFinalFix().catch(console.error);
