import React, { useState } from 'react';
import { communicationService } from '../services/communicationService';
import { useAuthStore } from '../stores/authStore';

export function SimpleEmailExample() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !message) {
      alert('Please fill all fields');
      return;
    }

    const user = useAuthStore.getState().user;
    const practiceId = user?.practice_id || localStorage.getItem('currentPracticeId');
    
    if (!practiceId) {
      alert('Practice ID not found. Please ensure you are logged in properly.');
      return;
    }

    setSending(true);
    try {
      const response = await communicationService.sendEmail({
        practiceId: practiceId as string,
        recipientEmail: to,
        subject: subject,
        htmlContent: `<p>${message}</p>`,
        textContent: message,
        emailType: 'custom',
        metadata: {
          source: 'SimpleEmailExample',
          sentBy: user?.email || 'Unknown'
        }
      });
      
      if (response.success) {
        alert('Email sent successfully!');
        // Clear form
        setTo('');
        setSubject('');
        setMessage('');
      } else {
        alert('Failed to send email: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Send Email</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block mb-1">To:</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="recipient@example.com"
          />
        </div>
        
        <div>
          <label className="block mb-1">Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Email subject"
          />
        </div>
        
        <div>
          <label className="block mb-1">Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={4}
            placeholder="Your message"
          />
        </div>
        
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send Email'}
        </button>
      </div>
    </div>
  );
}