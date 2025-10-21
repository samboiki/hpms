import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function MinimalApp() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'Poppins, sans-serif'
    }}>
      <div>
        <h1>Healthcare Practice Management System</h1>
        <p>✅ Minimal Test - React Query Excluded</p>
        <p>This version should work without circular dependency errors.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MinimalApp />
  </StrictMode>
);