import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';

async function showFixed() {
  const content = await fs.readFile('test-broken.jsx', 'utf-8');
  
  console.log('ORIGINAL CODE:');
  console.log(content);
  console.log('\n---\n');
  
  const validator = createValidator();
  const fixer = createAutoFixer();
  
  const result = await validator.validateJSXStructure(content, 'test-broken.jsx');
  const fixed = await fixer.autoFix(content, result.issues, 'test-broken.jsx');
  
  console.log('FIXED CODE:');
  console.log(fixed.code);
  
  // Save the fixed version
  await fs.writeFile('test-broken-fixed.jsx', fixed.code);
  
  // Re-validate the fixed code
  console.log('\n---\n');
  console.log('RE-VALIDATING FIXED CODE:');
  const revalidation = await validator.validateJSXStructure(fixed.code, 'test-broken-fixed.jsx');
  console.log('Valid?', revalidation.valid);
  if (!revalidation.valid) {
    validator.generateReport(revalidation, fixed.code);
  }
}

showFixed().catch(console.error);
