#!/bin/bash

# Claude Code Pre-Commit Hook - World-Class Syntax Validation
# Prevents commits with syntax errors

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Running pre-commit validation...${NC}"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|ts|tsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✓ No JavaScript/TypeScript files to validate${NC}"
  exit 0
fi

# Track if we have any errors
HAS_ERRORS=0

# Validate each file
for FILE in $STAGED_FILES; do
  echo -e "\n${BLUE}Checking: $FILE${NC}"
  
  # Run the post-edit hook on each file
  if node "$(dirname "$0")/post-edit.js" "$FILE"; then
    echo -e "${GREEN}✓ $FILE passed validation${NC}"
  else
    echo -e "${RED}✗ $FILE failed validation${NC}"
    HAS_ERRORS=1
  fi
done

# Summary
echo -e "\n${BLUE}================================${NC}"
if [ $HAS_ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ All files passed validation!${NC}"
  echo -e "${GREEN}✓ Commit approved${NC}"
  exit 0
else
  echo -e "${RED}✗ Validation failed!${NC}"
  echo -e "${YELLOW}Please fix the errors before committing.${NC}"
  echo -e "\nTip: Run 'npm run lint:fix' to auto-fix some issues"
  exit 1
fi