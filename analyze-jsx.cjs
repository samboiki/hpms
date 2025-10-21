const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'onehealth-admin', 'src', 'pages', 'PracticeManagement.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Track JSX structure with detailed information
const jsxStack = [];
const errors = [];
const warnings = [];

// More comprehensive tag patterns
const tagPatterns = {
  opening: /<([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?)[^>\/]*?(?<!\/)\s*>/g,
  selfClosing: /<([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?)[^>]*?\/\s*>/g,
  closing: /<\/([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?)\s*>/g,
  fragment: {
    opening: /<>/g,
    closing: /<\/>/g
  }
};

// Track curly brace depth for JSX expressions
let braceDepth = 0;
let inJSXExpression = false;
let inStringLiteral = false;
let stringChar = null;
let inComment = false;
let commentType = null;

function analyzeJSXStructure() {
  console.log('=== Analyzing JSX Structure in PracticeManagement.tsx ===\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines
    if (!line.trim()) continue;

    // Check for comments
    if (line.includes('/*')) {
      inComment = true;
      commentType = 'block';
    }
    if (line.includes('*/')) {
      inComment = false;
      commentType = null;
    }
    if (line.trim().startsWith('//')) {
      continue; // Skip line comments
    }

    if (inComment) continue;

    // Track string literals
    for (let char of line) {
      if (!inStringLiteral && (char === '"' || char === "'" || char === '`')) {
        inStringLiteral = true;
        stringChar = char;
      } else if (inStringLiteral && char === stringChar) {
        inStringLiteral = false;
        stringChar = null;
      }
    }

    // Track curly braces for JSX expressions
    for (let char of line) {
      if (!inStringLiteral) {
        if (char === '{') {
          braceDepth++;
          inJSXExpression = true;
        } else if (char === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            inJSXExpression = false;
          }
        }
      }
    }

    // Find JSX fragments
    const fragmentOpenings = [...line.matchAll(/<>/g)];
    const fragmentClosings = [...line.matchAll(/<\/>/g)];

    fragmentOpenings.forEach(match => {
      jsxStack.push({
        tag: 'Fragment',
        line: lineNum,
        column: match.index,
        isFragment: true
      });
    });

    fragmentClosings.forEach(match => {
      if (jsxStack.length === 0) {
        errors.push(`Line ${lineNum}: Extra closing fragment </>`);
      } else {
        const last = jsxStack[jsxStack.length - 1];
        if (last.isFragment) {
          jsxStack.pop();
        } else {
          errors.push(`Line ${lineNum}: Expected </${last.tag}> but found </>`);
        }
      }
    });

    // Find self-closing tags
    const selfClosingMatches = [...line.matchAll(tagPatterns.selfClosing)];
    selfClosingMatches.forEach(match => {
      // Self-closing tags don't affect the stack
      // console.log(`Line ${lineNum}: Self-closing <${match[1]} />`);
    });

    // Find opening tags (excluding self-closing)
    let openingMatches = [...line.matchAll(tagPatterns.opening)];
    // Filter out tags that are actually self-closing
    openingMatches = openingMatches.filter(match => {
      const fullMatch = match[0];
      return !fullMatch.endsWith('/>');
    });

    openingMatches.forEach(match => {
      const tagName = match[1];
      jsxStack.push({
        tag: tagName,
        line: lineNum,
        column: match.index,
        fullMatch: match[0]
      });
    });

    // Find closing tags
    const closingMatches = [...line.matchAll(tagPatterns.closing)];
    closingMatches.forEach(match => {
      const tagName = match[1];

      if (jsxStack.length === 0) {
        errors.push(`Line ${lineNum}: Extra closing tag </${tagName}>`);
      } else {
        const last = jsxStack[jsxStack.length - 1];
        if (last.tag === tagName) {
          jsxStack.pop();
        } else {
          // Look for the matching tag in the stack (might be nested incorrectly)
          const matchIndex = jsxStack.findIndex(item => item.tag === tagName);
          if (matchIndex !== -1) {
            warnings.push(`Line ${lineNum}: Closing </${tagName}> doesn't match immediate parent <${last.tag}> from line ${last.line}`);
            // Remove the matched tag and everything after it
            jsxStack.splice(matchIndex);
          } else {
            errors.push(`Line ${lineNum}: Closing tag </${tagName}> has no matching opening tag`);
          }
        }
      }
    });
  }

  // Report final state
  console.log('\n=== Analysis Results ===\n');

  if (jsxStack.length > 0) {
    console.log('❌ UNCLOSED TAGS:');
    jsxStack.forEach(item => {
      console.log(`   Line ${item.line}, Col ${item.column}: <${item.tag}> is not closed`);
      // Show the line content
      if (lines[item.line - 1]) {
        console.log(`      → ${lines[item.line - 1].trim()}`);
      }
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(err => console.log(`   ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(warn => console.log(`   ${warn}`));
  }

  if (jsxStack.length === 0 && errors.length === 0) {
    console.log('✅ All JSX tags are properly balanced!');
  }

  // Additional analysis
  console.log('\n=== Tag Statistics ===');
  const tagCounts = {};

  lines.forEach((line, i) => {
    // Count all tags
    const allTags = [...line.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?)/g)];
    allTags.forEach(match => {
      const tag = match[1];
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  console.log('\nMost common tags:');
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([tag, count]) => {
      console.log(`   ${tag}: ${count} occurrences`);
    });

  // Find the error location more precisely
  if (jsxStack.length > 0) {
    console.log('\n=== Detailed Error Context ===');
    const firstUnclosed = jsxStack[0];
    const startLine = Math.max(0, firstUnclosed.line - 3);
    const endLine = Math.min(lines.length - 1, firstUnclosed.line + 2);

    console.log(`\nContext around first unclosed tag at line ${firstUnclosed.line}:`);
    for (let i = startLine; i <= endLine; i++) {
      const prefix = i === firstUnclosed.line - 1 ? '>>> ' : '    ';
      console.log(`${prefix}${i + 1}: ${lines[i]}`);
    }
  }
}

analyzeJSXStructure();