import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  Activity, 
  Users, 
  Calendar, 
  DollarSign,
  Clock,
  User,
  FileText,
  ChevronRight,
  Loader2
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Appointment {
  id: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
  };
  date: string;
  time: string;
  type: string;
  status: string;
  doctor_id: string;
}

interface Visit {
  id: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
  };
  visit_date: string;
  visit_time: string;
  visit_type: string;
  status: string;
  chief_complaint: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch today's appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          time,
          type,
          status,
          doctor_id,
          patient:patient_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq('date', new Date().toISOString().split('T')[0])
        .order('time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Fetch recent visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          visit_time,
          visit_type,
          status,
          chief_complaint,
          patient:patient_id (
            id,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (visitsError) throw visitsError;

      setAppointments(appointmentsData || []);
      setRecentVisits(visitsData || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    {
      title: 'Total Patients',
      value: '2,420',
      change: '+20%',
      icon: <Users className="h-4 w-4" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Appointments Today',
      value: appointments.length.toString(),
      change: '+12%',
      icon: <Calendar className="h-4 w-4" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Active Consultations',
      value: '5',
      change: '+5%',
      icon: <Activity className="h-4 w-4" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Revenue (Month)',
      value: '$12,500',
      change: '+18%',
      icon: <DollarSign className="h-4 w-4" />,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back to your practice management dashboard</p>
        </div>
        <Button 
          size="sm"
          className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8]"
          onClick={() => navigate('/appointments')}
        >
          <Calendar size={16} className="mr-2" />
          View Schedule
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${stat.bgColor} ${stat.textColor}`}>
                  {stat.icon}
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                  <p className="text-xs text-success-600">{stat.change}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Today's Appointments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/appointments')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments.length > 0 ? (
                appointments.map((appointment) => (
                  <div 
                    key={appointment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/patients/${appointment.patient.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <User size={20} className="text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {appointment.patient.first_name} {appointment.patient.last_name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {appointment.time} • {appointment.type}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        appointment.status === 'confirmed' ? 'success' :
                        appointment.status === 'scheduled' ? 'warning' :
                        'error'
                      }
                      size="sm"
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Calendar size={40} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-500">No appointments scheduled for today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentVisits.length > 0 ? (
                recentVisits.map((visit) => (
                  <div 
                    key={visit.id}
                    className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                    onClick={() => navigate(`/patients/${visit.patient.id}`)}
                  >
                    <div className="flex-shrink-0 mt-1">
                      <FileText size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {visit.patient.first_name} {visit.patient.last_name}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(visit.visit_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {visit.chief_complaint || `${visit.visit_type} visit`}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Activity size={40} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-500">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;