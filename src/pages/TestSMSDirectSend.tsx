import React, { useState, useEffect } from 'react';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';

export default function TestSMSDirectSend() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pendingSMS, setPendingSMS] = useState<any>(null);
  const { user } = useAuthStore();

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

  const sendSMSDirectly = async () => {
    setLoading(true);
    setResult(null);

    try {
      // First, get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setResult({
          success: false,
          error: 'No active session. Please log in again.'
        });
        setLoading(false);
        return;
      }

      console.log('Session found, access token:', session.access_token.substring(0, 20) + '...');

      // Option 1: Try using the RPC function
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('send_sms_via_gateway', { p_sms_id: '23b220bb-98b7-47d7-bf66-804d96b600dc' });

      if (!rpcError && rpcResult) {
        setResult({
          success: true,
          message: 'SMS sent via RPC function',
          result: rpcResult
        });
        await fetchPendingSMS();
        setLoading(false);
        return;
      }

      // Option 2: Try the edge function with session token
      const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-sms-gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          practiceId: pendingSMS.practice_id,
          recipientPhone: pendingSMS.recipient_phone,
          messageContent: pendingSMS.message_content,
          messageType: pendingSMS.message_type || 'automation',
          patientId: pendingSMS.patient_id,
          metadata: {
            ...pendingSMS.metadata,
            sent_via: 'test_page_direct'
          }
        })
      });

      const edgeResult = await response.json();
      
      setResult({
        success: response.ok && edgeResult.success,
        message: response.ok ? 'SMS sent via edge function' : 'Edge function failed',
        status: response.status,
        result: edgeResult
      });

      await fetchPendingSMS();

    } catch (error) {
      console.error('Error:', error);
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
      <h1 className="text-2xl font-bold mb-6">Direct SMS Send Test</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">User Info</h2>
        <p className="text-sm text-gray-600">
          Logged in as: {user?.email || 'Not logged in'}
        </p>
      </div>

      {pendingSMS && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Pending SMS</h2>
          <div className="space-y-2 text-sm">
            <p><strong>ID:</strong> {pendingSMS.id}</p>
            <p><strong>To:</strong> {pendingSMS.recipient_phone}</p>
            <p><strong>Status:</strong> {pendingSMS.status}</p>
            <p><strong>Message:</strong></p>
            <p className="bg-gray-50 p-3 rounded">{pendingSMS.message_content}</p>
          </div>

          <Button
            onClick={sendSMSDirectly}
            disabled={loading || pendingSMS.status !== 'pending'}
            className="mt-4"
          >
            {loading ? 'Sending...' : 'Send SMS Now'}
          </Button>
        </div>
      )}

      {result && (
        <div className={`bg-white rounded-lg shadow p-6 ${result.success ? 'border-green-500' : 'border-red-500'} border`}>
          <h2 className="text-lg font-semibold mb-4">Result</h2>
          <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}