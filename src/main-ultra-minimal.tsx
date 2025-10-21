import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function UltraMinimalApp() {
  return (
    <div>
      <h1>Ultra Minimal Test</h1>
      <p>Testing without any imports except React...</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UltraMinimalApp />
  </StrictMode>
);