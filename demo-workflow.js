import { createValidator } from './.claude/jsx-validator.mjs';
import { createAutoFixer } from './.claude/auto-fixer.mjs';
import fs from 'fs/promises';
import chalk from 'chalk';

async function demonstrateWorkflow() {
  console.log(chalk.blue.bold('\n🚀 JSX Validation System Demo\n'));
  
  // Create a broken component
  const brokenCode = `import React from 'react';
import { motion } from 'framer-motion';

const DemoComponent = () => {
  return (
    <motion.div className="wrapper">
      <h1>Demo</h1>
      <div className="content">
        <p>This is valid</p>
        <span>This is missing a closing tag
      </div>
    </motion.div>
  );
};`;

  console.log(chalk.yellow('1️⃣  Broken JSX Code:'));
  console.log(brokenCode);
  
  // Validate
  const validator = createValidator();
  const result = await validator.validateJSXStructure(brokenCode, 'demo.jsx');
  
  console.log(chalk.red(`\n2️⃣  Validation Found ${result.issues.length} Issues:`));
  result.issues.forEach(issue => {
    console.log(chalk.red(`   • ${issue.message}`));
  });
  
  // Fix
  const fixer = createAutoFixer();
  const fixed = await fixer.autoFix(brokenCode, result.issues, 'demo.jsx');
  
  console.log(chalk.green('\n3️⃣  Auto-Fix Applied:'));
  fixed.appliedFixes.forEach(fix => {
    console.log(chalk.green(`   • ${fix}`));
  });
  
  console.log(chalk.green('\n4️⃣  Fixed Code:'));
  console.log(fixed.code);
  
  // Verify fix
  const verification = await validator.validateJSXStructure(fixed.code, 'demo.jsx');
  
  console.log(chalk.green.bold(`\n5️⃣  Final Result: ${verification.valid ? '✅ Valid JSX!' : '❌ Still has issues'}`));
}

demonstrateWorkflow().catch(console.error);
