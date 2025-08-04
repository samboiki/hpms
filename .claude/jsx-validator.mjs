import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import chalk from 'chalk';

export class JSXValidator {
  constructor(config = {}) {
    this.config = {
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      sourceType: 'module',
      errorRecovery: false,
      ...config
    };
    this.issues = [];
  }

  async validateJSXStructure(code, filePath) {
    this.issues = [];
    const elementStack = [];
    
    try {
      const ast = parse(code, {
        ...this.config,
        errorRecovery: false
      });

      traverse.default(ast, {
        JSXElement: {
          enter(path) {
            const openingElement = path.node.openingElement;
            const closingElement = path.node.closingElement;
            
            if (openingElement && !openingElement.selfClosing) {
              const name = getElementName(openingElement.name);
              elementStack.push({
                name,
                line: openingElement.loc.start.line,
                column: openingElement.loc.start.column
              });
              
              if (closingElement) {
                const closingName = getElementName(closingElement.name);
                const expected = elementStack.pop();
                
                if (expected && expected.name !== closingName) {
                  this.issues.push({
                    type: 'mismatched-tag',
                    severity: 'error',
                    openingTag: expected,
                    closingTag: { 
                      name: closingName, 
                      line: closingElement.loc.end.line 
                    },
                    message: `Tag mismatch: <${expected.name}> closed with </${closingName}>`
                  });
                }
              }
            }
          },
          exit(path) {
            if (path.node.openingElement && 
                !path.node.openingElement.selfClosing && 
                !path.node.closingElement) {
              const name = getElementName(path.node.openingElement.name);
              this.issues.push({
                type: 'unclosed-tag',
                severity: 'error',
                line: path.node.openingElement.loc.start.line,
                name,
                message: `Unclosed tag <${name}>`
              });
            }
          }
        }
      });

      elementStack.forEach(({ name, line }) => {
        this.issues.push({
          type: 'unclosed-tag',
          severity: 'error',
          line,
          name,
          message: `Unclosed tag <${name}> at line ${line}`
        });
      });

      return {
        valid: this.issues.length === 0,
        issues: this.issues,
        ast
      };

    } catch (parseError) {
      return this.handleParseError(code, filePath, parseError);
    }
  }

  handleParseError(code, filePath, error) {
    const issues = [{
      type: 'parse-error',
      severity: 'error',
      line: error.loc?.line || 0,
      column: error.loc?.column || 0,
      message: error.message
    }];

    // Try to identify common JSX issues
    const lines = code.split('\n');
    const tagStack = [];
    
    lines.forEach((line, index) => {
      const openingMatches = line.match(/<([A-Za-z][A-Za-z0-9._]*|motion\.[A-Za-z]+)(?:\s|>)/g);
      const closingMatches = line.match(/<\/([A-Za-z][A-Za-z0-9._]*|motion\.[A-Za-z]+)>/g);
      
      if (openingMatches) {
        openingMatches.forEach(match => {
          const tagName = match.replace(/<|\s|>/g, '');
          if (!match.includes('/>')) {
            tagStack.push({ name: tagName, line: index + 1 });
          }
        });
      }
      
      if (closingMatches) {
        closingMatches.forEach(match => {
          const tagName = match.replace(/<\/|>/g, '');
          const lastTag = tagStack[tagStack.length - 1];
          
          if (!lastTag || lastTag.name !== tagName) {
            issues.push({
              type: 'tag-mismatch',
              severity: 'error',
              line: index + 1,
              expected: lastTag?.name || 'none',
              found: tagName,
              message: `Expected </${lastTag?.name || '???'}> but found </${tagName}>`
            });
          } else {
            tagStack.pop();
          }
        });
      }
    });

    return {
      valid: false,
      issues,
      originalError: error
    };
  }

  generateReport(validationResult, code) {
    const { issues } = validationResult;
    
    if (issues.length === 0) {
      console.log(chalk.green('✅ No JSX structure issues found!'));
      return;
    }

    console.log(chalk.red('\n═══ JSX Validation Report ═══\n'));
    
    issues.forEach(issue => {
      console.log(chalk.red(`⚠️  ${issue.message}`));
      if (issue.line) {
        console.log(chalk.gray(`   at line ${issue.line}`));
      }
    });
    
    console.log(chalk.red('\n════════════════════════════\n'));
  }
}

function getElementName(node) {
  if (t.isJSXIdentifier(node)) {
    return node.name;
  }
  if (t.isJSXMemberExpression(node)) {
    return `${getElementName(node.object)}.${node.property.name}`;
  }
  return 'unknown';
}

export function createValidator(config) {
  return new JSXValidator(config);
}
