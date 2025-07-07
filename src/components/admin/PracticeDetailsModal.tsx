import React, { useState, useEffect } from 'react';
import { X, Users, Calendar, TrendingUp, Settings, Mail, Phone, Globe, MapPin, Clock, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';

interface Practice {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  subscription_tier: 'trial' | 'standard' | 'premium' | 'enterprise';
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  timezone: string;
  currency: string;
  business_hours: any;
  features: any;
  admin_name?: string;
  admin_email?: string;
  total_users: number;
  total_patients: number;
  appointments_last_30_days: number;
  appointments_this_month: number;
  created_at: string;
  subscription_expires_at?: string;
  max_users: number;
  max_patients: number;
}

interface PracticeDetailsModalProps {
  practice: Practice;
  isOpen: boolean;
  onClose: () => void;
}

const PracticeDetailsModal: React.FC<PracticeDetailsModalProps> = ({
  practice,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && practice) {
      fetchPracticeDetails();
    }
  }, [isOpen, practice]);

  const fetchPracticeDetails = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, role, last_active_at')
        .eq('practice_id', practice.id)
        .order('last_active_at', { ascending: false });

      // Fetch recent appointments
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          id, date, time, status,
          patient:patients(first_name, last_name),
          doctor:users!doctor_id(full_name)
        `)
        .eq('practice_id', practice.id)
        .order('date', { ascending: false })
        .limit(5);

      // Fetch analytics
      const { data: analyticsData } = await supabase
        .rpc('get_practice_statistics', { practice_uuid: practice.id });

      setUsers(usersData || []);
      setRecentAppointments(appointmentsData || []);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching practice details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  const getTierColor = (tier: string) => {
    const colors = {
      trial: 'bg-blue-100 text-blue-800 border-blue-200',
      standard: 'bg-purple-100 text-purple-800 border-purple-200',
      premium: 'bg-amber-100 text-amber-800 border-amber-200',
      enterprise: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return colors[tier as keyof typeof colors] || colors.standard;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBusinessHours = (hours: any) => {
    if (!hours) return 'Not set';
    
    return Object.entries(hours).map(([day, schedule]: [string, any]) => {
      if (schedule.closed) {
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: Closed`;
      }
      return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${schedule.open} - ${schedule.close}`;
    }).join(', ');
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'appointments', label: 'Recent Activity', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{practice.name}</h2>
              <p className="text-gray-600">{practice.city}, {practice.country}</p>
            </div>
            <div className="flex space-x-2">
              <Badge className={getStatusColor(practice.status)}>
                {practice.status.charAt(0).toUpperCase() + practice.status.slice(1)}
              </Badge>
              <Badge className={getTierColor(practice.subscription_tier)}>
                {practice.subscription_tier.charAt(0).toUpperCase() + practice.subscription_tier.slice(1)}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="px-6 border-b border-gray-200"
        />

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold">{practice.total_users}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg mr-3">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Patients</p>
                      <p className="text-2xl font-bold">{practice.total_patients}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg mr-3">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">This Month</p>
                      <p className="text-2xl font-bold">{practice.appointments_this_month}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-amber-100 rounded-lg mr-3">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last 30 Days</p>
                      <p className="text-2xl font-bold">{practice.appointments_last_30_days}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Contact & Location Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-500 mr-3" />
                      <span>{practice.contact_email}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-500 mr-3" />
                      <span>{practice.contact_phone}</span>
                    </div>
                    {practice.domain && (
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 text-gray-500 mr-3" />
                        <a href={`https://${practice.domain}`} target="_blank" rel="noopener noreferrer" 
                           className="text-[#01b9d4] hover:underline">
                          {practice.domain}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-500 mr-3" />
                      <div>
                        <p>{practice.address}</p>
                        <p>{practice.city}, {practice.postal_code}</p>
                        <p>{practice.country}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Subscription Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Plan:</span>
                      <Badge className={getTierColor(practice.subscription_tier)}>
                        {practice.subscription_tier.charAt(0).toUpperCase() + practice.subscription_tier.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge className={getStatusColor(practice.status)}>
                        {practice.status.charAt(0).toUpperCase() + practice.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Max Users:</span>
                      <span>{practice.max_users}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Max Patients:</span>
                      <span>{practice.max_patients}</span>
                    </div>
                    {practice.subscription_expires_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Expires:</span>
                        <span>{formatDate(practice.subscription_expires_at)}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Practice Users</h3>
                <Badge className="bg-gray-100 text-gray-800">
                  {users.length} of {practice.max_users} users
                </Badge>
              </div>
              <div className="grid gap-4">
                {users.map((user: any) => (
                  <Card key={user.id} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{user.full_name}</h4>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="mb-1">
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                        <p className="text-xs text-gray-500">
                          Last active: {user.last_active_at ? formatDate(user.last_active_at) : 'Never'}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div>
              <h3 className="text-lg font-semibold mb-6">Recent Appointments</h3>
              <div className="space-y-4">
                {recentAppointments.map((appointment: any) => (
                  <Card key={appointment.id} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {appointment.patient?.first_name} {appointment.patient?.last_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Dr. {appointment.doctor?.full_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{appointment.date} at {appointment.time}</p>
                        <Badge className={appointment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                         appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                         'bg-gray-100 text-gray-800'}>
                          {appointment.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Business Hours</h3>
                <p className="text-sm text-gray-600">{formatBusinessHours(practice.business_hours)}</p>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  {practice.features && Object.entries(practice.features).map(([feature, enabled]: [string, any]) => (
                    <div key={feature} className="flex justify-between items-center">
                      <span className="text-sm">{feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <Badge className={enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">System Settings</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Timezone:</span>
                    <span>{practice.timezone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Currency:</span>
                    <span>{practice.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{formatDate(practice.created_at)}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button className="bg-[#01b9d4] hover:bg-[#0196be] text-white">
            Edit Practice
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PracticeDetailsModal;