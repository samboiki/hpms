import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// import './index.css'; // Temporarily commented out

console.log('🔥 main.tsx starting...');

// Ultra simple main for debugging
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);