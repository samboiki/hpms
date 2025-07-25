import { createValidator } from './.claude/jsx-validator.mjs';
import fs from 'fs/promises';
import chalk from 'chalk';

async function verify() {
  const files = ['test-broken.jsx', 'final-test.jsx'];
  
  for (const file of files) {
    console.log(chalk.blue(`\n=== Testing ${file} ===`));
    
    const validator = createValidator();
    const content = await fs.readFile(file, 'utf-8');
    
    const result = await validator.validateJSXStructure(content, file);
    
    if (result.valid) {
      console.log(chalk.green('✅ Valid JSX!'));
    } else {
      console.log(chalk.red(`❌ ${result.issues.length} issues found`));
    }
  }
}

verify().catch(console.error);
