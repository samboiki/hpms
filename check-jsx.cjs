const fs = require('fs');

const content = fs.readFileSync('onehealth-admin/src/pages/PracticeManagement.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
let stack = [];
let errors = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  // Count opening tags
  const openMatches = line.match(/<(div|button|span|h[1-6]|p|label|input|select|textarea|form|nav|ul|li|a|Icon|motion\.div)[^/>]*>/g) || [];
  const selfClosingMatches = line.match(/<(Icon|input|img|br|hr|meta|link)[^>]*\/>/g) || [];
  const closeMatches = line.match(/<\/(div|button|span|h[1-6]|p|label|input|select|textarea|form|nav|ul|li|a|Icon|motion\.div)>/g) || [];

  // Process opening tags
  openMatches.forEach(tag => {
    const tagName = tag.match(/<([a-zA-Z.]+)/)[1];
    stack.push({ tag: tagName, line: lineNum });
    depth++;
  });

  // Process closing tags
  closeMatches.forEach(tag => {
    const tagName = tag.match(/<\/([a-zA-Z.]+)>/)[1];
    if (stack.length === 0) {
      errors.push(`Line ${lineNum}: Extra closing tag </${tagName}>`);
    } else {
      const last = stack.pop();
      depth--;
      if (last.tag !== tagName) {
        errors.push(`Line ${lineNum}: Mismatched closing tag. Expected </${last.tag}> but found </${tagName}>. Opening tag was on line ${last.line}`);
        stack.push(last); // Put it back since it wasn't matched
        depth++;
      }
    }
  });
}

// Check for unclosed tags
if (stack.length > 0) {
  console.log('\nUnclosed tags:');
  stack.forEach(item => {
    console.log(`  Line ${item.line}: <${item.tag}> is not closed`);
  });
}

if (errors.length > 0) {
  console.log('\nErrors found:');
  errors.forEach(err => console.log(`  ${err}`));
}

console.log(`\nFinal depth: ${depth}`);
console.log(`Remaining stack: ${stack.length} items`);

if (stack.length === 0 && errors.length === 0) {
  console.log('\n✓ All JSX tags are properly balanced!');
}