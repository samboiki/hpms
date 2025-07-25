#!/usr/bin/env node
import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';

async function test() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node test-jsx-debug.js <file>');
    process.exit(1);
  }

  console.log('Reading file:', file);
  const content = await fs.readFile(file, 'utf-8');
  console.log('File content:');
  console.log(content);
  console.log('\n---\n');

  const validator = createValidator();
  const fixer = createAutoFixer();
  await fixer.init();

  console.log('Running validation...');
  const result = await validator.validateJSXStructure(content, file);
  
  console.log('Validation result:', result.valid);
  console.log('Issues found:', result.issues.length);
  
  validator.generateReport(result, content);
  
  if (!result.valid) {
    console.log('\nAttempting auto-fix...');
    const fixed = await fixer.autoFix(content, result.issues, file);
    
    console.log('Fix result:', fixed.fixed);
    console.log('Applied fixes:', fixed.appliedFixes);
    
    if (fixed.fixed) {
      console.log('\nFixed code:');
      console.log(fixed.code);
    }
  }
}

test().catch(console.error);
