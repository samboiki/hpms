import React, { useState } from 'react';
import { communicationService } from '../services/communicationService';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function TestCommunication() {
  const [smsPhone, setSmsPhone] = useState('+264812222331');
  const [emailAddress, setEmailAddress] = useState('ksnahol@gmail.com');
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [practices, setPractices] = useState<any[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState('5da3896d-b9f3-4b0a-996a-3adca867cb30');
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  React.useEffect(() => {
    fetchPractices();
  }, []);

  const fetchPractices = async () => {
    const { data } = await supabase
      .from('practices')
      .select('id, name')
      .order('name');
    
    if (data) {
      setPractices(data);
    }
  };

  const sendTestSMS = async () => {
    if (!smsPhone || !selectedPracticeId) {
      toast.error('Please provide phone number and select a practice');
      return;
    }

    setIsSendingSMS(true);
    try {
      const result = await communicationService.sendSMS({
        practiceId: selectedPracticeId,
        recipientPhone: smsPhone,
        messageContent: `Test SMS from HPMS Centralized Gateway at ${new Date().toLocaleString()}. Your SMS gateway is working correctly!`,
        messageType: 'system',
        metadata: {
          source: 'TestCommunication',
          testRun: true,
          timestamp: new Date().toISOString()
        }
      });

      if (result.success) {
        toast.success(`SMS sent successfully! Log ID: ${result.logId}`);
      } else {
        toast.error(`SMS failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('SMS Error: ' + (error as Error).message);
    } finally {
      setIsSendingSMS(false);
    }
  };

  const sendTestEmail = async () => {
    if (!emailAddress || !selectedPracticeId) {
      toast.error('Please provide email address and select a practice');
      return;
    }

    setIsSendingEmail(true);
    try {
      const result = await communicationService.sendEmail({
        practiceId: selectedPracticeId,
        recipientEmail: emailAddress,
        recipientName: 'Test Recipient',
        subject: 'Test Email from HPMS Centralized Gateway',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Test Email from HPMS</h2>
            <p>This is a test email from the HPMS Centralized Communication Gateway.</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            <p>If you're receiving this email, it means your email gateway is working correctly!</p>
            <hr />
            <p style="color: #666; font-size: 12px;">
              This email was sent through the centralized gateway which provides:
              <ul>
                <li>Complete audit trail</li>
                <li>Subscription management</li>
                <li>Delivery tracking</li>
                <li>Cost management</li>
              </ul>
            </p>
          </div>
        `,
        textContent: `Test Email from HPMS\n\nThis is a test email from the HPMS Centralized Communication Gateway.\n\nTimestamp: ${new Date().toLocaleString()}\n\nIf you're receiving this email, it means your email gateway is working correctly!`,
        emailType: 'system',
        metadata: {
          source: 'TestCommunication',
          testRun: true,
          timestamp: new Date().toISOString()
        }
      });

      if (result.success) {
        toast.success(`Email sent successfully! Log ID: ${result.logId}`);
      } else {
        toast.error(`Email failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Email Error: ' + (error as Error).message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!selectedPracticeId) {
      toast.error('Please select a practice');
      return;
    }

    try {
      const status = await communicationService.checkSubscriptionStatus(selectedPracticeId);
      setSubscriptionStatus(status);
      toast.success('Subscription status loaded');
    } catch (error) {
      toast.error('Failed to check subscription status');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Test Communication Gateway</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Practice:</label>
          <select
            value={selectedPracticeId}
            onChange={(e) => setSelectedPracticeId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            {practices.map((practice) => (
              <option key={practice.id} value={practice.id}>
                {practice.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">📱 Test SMS</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Phone Number:</label>
          <input
            type="tel"
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="+264812345678"
          />
        </div>
        <button
          onClick={sendTestSMS}
          disabled={isSendingSMS}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {isSendingSMS ? 'Sending...' : 'Send Test SMS'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">📧 Test Email</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Email Address:</label>
          <input
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="user@example.com"
          />
        </div>
        <button
          onClick={sendTestEmail}
          disabled={isSendingEmail}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isSendingEmail ? 'Sending...' : 'Send Test Email'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">📊 Subscription Status</h2>
        <button
          onClick={checkSubscriptionStatus}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 mb-4"
        >
          Check Status
        </button>
        
        {subscriptionStatus && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">SMS Subscription</h3>
              <p>Active: {subscriptionStatus.sms.active ? '✅' : '❌'}</p>
              <p>Remaining: {subscriptionStatus.sms.remaining}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">Email Subscription</h3>
              <p>Active: {subscriptionStatus.email.active ? '✅' : '❌'}</p>
              <p>Remaining: {subscriptionStatus.email.remaining}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}