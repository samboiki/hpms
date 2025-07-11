import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import toast from 'react-hot-toast';

interface OAuthApp {
  id: string;
  provider: string;
  client_id: string;
  client_secret?: string;
  redirect_uri?: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

export const OAuthAppsManagement: React.FC = () => {
  const { practiceId } = usePractice();
  const [oauthApps, setOAuthApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingApp, setEditingApp] = useState<OAuthApp | null>(null);
  const [formData, setFormData] = useState({
    provider: 'google',
    client_id: '',
    client_secret: '',
    n8n_credential_id: '',
  });

  const providers = [
    { value: 'google', label: 'Google (Gmail)', icon: 'logos:google-icon', color: 'bg-red-50 text-red-600' },
    { value: 'facebook', label: 'Facebook', icon: 'devicon:facebook', color: 'bg-blue-50 text-blue-600' },
    { value: 'twitter', label: 'Twitter/X', icon: 'ri:twitter-x-fill', color: 'bg-gray-50 text-gray-900' },
  ];

  useEffect(() => {
    loadOAuthApps();
  }, [practiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOAuthApps = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('practice_oauth_apps')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOAuthApps(data || []);
    } catch (error) {
      console.error('Error loading OAuth apps:', error);
      toast.error('Failed to load OAuth applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!practiceId) return;

    try {
      // Save OAuth app credentials
      const dataToSave = {
        practice_id: practiceId,
        provider: formData.provider,
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        redirect_uri: formData.provider === 'google' 
          ? `${window.location.origin}/settings,https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/gmail-oauth-callback`
          : null,
      };

      if (editingApp) {
        const { error } = await supabase
          .from('practice_oauth_apps')
          .update(dataToSave)
          .eq('id', editingApp.id);

        if (error) throw error;
        toast.success('OAuth app updated successfully');
      } else {
        const { error } = await supabase
          .from('practice_oauth_apps')
          .insert(dataToSave);

        if (error) throw error;
        
        // If n8n credential ID provided, also save to practice_oauth_credentials
        if (formData.n8n_credential_id) {
          const { error: credError } = await supabase
            .from('practice_oauth_credentials')
            .upsert({
              practice_id: practiceId,
              provider: 'google',
              n8n_credential_id: formData.n8n_credential_id,
              metadata: { source: 'n8n_integration' },
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          
          if (credError) console.error('Error saving n8n credential:', credError);
        }
        
        toast.success('OAuth app added successfully');
      }

      setShowAddModal(false);
      setEditingApp(null);
      setFormData({ provider: 'google', client_id: '', client_secret: '', n8n_credential_id: '' });
      loadOAuthApps();
    } catch (error) {
      console.error('Error saving OAuth app:', error);
      
      // Handle specific RLS policy errors
      if (error instanceof Error) {
        const dbError = error as DatabaseError;
        if (dbError.code === '42501' || error.message?.includes('policy')) {
          toast.error('You do not have permission to manage OAuth applications. Please contact your practice administrator.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Failed to save OAuth application');
      }
    }
  };

  const handleDelete = async (app: OAuthApp) => {
    if (!confirm(`Are you sure you want to delete the ${app.provider} OAuth configuration?`)) return;

    try {
      const { error } = await supabase
        .from('practice_oauth_apps')
        .delete()
        .eq('id', app.id);

      if (error) throw error;
      toast.success('OAuth app deleted successfully');
      loadOAuthApps();
    } catch (error) {
      console.error('Error deleting OAuth app:', error);
      
      // Handle specific RLS policy errors
      if (error instanceof Error) {
        const dbError = error as DatabaseError;
        if (dbError.code === '42501' || error.message?.includes('policy')) {
          toast.error('You do not have permission to delete OAuth applications. Please contact your practice administrator.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Failed to delete OAuth application');
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Icon icon="solar:key-bold-duotone" className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">OAuth Applications</CardTitle>
                <p className="text-sm text-gray-500">Manage OAuth credentials for social media integrations</p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingApp(null);
                setFormData({ provider: 'google', client_id: '', client_secret: '', n8n_credential_id: '' });
                setShowAddModal(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              <Icon icon="solar:add-bold" className="w-4 h-4 mr-2" />
              Add OAuth App
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
              <p className="text-gray-500 mt-2">Loading OAuth applications...</p>
            </div>
          ) : oauthApps.length === 0 ? (
            <div className="text-center py-8">
              <Icon icon="solar:key-minimalistic-square-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No OAuth Applications</h3>
              <p className="text-gray-500 mb-4">Add OAuth credentials to enable social media integrations</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {oauthApps.map((app) => {
                const provider = providers.find(p => p.value === app.provider);
                return (
                  <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${provider?.color || 'bg-gray-100 text-gray-600'}`}>
                          <Icon icon={provider?.icon || 'solar:key-bold'} className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{provider?.label || app.provider}</h4>
                          <p className="text-sm text-gray-500">Client ID: {app.client_id}</p>
                          <p className="text-xs text-gray-400">
                            Added {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingApp(app);
                            setFormData({
                              provider: app.provider,
                              client_id: app.client_id,
                              client_secret: '', // Don't show existing secret
                              n8n_credential_id: '',
                            });
                            setShowAddModal(true);
                          }}
                        >
                          <Icon icon="solar:pen-bold" className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(app)}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Icon icon="solar:info-circle-bold-duotone" className="w-6 h-6 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Get OAuth Credentials</h3>
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">For Google (Gmail):</h4>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                    <li>Create a new project or select existing</li>
                    <li>Enable Gmail API</li>
                    <li>Configure OAuth consent screen (choose Internal for Google Workspace)</li>
                    <li>Create OAuth 2.0 credentials (Web application)</li>
                    <li>Add redirect URIs: <code className="bg-gray-100 px-1 rounded">{window.location.origin}/settings</code></li>
                    <li>Copy Client ID and Client Secret</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingApp ? 'Edit OAuth Application' : 'Add OAuth Application'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <select
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={!!editingApp}
                  >
                    {providers.map(provider => (
                      <option key={provider.value} value={provider.value}>{provider.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
                  <input
                    type="text"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter Client ID"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Secret {editingApp && '(leave blank to keep existing)'}
                  </label>
                  <input
                    type="password"
                    value={formData.client_secret}
                    onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter Client Secret"
                    required={!editingApp}
                  />
                </div>

                {formData.provider === 'google' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        n8n Credential ID (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.n8n_credential_id}
                        onChange={(e) => setFormData({ ...formData, n8n_credential_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 1 or gmail-newcharm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the credential ID from n8n if you're using n8n for email automation
                      </p>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      <p className="font-medium mb-1">Required Redirect URIs:</p>
                      <code className="block bg-amber-100 p-2 rounded text-xs break-all">
                        {window.location.origin}/settings
                      </code>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingApp(null);
                    setFormData({ provider: 'google', client_id: '', client_secret: '', n8n_credential_id: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!formData.client_id || (!editingApp && !formData.client_secret)}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  {editingApp ? 'Update' : 'Add'} OAuth App
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};