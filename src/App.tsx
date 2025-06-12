import React from 'react';

function App() {
  console.log('🔥 App component starting...');
  
  // Ultra simple app with no dependencies
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fee2e2', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
        🚨 ULTRA SIMPLE APP - NO DEPENDENCIES
      </h1>
      <p style={{ fontSize: '1.125rem', marginTop: '1rem' }}>
        This is the simplest possible App component with no external dependencies
      </p>
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
        <p>Timestamp: {new Date().toISOString()}</p>
        <p>App is working without any imports!</p>
      </div>
    </div>
  );
}

export default App;