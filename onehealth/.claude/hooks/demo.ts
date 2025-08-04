// Demo file to showcase Claude Hooks validation

// TypeScript error: using 'any' type
const badVariable: any = "This should be typed properly";

// ESLint warning: console statement
console.log("Remove console statements in production");

// React Hook error: missing dependency array
import { useEffect } from 'react';

function BadComponent(props) {  // Missing TypeScript types
  useEffect(() => {
    // Effect without dependency array
    console.log("This effect runs on every render!");
  });

  // Security issue: potential XSS
  return <div dangerouslySetInnerHTML={{ __html: props.content }} />;
}

// Pattern detection: empty className
function AnotherComponent() {
  const isActive = false;
  return <div className={isActive ? "active" : ""}></div>;  // Should use cn()
}

// Potential security issue
const apiKey = "sk-1234567890abcdef";  // Hardcoded credentials!

export { BadComponent, AnotherComponent };