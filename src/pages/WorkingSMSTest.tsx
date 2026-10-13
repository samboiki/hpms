import React, { useState, useEffect } from 'react';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { communicationService } from '../services/communicationService';

export default function WorkingSMSTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pendingSMS, setPendingSMS] = useState<any>(null);

  useEffect(() => {
    fetchPendingSMS();
  }, []);

  const fetchPendingSMS = async () => {
    const { data, error } = await supabase
      .from('practice_sms_logs')
      .select('*')
      .eq('id', '23b220bb-98b7-47d7-bf66-804d96b600dc')
      .single();

    if (!error && data) {
      setPendingSMS(data);
    }
  };

  const sendViaRPC = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Use the RPC function to send
      const { data, error } = await supabase
        .rpc('send_sms_direct', { p_sms_id: '23b220bb-98b7-47d7-bf66-804d96b600dc' });

      if (error) {
        setResult({
          success: false,
          error: error.message
        });
      } else {
        setResult({
          success: true,
          message: 'SMS sent successfully via RPC',
          data
        });
        await fetchPendingSMS();
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? plainWords(error.message) : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const sendViaCommunicationService = async () => {
    if (!pendingSMS) return;
    
    setLoading(true);
    setResult(null);

    try {
      const response = await communicationService.sendSMS({
        practiceId: pendingSMS.practice_id,
        recipientPhone: pendingSMS.recipient_phone,
        messageContent: pendingSMS.message_content,
        messageType: 'automation',
        patientId: pendingSMS.patient_id,
        metadata: {
          ...pendingSMS.metadata,
          sent_via: 'communication_service_test'
        }
      });

      setResult({
        success: response.success,
        message: response.success ? 'SMS sent via Communication Service' : 'Failed to send',
        data: response
      });
      
      await fetchPendingSMS();
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? plainWords(error.message) : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Working SMS Test</h1>
      
      {pendingSMS && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">SMS Details</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Status:</strong> <span className={pendingSMS.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}>{pendingSMS.status}</span></p>
            <p><strong>To:</strong> {pendingSMS.recipient_phone}</p>
            <p><strong>Message:</strong></p>
            <p className="bg-gray-50 p-3 rounded text-xs">{pendingSMS.message_content}</p>
          </div>

          <div className="mt-4 space-y-2">
            <Button
              onClick={sendViaRPC}
              disabled={loading || pendingSMS.status !== 'pending'}
              className="w-full"
            >
              {loading ? 'Processing...' : 'Send via Database Function (Simulated)'}
            </Button>
            
            <Button
              onClick={sendViaCommunicationService}
              disabled={loading || pendingSMS.status !== 'pending'}
              variant="secondary"
              className="w-full"
            >
              {loading ? 'Processing...' : 'Send via Communication Service'}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className={`bg-white rounded-lg shadow p-6 ${result.success ? 'border-green-500' : 'border-red-500'} border`}>
          <h2 className="text-lg font-semibold mb-4">Result</h2>
          <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-sm mb-2">ℹ️ Information</h3>
        <ul className="text-xs space-y-1 text-gray-700">
          <li>• The RPC function simulates sending but marks the SMS as sent in the database</li>
          <li>• The Communication Service uses the centralized SMS gateway (requires auth)</li>
          <li>• For actual SMS delivery, ensure SMS Portal credentials are configured</li>
          <li>• The edge function requires proper JWT authentication</li>
        </ul>
      </div>
    </div>
  );
}