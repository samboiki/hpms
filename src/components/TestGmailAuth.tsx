import React from 'react';
import { edgeFunctionService } from '../services/edgeFunctionService';
import { usePractice } from '../contexts/PracticeContext';
import Button from './ui/Button';

const TestGmailAuth: React.FC = () => {
  const { practiceId } = usePractice();
  
  const testGmailAuth = async () => {
    try {
      const result = await edgeFunctionService.invoke('test-gmail-auth', {
        body: { practiceId }
      });
      
      console.log('Gmail Auth Test Result:', result);
      alert(JSON.stringify(result.data, null, 2));
    } catch (error) {
      console.error('Test failed:', error);
      alert('Test failed: ' + error.message);
    }
  };
  
  return (
    <Button onClick={testGmailAuth}>
      Test Gmail Authentication
    </Button>
  );
};

export default TestGmailAuth;