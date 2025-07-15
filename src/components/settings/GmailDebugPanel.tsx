import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import toast from 'react-hot-toast';

export const GmailDebugPanel: React.FC = () => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  const runDebugCheck = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      
      // Test the edge function directly
      const response = await fetch(
        'https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/test-gmail-connection',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ practiceId }),
        }
      );

      const data = await response.json();
      setDebugData(data);

      if (data.connected) {
        toast.success('Gmail connection found in database!');
      } else {
        toast.error('No Gmail connection found in database');
      }
    } catch (error) {
      console.error('Debug check error:', error);
      toast.error('Failed to run debug check');
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testDirectInsert = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      
      // Try to insert directly as authenticated user
      const { data, error } = await supabase
        .from('practice_oauth_credentials')
        .insert({
          practice_id: practiceId,
          provider: 'google',
          email: 'test@example.com',
          refresh_token: 'test_refresh_token',
          metadata: { test: true },
        })
        .select()
        .single();

      if (error) {
        console.error('Direct insert error:', error);
        toast.error(`Insert failed: ${error.message}`);
        setDebugData({ insertError: error });
      } else {
        toast.success('Test insert successful!');
        setDebugData({ insertSuccess: data });
        
        // Clean up test data
        await supabase
          .from('practice_oauth_credentials')
          .delete()
          .eq('id', data.id);
      }
    } catch (error) {
      console.error('Test insert error:', error);
      toast.error('Failed to test insert');
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const checkUserPermissions = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      
      // Get current user details
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, practice_id')
        .eq('id', user?.id)
        .single();

      if (userError) {
        setDebugData({ userError });
        return;
      }

      // Check RLS policy evaluation
      const { data: canRead, error: readError } = await supabase
        .from('practice_oauth_credentials')
        .select('id')
        .eq('practice_id', practiceId);

      setDebugData({
        user: {
          id: user?.id,
          email: user?.email,
          role: userData?.role,
          practice_id: userData?.practice_id,
        },
        permissions: {
          canRead: !readError,
          readError: readError?.message,
          recordsFound: canRead?.length || 0,
        },
      });
    } catch (error) {
      console.error('Permission check error:', error);
      toast.error('Failed to check permissions');
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gray-50 rounded-lg border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          Gmail Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={runDebugCheck}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
            ) : (
              <Icon icon="solar:bug-bold-duotone" className="w-4 h-4" />
            )}
            Check Connection
          </Button>
          
          <Button
            onClick={testDirectInsert}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <Icon icon="solar:database-bold-duotone" className="w-4 h-4" />
            Test Insert
          </Button>
          
          <Button
            onClick={checkUserPermissions}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <Icon icon="solar:shield-user-bold-duotone" className="w-4 h-4" />
            Check Permissions
          </Button>
        </div>

        {debugData && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <pre className="text-xs text-gray-800 overflow-auto">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};