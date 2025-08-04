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
