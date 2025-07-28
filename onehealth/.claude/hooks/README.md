# Claude Code Hooks - World-Class Syntax Validation

This directory contains intelligent hooks that validate JavaScript/TypeScript syntax before errors reach you.

## Features

### 🚀 Post-Edit Hook (`post-edit.js`)
Runs automatically after every file edit to:
- ✅ Check TypeScript syntax and types
- ✅ Run ESLint with auto-fix capabilities
- ✅ Validate React/Next.js patterns
- ✅ Format code with Prettier
- ✅ Scan for security vulnerabilities
- ✅ Provide helpful error messages and quick fixes

### 🛡️ Pre-Commit Hook (`pre-commit.sh`)
Prevents commits with syntax errors by:
- Validating all staged JS/TS files
- Running comprehensive syntax checks
- Providing clear error reporting
- Suggesting fixes for common issues

## Installation

1. **Link to Git hooks** (recommended):
```bash
ln -sf ../../.claude/hooks/pre-commit.sh .git/hooks/pre-commit
```

2. **Configure Claude Code** to use post-edit hook:
Add to your Claude Code settings:
```json
{
  "hooks": {
    "post-edit": ".claude/hooks/post-edit.js"
  }
}
```

## Usage

### Manual validation:
```bash
node .claude/hooks/post-edit.js path/to/file.tsx
```

### Run on all files:
```bash
find src -name "*.tsx" -exec node .claude/hooks/post-edit.js {} \;
```

## What Gets Checked

1. **TypeScript Compilation**
   - Syntax errors
   - Type errors
   - Missing imports

2. **ESLint Rules**
   - Code quality
   - Best practices
   - Auto-fixable issues

3. **React/Next.js Patterns**
   - Hooks in callbacks
   - Missing 'use client' directives
   - Unescaped entities

4. **Security Issues**
   - Hardcoded secrets
   - Dangerous patterns (eval, dangerouslySetInnerHTML)
   - XSS vulnerabilities

5. **Code Formatting**
   - Prettier formatting
   - Consistent style

## Configuration

Edit the config object in `post-edit.js`:

```javascript
const config = {
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  maxErrors: 10,
  autoFix: true,
};
```

## Quick Fixes

When errors are found, the hook suggests:
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run type-check` - Check TypeScript errors
- `npm run format` - Format with Prettier

## Benefits

✨ **Catch errors early** - Before they break your build
🚀 **Save time** - Auto-fix common issues
📚 **Learn best practices** - Clear explanations for each error
🛡️ **Improve security** - Detect vulnerabilities automatically
🎨 **Consistent code** - Automatic formatting

---

Created with ❤️ for a world-class development experience