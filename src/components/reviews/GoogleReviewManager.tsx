import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import GoogleReviewService from '../../services/googleReviewService';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';

interface Practice {
  id: string;
  name: string;
  google_place_id?: string;
  google_review_url?: string;
}

interface RecentVisit {
  id: string;
  patient_id: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number?: string;
    email?: string;
  };
  visit_date: string;
  status: string;
}

export default function GoogleReviewManager() {
  const user = useAuthStore((state) => state.user);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalRequests: 0,
    sentRequests: 0,
    failedRequests: 0,
    conversionRate: 0
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.practice_id) return;

    try {
      // Load practice details
      const { data: practiceData } = await supabase
        .from('practices')
        .select('id, name')
        .eq('id', user.practice_id)
        .single();

      if (practiceData) {
        setPractice({
          ...practiceData,
          google_place_id: '',
          google_review_url: ''
        });
      }

      // Load recent completed visits (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: visitsData } = await supabase
        .from('visits')
        .select(`
          id,
          patient_id,
          visit_date,
          status,
          patient:patients!visits_patient_id_fkey(
            id,
            first_name,
            last_name,
            cell_number,
            email
          )
        `)
        .eq('practice_id', user.practice_id)
        .eq('status', 'completed')
        .gte('visit_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('visit_date', { ascending: false })
        .limit(20);

      if (visitsData) {
        // TODO: Implement review_requests table and filtering
        // For now, show all recent visits
        setRecentVisits(visitsData as RecentVisit[]);
      }

      // Load stats
      const reviewStats = await GoogleReviewService.getReviewStats(user.practice_id);
      setStats(reviewStats);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load review data');
    } finally {
      setLoading(false);
    }
  };

  const sendReviewRequest = async (visit: RecentVisit, method: 'sms' | 'email') => {
    if (!practice || !visit.patient) return;

    setSending(visit.id);

    try {
      const reviewData = {
        practiceId: practice.id,
        patientId: visit.patient_id,
        visitId: visit.id,
        patientName: `${visit.patient.first_name} ${visit.patient.last_name}`,
        patientPhone: visit.patient.cell_number,
        patientEmail: visit.patient.email,
        practiceDetails: {
          name: practice.name,
          googleReviewUrl: practice.google_review_url || '',
          googlePlaceId: practice.google_place_id
        }
      };

      let success = false;
      if (method === 'sms' && visit.patient.cell_number) {
        success = await GoogleReviewService.sendReviewRequestSMS(reviewData);
      } else if (method === 'email' && visit.patient.email) {
        success = await GoogleReviewService.sendReviewRequestEmail(reviewData);
      }

      if (success) {
        toast.success(`Review request sent via ${method.toUpperCase()}`);
        await loadData(); // Reload to update the list
      } else {
        toast.error(`Failed to send review request`);
      }
    } catch (error) {
      console.error('Error sending review request:', error);
      toast.error('Failed to send review request');
    } finally {
      setSending(null);
    }
  };

  const updateGooglePlaceId = async () => {
    // TODO: Implement google_place_id and google_review_url columns in practices table
    toast('Google Review integration is coming soon.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon icon="solar:star-bold-duotone" className="w-8 h-8 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">Google Review Management</h2>
          </div>
          <button
            onClick={updateGooglePlaceId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icon icon="solar:settings-bold-duotone" className="w-5 h-5" />
            Configure Google Business
          </button>
        </div>

        {!practice?.google_place_id && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              <strong>Setup Required:</strong> Click "Configure Google Business" to add your Google Place ID and enable review requests.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600">Sent Successfully</p>
            <p className="text-2xl font-bold text-green-900">{stats.sentRequests}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-600">Failed</p>
            <p className="text-2xl font-bold text-red-900">{stats.failedRequests}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600">Est. Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-900">{(stats.conversionRate * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Completed Visits (Eligible for Review Requests)
        </h3>

        {recentVisits.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No eligible visits found in the last 7 days</p>
        ) : (
          <div className="space-y-2">
            {recentVisits.map((visit) => (
              <div key={visit.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {visit.patient.first_name} {visit.patient.last_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Visit Date: {new Date(visit.visit_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {visit.patient.cell_number && (
                      <button
                        onClick={() => sendReviewRequest(visit, 'sms')}
                        disabled={!practice?.google_review_url || sending === visit.id}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                      >
                        <Icon icon="solar:chat-round-line-bold-duotone" className="w-4 h-4" />
                        Send SMS
                      </button>
                    )}
                    {visit.patient.email && (
                      <button
                        onClick={() => sendReviewRequest(visit, 'email')}
                        disabled={!practice?.google_review_url || sending === visit.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                      >
                        <Icon icon="solar:letter-bold-duotone" className="w-4 h-4" />
                        Send Email
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Get Your Google Place ID:</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Go to your Google Business Profile</li>
          <li>Click on "Share" or look at the URL</li>
          <li>Find the alphanumeric code after "ChIJ" or in the share link</li>
          <li>Or search for your business on Google Maps and check the URL</li>
        </ol>
      </div>
    </div>
  );
}