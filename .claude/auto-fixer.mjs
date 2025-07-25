import jscodeshift from 'jscodeshift';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import prettier from 'prettier';
import chalk from 'chalk';

export class JSXAutoFixer {
  constructor() {
    this.j = jscodeshift;
  }

  async init() {
    // Initialization if needed
  }

  async autoFix(code, issues, filePath) {
    let fixedCode = code;
    const appliedFixes = [];
    let attempts = 0;
    const maxAttempts = 5;

    // Keep trying to fix issues until we've fixed them all or hit max attempts
    while (attempts < maxAttempts) {
      attempts++;
      
      // Re-validate to get current issues
      const currentIssues = await this.getCurrentIssues(fixedCode);
      if (currentIssues.length === 0) break;
      
      let madeChanges = false;
      
      for (const issue of currentIssues) {
        // Handle "Expected corresponding JSX closing tag"
        if (issue.message.includes('Expected corresponding JSX closing tag')) {
          const tagMatch = issue.message.match(/Expected corresponding JSX closing tag for <(\w+(?:\.\w+)?)>/);
          if (tagMatch) {
            const tagName = tagMatch[1];
            const result = this.fixUnclosedTag(fixedCode, tagName, issue.line);
            if (result.success) {
              fixedCode = result.code;
              appliedFixes.push(result.description);
              madeChanges = true;
              break; // Fix one at a time
            }
          }
        }
        
        // Handle "Unterminated JSX contents"
        else if (issue.message.includes('Unterminated JSX contents')) {
          const result = this.fixUnterminatedJSX(fixedCode, issue.line);
          if (result.success) {
            fixedCode = result.code;
            appliedFixes.push(result.description);
            madeChanges = true;
            break;
          }
        }
      }
      
      if (!madeChanges) break;
    }

    // Try to format if we made changes
    if (appliedFixes.length > 0) {
      try {
        parse(fixedCode, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript']
        });
        
        fixedCode = await this.formatCode(fixedCode, filePath);
      } catch (e) {
        console.log(chalk.yellow('Note: Formatting skipped due to remaining syntax issues'));
      }
    }

    return {
      code: fixedCode,
      fixed: appliedFixes.length > 0,
      appliedFixes
    };
  }

  async getCurrentIssues(code) {
    try {
      parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        errorRecovery: false
      });
      return [];
    } catch (error) {
      return [{
        message: error.message,
        line: error.loc?.line || 0,
        type: 'parse-error'
      }];
    }
  }

  fixUnclosedTag(code, tagName, errorLine) {
    const lines = code.split('\n');
    let fixed = false;
    
    // Look backwards from the error line
    for (let i = Math.min(errorLine - 1, lines.length - 1); i >= 0; i--) {
      const line = lines[i];
      
      // Check if this line has the opening tag
      const openTagRegex = new RegExp(`<${tagName.replace('.', '\\.')}(?:\\s[^>]*)?>`, 'g');
      const closeTagRegex = new RegExp(`</${tagName.replace('.', '\\.')}>`, 'g');
      
      const openMatches = line.match(openTagRegex) || [];
      const closeMatches = line.match(closeTagRegex) || [];
      
      if (openMatches.length > closeMatches.length && !line.includes('/>')) {
        // Found unclosed tag, add closing tag
        const contentMatch = line.match(new RegExp(`<${tagName.replace('.', '\\.')}[^>]*>([^<]*)$`));
        if (contentMatch && contentMatch[1].trim()) {
          // Has content after tag, close it
          lines[i] = line + `</${tagName}>`;
          fixed = true;
          break;
        }
      }
    }

    return {
      success: fixed,
      code: lines.join('\n'),
      description: `Added missing </${tagName}> closing tag`
    };
  }

  fixUnterminatedJSX(code, errorLine) {
    const lines = code.split('\n');
    
    // Analyze the structure to find unclosed tags
    const tagStack = [];
    
    for (let i = 0; i < Math.min(errorLine, lines.length); i++) {
      const line = lines[i];
      
      // Find opening tags
      const openingTags = line.match(/<(\w+(?:\.\w+)?)(?:\s[^>]*)?>(?![^<]*\/>)/g) || [];
      openingTags.forEach(tag => {
        const tagName = tag.match(/<(\w+(?:\.\w+)?)/)[1];
        if (!tag.includes('/>')) {
          tagStack.push({ name: tagName, line: i });
        }
      });
      
      // Find closing tags
      const closingTags = line.match(/<\/(\w+(?:\.\w+)?)>/g) || [];
      closingTags.forEach(tag => {
        const tagName = tag.match(/<\/(\w+(?:\.\w+)?)/)[1];
        // Pop matching tag from stack
        for (let j = tagStack.length - 1; j >= 0; j--) {
          if (tagStack[j].name === tagName) {
            tagStack.splice(j, 1);
            break;
          }
        }
      });
    }
    
    // The last unclosed tag is likely the issue
    if (tagStack.length > 0) {
      const unclosed = tagStack[tagStack.length - 1];
      // Insert closing tag before the error line
      lines.splice(errorLine - 1, 0, `      </${unclosed.name}>`);
      
      return {
        success: true,
        code: lines.join('\n'),
        description: `Added missing </${unclosed.name}> closing tag for unterminated JSX`
      };
    }
    
    return { success: false };
  }

  async formatCode(code, filePath) {
    try {
      const config = await prettier.resolveConfig(filePath) || {};
      return prettier.format(code, {
        ...config,
        parser: filePath.endsWith('.tsx') ? 'typescript' : 'babel'
      });
    } catch (error) {
      return code;
    }
  }

  generateFixReport(result) {
    if (result.fixed) {
      console.log(chalk.green('\n✅ Applied fixes:'));
      result.appliedFixes.forEach(fix => {
        console.log(chalk.green(`   • ${fix}`));
      });
    } else {
      console.log(chalk.yellow('\n⚠️  No automatic fixes could be applied'));
    }
  }
}

export function createAutoFixer() {
  return new JSXAutoFixer();
}
