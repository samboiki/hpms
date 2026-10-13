import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock,
  Calendar,
  Edit3,
  Image,
  User,
  DollarSign,
  TrendingUp,
  Save,
  Plus,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PageTabs, type PageTab } from '../components/ui/PageTabs';
import { practiceWebsiteText, practiceWebsiteUrl } from '../utils/practiceWebsite';

interface Practice {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  website_url?: string | null;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  business_hours: any;
  features: any;
  hero_title?: string;
  hero_subtitle?: string;
  about_text?: string;
  services: any[];
  social_links: any;
  status: string;
  subscription_tier: string;
  timezone: string;
  currency: string;
}

interface PracticeSettings {
  appointment_duration_default: number;
  allow_online_booking: boolean;
  booking_advance_days: number;
  auto_confirmations: boolean;
  reminder_hours_before: number;
}

const EnhancedPracticeProfile: React.FC = () => {
  const { user, selectedPracticeId, isSuperAdmin } = useAuthStore();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [settings, setSettings] = useState<PracticeSettings>({
    appointment_duration_default: 30,
    allow_online_booking: true,
    booking_advance_days: 30,
    auto_confirmations: false,
    reminder_hours_before: 24
  });
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [editingSettings, setEditingSettings] = useState(false);

  const practiceId = selectedPracticeId || user?.practice_id;
  const navigate = useNavigate();
  // Same rule as the admin/tariffs route guard in App.tsx
  const canManageTariffs = !!user && (user.is_super_admin === true || user.role === 'admin');

  useEffect(() => {
    if (practiceId) {
      fetchPracticeData();
      fetchStaff();
      fetchSettings();
    } else {
      // Nothing to load: show "Practice Not Found" instead of an endless spinner
      setLoading(false);
    }
  }, [practiceId]);

  const fetchPracticeData = async () => {
    try {
      const { data, error } = await supabase
        .from('practices')
        .select('*')
        .eq('id', practiceId)
        .single();

      if (error) throw error;
      setPractice(data);
    } catch (error) {
      console.error('Error fetching practice:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, avatar, last_active_at')
        .eq('practice_id', practiceId)
        .order('role', { ascending: true });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_settings')
        .select('setting_key, setting_value')
        .eq('practice_id', practiceId);

      if (error) throw error;

      const settingsObj: any = {};
      data?.forEach(setting => {
        try {
          settingsObj[setting.setting_key] = JSON.parse(setting.setting_value);
        } catch {
          settingsObj[setting.setting_key] = setting.setting_value;
        }
      });

      setSettings(prev => ({ ...prev, ...settingsObj }));
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const promises = Object.entries(settings).map(([key, value]) =>
        supabase
          .from('practice_settings')
          .upsert({
            practice_id: practiceId,
            setting_key: key,
            setting_value: JSON.stringify(value),
            setting_type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
          }, { onConflict: 'practice_id,setting_key' })
      );

      // Supabase reports failures in each result instead of throwing
      const results = await Promise.all(promises);
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
      setEditingSettings(false);
      toast.success('Practice settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Practice settings could not be saved. Please try again.');
    }
  };

  const formatBusinessHours = (hours: any): { day: string; hours: string }[] => {
    // Always an array: the Business Hours card maps over it and shows "Not set" when it is empty
    if (!hours) return [];

    return Object.entries(hours).map(([day, schedule]: [string, any]) => {
      if (schedule.closed) {
        return { day: day.charAt(0).toUpperCase() + day.slice(1), hours: 'Closed' };
      }
      return { 
        day: day.charAt(0).toUpperCase() + day.slice(1), 
        hours: `${schedule.open} - ${schedule.close}` 
      };
    });
  };

  const getRoleColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      doctor: 'bg-blue-100 text-blue-800',
      nurse: 'bg-green-100 text-green-800',
      receptionist: 'bg-yellow-100 text-yellow-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const tabs: PageTab<string>[] = [
    { key: 'profile', label: 'Practice Info', icon: 'solar:buildings-2-bold-duotone' },
    { key: 'staff', label: 'Staff Management', icon: 'solar:users-group-rounded-bold-duotone' },
    { key: 'settings', label: 'Settings', icon: 'solar:settings-bold-duotone' },
    { key: 'billing', label: 'Billing & Tariffs', icon: 'solar:bill-list-bold-duotone' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Practice Not Found</h2>
          <p className="text-gray-600">Unable to load practice information.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header: same pattern as the other pages; the actions move under the title on phones */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1 md:py-2">
          <div className="flex min-w-0 items-center gap-3">
            {practice.logo_url ? (
              <img
                src={practice.logo_url}
                alt={practice.name}
                className="w-11 h-11 md:w-14 md:h-14 flex-none rounded-xl object-cover shadow-lg"
              />
            ) : (
              <div className="flex-none p-2.5 md:p-3 bg-[#01b9d4] rounded-xl shadow-lg">
                <Building2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-800 break-words">{practice.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{practice.city}, {practice.country}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {practiceWebsiteUrl(practice) && (
              <Button
                variant="outline"
                onClick={() => window.open(practiceWebsiteUrl(practice) ?? '', '_blank', 'noopener,noreferrer')}
              >
                <Globe className="w-4 h-4 mr-2" />
                Visit Website
              </Button>
            )}
            {/* Practice details are edited in Settings > Practice */}
            <Button
              className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
              onClick={() => navigate('/settings?tab=practice')}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Practice
            </Button>
          </div>
        </div>

        {/* Tabs (scroll sideways on narrow screens instead of widening the page) */}
        <PageTabs
          tabs={tabs}
          active={activeTab}
          onChange={setActiveTab}
          label="Practice profile sections"
          activeClassName="bg-[#01b9d4]"
        />

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card className="p-6">
                <div className="text-center">
                  {practice.logo_url ? (
                    <img 
                      src={practice.logo_url} 
                      alt={practice.name}
                      className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-[#01b9d4] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building2 className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{practice.name}</h2>
                  
                  <div className="space-y-3 mt-6 text-left">
                    <div className="flex items-start">
                      <MapPin className="w-4 h-4 text-gray-400 mr-3 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <p>{practice.address}</p>
                        <p>{practice.city}, {practice.postal_code}</p>
                        <p>{practice.country}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-sm text-gray-700">{practice.contact_phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-sm text-gray-700">{practice.contact_email}</span>
                    </div>
                    {practiceWebsiteUrl(practice) && (
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 text-gray-400 mr-3" />
                        <a 
                          href={practiceWebsiteUrl(practice) ?? undefined} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-[#01b9d4] hover:underline"
                        >
                          {practiceWebsiteText(practice)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">Business Hours</h3>
                <div className="space-y-2">
                  {formatBusinessHours(practice.business_hours).map((day: any, idx: number) => (
                    <div key={idx} className="flex justify-between py-2 text-sm">
                      <span className="font-medium text-gray-700">{day.day}</span>
                      <span className="text-gray-600">{day.hours}</span>
                    </div>
                  ))}
                  {formatBusinessHours(practice.business_hours).length === 0 && (
                    <p className="text-sm text-gray-500">Not set</p>
                  )}
                </div>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              <Card className="p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">About</h3>
                <p className="text-gray-700">
                  {practice.about_text || 'No description available.'}
                </p>
              </Card>
              
              <Card className="p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Services</h3>
                <div className="grid grid-cols-2 gap-4">
                  {practice.services && practice.services.length > 0 ? (
                    practice.services.map((service: any, idx: number) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">{service.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 col-span-2">No services configured.</p>
                  )}
                </div>
              </Card>
              
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  {practice.features && Object.entries(practice.features).map(([feature, enabled]: [string, any]) => (
                    <div key={feature} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">
                        {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
        
        {activeTab === 'staff' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
              {/* Staff are added, edited and deactivated in Settings > Users */}
              <Button
                className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
                onClick={() => navigate('/settings?tab=users')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Invite Staff Member
              </Button>
            </div>
            
            {staff.length === 0 && (
              <p className="text-gray-500">No staff members found. Use Invite Staff Member to add your team.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staff.map((member: any) => (
                <Card key={member.id} className="p-6">
                  <div className="text-center">
                    {member.avatar ? (
                      <img 
                        src={member.avatar} 
                        alt={member.full_name}
                        className="w-16 h-16 rounded-full object-cover mx-auto mb-4"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">{member.full_name}</h3>
                    <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${getRoleColor(member.role)}`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{member.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last active: {member.last_active_at
                        ? new Date(member.last_active_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Never'}
                    </p>
                    {/* Editing and deactivating staff (with confirmation) happens in Settings > Users */}
                    <div className="flex space-x-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate('/settings?tab=users')}
                      >
                        Edit in Settings
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="max-w-4xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Practice Settings</h2>
              {editingSettings ? (
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setEditingSettings(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={saveSettings} className="bg-[#01b9d4] hover:bg-[#0196be] text-white">
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setEditingSettings(true)} className="bg-[#01b9d4] hover:bg-[#0196be] text-white">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Settings
                </Button>
              )}
            </div>

            <div className="grid gap-6">
              {/* Nothing else in the app reads these practice_settings keys yet */}
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                These settings are saved for the practice, but the appointment book does not use them yet.
              </p>
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Appointment Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Appointment Duration (minutes)
                      </label>
                      {editingSettings ? (
                        <input
                          type="number"
                          value={settings.appointment_duration_default}
                          onChange={(e) => setSettings(prev => ({ ...prev, appointment_duration_default: parseInt(e.target.value) }))}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{settings.appointment_duration_default} minutes</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booking Advance Days
                      </label>
                      {editingSettings ? (
                        <input
                          type="number"
                          value={settings.booking_advance_days}
                          onChange={(e) => setSettings(prev => ({ ...prev, booking_advance_days: parseInt(e.target.value) }))}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{settings.booking_advance_days} days</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Allow Online Booking</label>
                      {editingSettings ? (
                        <input
                          type="checkbox"
                          checked={settings.allow_online_booking}
                          onChange={(e) => setSettings(prev => ({ ...prev, allow_online_booking: e.target.checked }))}
                          className="h-4 w-4 text-[#01b9d4] focus:ring-[#01b9d4] border-gray-300 rounded"
                        />
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          settings.allow_online_booking ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {settings.allow_online_booking ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Auto-confirm Appointments</label>
                      {editingSettings ? (
                        <input
                          type="checkbox"
                          checked={settings.auto_confirmations}
                          onChange={(e) => setSettings(prev => ({ ...prev, auto_confirmations: e.target.checked }))}
                          className="h-4 w-4 text-[#01b9d4] focus:ring-[#01b9d4] border-gray-300 rounded"
                        />
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          settings.auto_confirmations ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {settings.auto_confirmations ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Billing & Tariffs</h2>
              <Button
                onClick={() => navigate('/admin/tariffs')}
                className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
                disabled={!canManageTariffs}
                title={canManageTariffs ? undefined : 'Only practice administrators can manage tariffs'}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Manage Tariffs
              </Button>
            </div>
            
            <Card className="p-6">
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tariff Management</h3>
                <p className="text-gray-600 mb-6">Configure service pricing and medical aid tariffs for your practice.</p>
                <Button
                  onClick={() => navigate('/admin/tariffs')}
                  className="bg-[#01b9d4] hover:bg-[#0196be] text-white"
                  disabled={!canManageTariffs}
                  title={canManageTariffs ? undefined : 'Only practice administrators can manage tariffs'}
                >
                  Open Tariff Manager
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedPracticeProfile;