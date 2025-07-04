import React, { useState, useEffect } from 'react';
import { communicationService } from '../services/communicationService';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export default function TestSMSWithAuth() {
  const { user } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('0812222331');
  const [message, setMessage] = useState('Dear S N Naholo Naholo, welcome to New Charm Dental Practice! We are excited to be your healthcare partner. Access your patient portal to manage appointments. Call +264 81 435 8843 for assistance.');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [practiceId, setPracticeId] = useState('');
  const [pendingSMS, setPendingSMS] = useState<any>(null);

  useEffect(() => {
    // Get practice ID from user metadata or local storage
    const userPracticeId = user?.user_metadata?.practice_id || localStorage.getItem('currentPracticeId');
    if (userPracticeId) {
      setPracticeId(userPracticeId);
    } else {
      // Default to New Charm Dental Practice
      setPracticeId('b64632c2-3a56-44cf-a2c9-0e42be03a2d3');
    }

    // Check for pending SMS
    checkPendingSMS();
  }, [user]);

  const checkPendingSMS = async () => {
    try {
      // First try to find any pending SMS for the phone number
      const { data: pendingList, error: listError } = await supabase
        .from('practice_sms_logs')
        .select('*')
        .eq('recipient_phone', '0812222331')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingList && pendingList.length > 0 && !listError) {
        setPendingSMS(pendingList[0]);
        setPhoneNumber(pendingList[0].recipient_phone);
        setMessage(pendingList[0].message_content);
        return;
      }

      // If no pending SMS, check the specific ID to see its status
      const { data, error } = await supabase
        .from('practice_sms_logs')
        .select('*')
        .eq('id', 'd0cf44b3-f48c-4f5d-9b8f-ec8753b8ebd5')
        .single();

      if (data && !error) {
        setPendingSMS(data);
        setPhoneNumber(data.recipient_phone);
        setMessage(data.message_content);
      }
    } catch (error) {
      console.error('Error checking pending SMS:', error);
    }
  };

  const sendSMS = async () => {
    if (!user) {
      setResult({ error: 'You must be logged in to send SMS' });
      return;
    }

    if (!practiceId) {
      setResult({ error: 'Practice ID not found' });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      // Use the same method as SendMessageModal
      const response = await communicationService.sendSMS({
        practiceId: practiceId,
        recipientPhone: phoneNumber,
        messageContent: message,
        messageType: 'automation',
        patientId: '37cfcc1a-22d1-4ef4-8cfa-142953c1802d', // S N Naholo Naholo
        metadata: {
          sentBy: user.email || 'Unknown',
          sentByUserId: user.id,
          source: 'TestSMSWithAuth',
          automation_id: 'welcome-new-patient',
          automation_execution_id: '5071a573-9a54-420e-a712-f4e0b5291640',
          sms_log_id: pendingSMS?.id || 'd0cf44b3-f48c-4f5d-9b8f-ec8753b8ebd5'
        }
      });

      setResult(response);

      if (response.success) {
        // Update the pending SMS status if we have one
        if (pendingSMS?.id) {
          await updateSMSStatus(pendingSMS.id);
        }
      }
    } catch (error) {
      setResult({ error: (error as Error).message });
    } finally {
      setIsSending(false);
    }
  };

  const updateSMSStatus = async (smsId: string) => {
    try {
      const { error } = await supabase
        .from('practice_sms_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', smsId);

      if (error) {
        console.error('Error updating SMS status:', error);
      } else {
        console.log('SMS status updated successfully');
        // Refresh pending SMS data
        checkPendingSMS();
      }
    } catch (error) {
      console.error('Error updating SMS status:', error);
    }
  };

  const sendViaRPC = async () => {
    if (!user) {
      setResult({ error: 'You must be logged in to use RPC' });
      return;
    }

    if (!pendingSMS?.id) {
      setResult({ error: 'No pending SMS found' });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc('send_sms_direct', {
        p_sms_id: pendingSMS.id
      });

      if (error) {
        setResult({ error: error.message });
      } else {
        setResult({ success: true, data });
        // Refresh pending SMS data
        checkPendingSMS();
      }
    } catch (error) {
      setResult({ error: (error as Error).message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Test SMS With Authentication</h1>

      {/* User Info */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-2">Authentication Status</h3>
        {user ? (
          <div className="text-sm">
            <p>✅ Logged in as: {user.email}</p>
            <p>Practice ID: {practiceId}</p>
          </div>
        ) : (
          <p className="text-red-600">❌ Not logged in - SMS sending will fail</p>
        )}
      </div>

      {/* Pending SMS Info */}
      {pendingSMS && (
        <div className={`p-4 rounded-lg mb-6 ${pendingSMS.status === 'pending' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold mb-2">
                {pendingSMS.status === 'pending' ? 'Pending SMS Found' : 'SMS Status'}
              </h3>
              <div className="text-sm">
                <p>ID: {pendingSMS.id}</p>
                <p>Status: <span className={`font-semibold ${pendingSMS.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`}>{pendingSMS.status}</span></p>
                <p>Created: {new Date(pendingSMS.created_at).toLocaleString()}</p>
                {pendingSMS.sent_at && <p>Sent: {new Date(pendingSMS.sent_at).toLocaleString()}</p>}
              </div>
            </div>
            <button
              onClick={checkPendingSMS}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="0812222331"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={sendSMS}
          disabled={isSending || !user}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSending ? 'Sending...' : 'Send via Communication Service'}
        </button>

        {pendingSMS && (
          <button
            onClick={sendViaRPC}
            disabled={isSending || !user}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSending ? 'Sending...' : 'Send via RPC Function'}
          </button>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <h3 className="font-semibold mb-2">
            {result.success ? '✅ Success' : '❌ Error'}
          </h3>
          <pre className="text-sm whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}