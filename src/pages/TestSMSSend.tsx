import React, { useState, useEffect } from 'react';
import { plainWords } from '../utils/plainErrors';
import { processPendingSMS, sendPendingSMS } from '../utils/sendPendingSMS';
import Button from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export default function TestSMSSend() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pendingSMS, setPendingSMS] = useState<any[]>([]);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const { isAuthenticated } = useAuthStore();

  const fetchPendingSMS = async () => {
    const { data, error } = await supabase
      .from('practice_sms_logs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching pending SMS:', error);
    } else {
      setPendingSMS(data || []);
    }
  };

  useEffect(() => {
    fetchPendingSMS();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setAuthStatus({
      isAuthenticated: !!session,
      user: session?.user,
      accessToken: session?.access_token
    });
  };

  const handleProcessAll = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await processPendingSMS();
      setResult(res);
      await fetchPendingSMS(); // Refresh the list
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? plainWords(error.message) : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendSingle = async (smsId: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await sendPendingSMS(smsId);
      setResult(res);
      await fetchPendingSMS(); // Refresh the list
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? plainWords(error.message) : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test SMS Sending</h1>
      
      {authStatus && (
        <div className="bg-blue-50 p-4 rounded mb-6 text-sm">
          <p><strong>Auth Status:</strong> {authStatus.isAuthenticated ? 'Authenticated' : 'Not authenticated'}</p>
          {authStatus.user && <p><strong>User:</strong> {authStatus.user.email}</p>}
          {authStatus.accessToken && <p className="truncate"><strong>Token:</strong> {authStatus.accessToken.substring(0, 20)}...</p>}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Process Pending SMS</h2>
        
        <Button
          onClick={handleProcessAll}
          disabled={loading}
          className="mb-4"
        >
          {loading ? 'Processing...' : 'Process All Pending SMS'}
        </Button>

        {result && (
          <div className={`p-4 rounded ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Pending SMS Messages</h2>
        
        <div className="space-y-4">
          {pendingSMS.length === 0 ? (
            <p className="text-gray-500">No pending SMS messages found</p>
          ) : (
            pendingSMS.map((sms) => (
              <div key={sms.id} className="border rounded p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">To:</span> {sms.recipient_phone}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {sms.message_type || 'custom'}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Message:</span>
                    <p className="mt-1 text-gray-600">{sms.message_content}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Created:</span> {new Date(sms.created_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  onClick={() => handleSendSingle(sms.id)}
                  disabled={loading}
                  size="sm"
                  className="mt-3"
                >
                  Send This SMS
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}