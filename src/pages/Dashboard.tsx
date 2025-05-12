import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { 
  Calendar, 
  Users, 
  CreditCard, 
  Activity, 
  PlusCircle, 
  Clock,
  User,
  TrendingUp,
  AlertCircle,
  Stethoscope,
  Heart,
  Brain,
  Timer,
  ArrowRight,
  UserCheck,
  UserX
} from 'lucide-react';
import { useAppointmentsStore } from '../stores/appointmentsStore';
import { usePatientsStore } from '../stores/patientsStore';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';

const Dashboard: React.FC = () => {
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const { appointments } = useAppointmentsStore();
  const { patients } = usePatientsStore();

  // Count today's appointments
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(app => app.date === today);
  
  // Get stats
  const totalPatients = patients.length;
  const pendingAppointments = appointments.filter(app => 
    app.status === 'scheduled' || app.status === 'confirmed'
  ).length;
  const completedAppointments = appointments.filter(app => 
    app.status === 'completed'
  ).length;

  // Calculate emergency slots
  const emergencySlots = 2;
  const emergencySlotsUsed = appointments.filter(app => 
    app.type === 'emergency' && app.date === today
  ).length;

  // Mock analytics data
  const analyticsData = {
    patientSatisfaction: 94,
    avgWaitTime: '12 mins',
    missedAppointments: 3,
    revenueGrowth: '+15%',
  };

  // Mock AI insights
  const aiInsights = [
    'Patient satisfaction has increased by 12% this month',
    'Peak hours are between 9 AM and 11 AM',
    'Follow-up appointments have a 95% attendance rate',
  ];

  // Sort appointments by time
  const sortedAppointments = [...todayAppointments].sort((a, b) => {
    const timeA = new Date(`${a.date} ${a.time}`).getTime();
    const timeB = new Date(`${b.date} ${b.time}`).getTime();
    return timeA - timeB;
  });

  // Calculate wait times
  const calculateWaitTime = (appointment: any) => {
    const now = new Date();
    const appointmentTime = new Date(`${appointment.date} ${appointment.time}`);
    const diffInMinutes = Math.round((now.getTime() - appointmentTime.getTime()) / (1000 * 60));
    return diffInMinutes > 0 ? `${diffInMinutes} mins` : '0 mins';
  };

  // Group appointments by status
  const queuedAppointments = sortedAppointments.filter(app => 
    app.status === 'scheduled' || app.status === 'confirmed'
  );
  const inProgressAppointments = sortedAppointments.filter(app => 
    app.status === 'in-progress'
  );
  const completedTodayAppointments = sortedAppointments.filter(app => 
    app.status === 'completed'
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header section remains the same */}
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back to your practice management dashboard</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button variant="outline" size="md">
            <Clock size={16} className="mr-2" />
            View Schedule
          </Button>
          <Button 
            size="md"
            className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8] hover:opacity-90 transition-opacity"
            onClick={() => setIsAppointmentModalOpen(true)}
          >
            <PlusCircle size={16} className="mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Emergency Slots Alert */}
      <Card className="bg-brand-light border-l-4 border-l-brand-primary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="text-brand-primary mr-3" size={24} />
              <div>
                <h3 className="font-medium text-gray-900">Emergency Slots Available</h3>
                <p className="text-sm text-gray-600">
                  {emergencySlots - emergencySlotsUsed} out of {emergencySlots} slots available today
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Book Emergency Slot
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stats cards remain the same */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-primary-100 text-primary-600">
                <Users size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <h3 className="text-2xl font-bold text-gray-900">{totalPatients}</h3>
                <p className="text-xs text-success-600">+12% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-secondary-100 text-secondary-600">
                <Calendar size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                <h3 className="text-2xl font-bold text-gray-900">{todayAppointments.length}</h3>
                <p className="text-xs text-gray-500">{pendingAppointments} pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-success-100 text-success-600">
                <Activity size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Patient Satisfaction</p>
                <h3 className="text-2xl font-bold text-gray-900">{analyticsData.patientSatisfaction}%</h3>
                <p className="text-xs text-success-600">↑ 4% increase</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-warning-100 text-warning-600">
                <TrendingUp size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue Growth</p>
                <h3 className="text-2xl font-bold text-gray-900">{analyticsData.revenueGrowth}</h3>
                <p className="text-xs text-success-600">On track</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Patient Queue and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Queue */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Patient Queue</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="azure" size="sm">
                  <Timer size={12} className="mr-1" />
                  Avg. Wait: {analyticsData.avgWaitTime}
                </Badge>
                <Button variant="outline" size="sm">
                  Manage Queue
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Waiting */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Waiting</h3>
                <div className="space-y-2">
                  {queuedAppointments.map((appointment, index) => {
                    const patient = patients.find(p => p.id === appointment.patientId);
                    const waitTime = calculateWaitTime(appointment);
                    
                    return (
                      <div 
                        key={appointment.id}
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-brand-light rounded-full text-brand-primary font-medium">
                          {index + 1}
                        </div>
                        
                        <div className="ml-4 flex-1">
                          <div className="flex items-center">
                            {patient?.avatar ? (
                              <img 
                                src={patient.avatar} 
                                alt={`${patient.firstName} ${patient.lastName}`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                            )}
                            
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-gray-900">
                                {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {appointment.time} • {appointment.type}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Badge
                            variant={waitTime === '0 mins' ? 'success' : 'warning'}
                            size="sm"
                          >
                            {waitTime === '0 mins' ? 'On Time' : `Wait: ${waitTime}`}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <ArrowRight size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* In Progress */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">In Progress</h3>
                <div className="space-y-2">
                  {inProgressAppointments.map((appointment) => {
                    const patient = patients.find(p => p.id === appointment.patientId);
                    
                    return (
                      <div 
                        key={appointment.id}
                        className="flex items-center p-3 bg-brand-light rounded-lg"
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-brand-primary rounded-full text-white">
                          <UserCheck size={14} />
                        </div>
                        
                        <div className="ml-4 flex-1">
                          <div className="flex items-center">
                            {patient?.avatar ? (
                              <img 
                                src={patient.avatar} 
                                alt={`${patient.firstName} ${patient.lastName}`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                            )}
                            
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-gray-900">
                                {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                              </h4>
                              <p className="text-xs text-gray-500">
                                With Dr. {appointment.doctorName}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <Badge variant="azure" size="sm">
                          In Progress
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Completed Today */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Completed Today</h3>
                <div className="space-y-2">
                  {completedTodayAppointments.map((appointment) => {
                    const patient = patients.find(p => p.id === appointment.patientId);
                    
                    return (
                      <div 
                        key={appointment.id}
                        className="flex items-center p-3 bg-gray-50 rounded-lg opacity-75"
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-success-100 rounded-full text-success-600">
                          <UserCheck size={14} />
                        </div>
                        
                        <div className="ml-4 flex-1">
                          <div className="flex items-center">
                            {patient?.avatar ? (
                              <img 
                                src={patient.avatar} 
                                alt={`${patient.firstName} ${patient.lastName}`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                            )}
                            
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-gray-900">
                                {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                              </h4>
                              <p className="text-xs text-gray-500">
                                Completed at {appointment.time}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <Badge variant="success" size="sm">
                          Completed
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Overview */}
        <div className="space-y-6">
          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Stethoscope size={18} className="text-brand-primary mr-2" />
                    <h4 className="text-sm font-medium text-gray-700">Patient Load</h4>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{todayAppointments.length}</p>
                  <p className="text-xs text-gray-500">Today's appointments</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Heart size={18} className="text-brand-primary mr-2" />
                    <h4 className="text-sm font-medium text-gray-700">Success Rate</h4>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">98%</p>
                  <p className="text-xs text-gray-500">Treatment success</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Clock size={18} className="text-brand-primary mr-2" />
                    <h4 className="text-sm font-medium text-gray-700">Wait Time</h4>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.avgWaitTime}</p>
                  <p className="text-xs text-gray-500">Average wait time</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Brain size={18} className="text-brand-primary mr-2" />
                    <h4 className="text-sm font-medium text-gray-700">AI Accuracy</h4>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">96%</p>
                  <p className="text-xs text-gray-500">Diagnostic accuracy</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiInsights.map((insight, index) => (
                  <div key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <Brain size={16} className="text-brand-primary mt-1 mr-3" />
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <FormModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        title="Schedule New Appointment"
      >
        <AddAppointmentForm
          onSuccess={() => setIsAppointmentModalOpen(false)}
        />
      </FormModal>
    </div>
  );
};

export default Dashboard;