import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  ChevronLeft,
  Edit3,
  PlusCircle,
  Clock,
  FileSymlink,
  User
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { usePatientsStore } from '../stores/patientsStore';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatientById } = usePatientsStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'appointments'>('overview');
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  
  const patient = getPatientById(id || '');

  if (!patient) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-medium">Patient not found</h2>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate('/patients')}
        >
          <ChevronLeft size={16} className="mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/patients')}
          className="mr-4"
        >
          <ChevronLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          Patient Details
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                {patient.avatar ? (
                  <img 
                    src={patient.avatar} 
                    alt={`${patient.firstName} ${patient.lastName}`}
                    className="w-24 h-24 rounded-full object-cover mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <User size={40} className="text-gray-400" />
                  </div>
                )}
                <h2 className="text-xl font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h2>
                <p className="text-gray-500 capitalize">
                  {patient.gender} • {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years
                </p>
                <div className="mt-4 w-full">
                  <div className="flex items-center py-2">
                    <Phone size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-700">{patient.phone}</span>
                  </div>
                  <div className="flex items-center py-2">
                    <Mail size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-700">{patient.email}</span>
                  </div>
                  <div className="flex items-center py-2">
                    <MapPin size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-700">{patient.address}</span>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full">
                  <Edit3 size={16} className="mr-2" />
                  Edit Patient
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Insurance Information</CardTitle>
            </CardHeader>
            <CardContent>
              {patient.insuranceProvider ? (
                <div>
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-500">Provider</h4>
                    <p className="text-gray-900">{patient.insuranceProvider}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Policy Number</h4>
                    <p className="text-gray-900">{patient.insuranceNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No insurance information</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Add Insurance
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 px-4 text-sm font-medium ${
                activeTab === 'overview'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-4 text-sm font-medium ${
                activeTab === 'history'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Medical History
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`pb-3 px-4 text-sm font-medium ${
                activeTab === 'appointments'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Appointments
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button>
                      <Calendar size={16} className="mr-2" />
                      Schedule
                    </Button>
                    <Button variant="outline">
                      <FileText size={16} className="mr-2" />
                      New Note
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setIsAddRecordModalOpen(true)}
                    >
                      <FileSymlink size={16} className="mr-2" />
                      Add Record
                    </Button>
                    <Button variant="outline">
                      <Clock size={16} className="mr-2" />
                      History
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-6 py-4">
                  <div className="flex justify-between items-center">
                    <CardTitle>Upcoming Appointments</CardTitle>
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {patient.upcomingAppointments.length > 0 ? (
                    <div className="space-y-4">
                      {patient.upcomingAppointments.map((appointment) => (
                        <div 
                          key={appointment.id}
                          className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50"
                        >
                          <div className="flex items-center">
                            <div className="p-2 bg-primary-50 rounded-md text-primary-600 mr-4">
                              <Calendar size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">
                                {appointment.date} at {appointment.time}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {appointment.doctorName} • {appointment.type}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              appointment.status === 'confirmed' ? 'success' :
                              appointment.status === 'scheduled' ? 'warning' : 'gray'
                            }
                            size="sm"
                          >
                            {appointment.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Calendar size={40} className="mx-auto text-gray-300" />
                      <p className="mt-2 text-gray-500">No upcoming appointments</p>
                      <Button size="sm" className="mt-3">
                        Schedule Appointment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-6 py-4">
                  <div className="flex justify-between items-center">
                    <CardTitle>Recent Medical Records</CardTitle>
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {patient.medicalHistory.length > 0 ? (
                    <div className="space-y-4">
                      {patient.medicalHistory.map((record) => (
                        <div 
                          key={record.id}
                          className="p-4 border rounded-md hover:bg-gray-50"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              {record.title}
                            </h4>
                            <Badge
                              variant={
                                record.type === 'diagnosis' ? 'primary' :
                                record.type === 'prescription' ? 'secondary' :
                                record.type === 'lab' ? 'warning' : 'gray'
                              }
                              size="sm"
                            >
                              {record.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">
                            {record.date} • {record.doctor}
                          </p>
                          <p className="text-sm text-gray-700 mb-3">
                            {record.description}
                          </p>
                          {record.attachments && record.attachments.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-500 mb-1">Attachments:</p>
                              <div className="flex flex-wrap gap-2">
                                {record.attachments.map((attachment, idx) => (
                                  <a 
                                    key={idx}
                                    href={attachment.url}
                                    className="text-xs text-primary-600 flex items-center hover:underline"
                                  >
                                    <FileText size={12} className="mr-1" />
                                    {attachment.name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <FileText size={40} className="mx-auto text-gray-300" />
                      <p className="mt-2 text-gray-500">No medical records found</p>
                      <Button 
                        size="sm" 
                        className="mt-3"
                        onClick={() => setIsAddRecordModalOpen(true)}
                      >
                        <PlusCircle size={14} className="mr-2" />
                        Add Record
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {activeTab === 'history' && (
            <Card>
              <CardHeader className="px-6 py-4">
                <div className="flex justify-between items-center">
                  <CardTitle>Medical History</CardTitle>
                  <Button 
                    size="sm"
                    onClick={() => setIsAddRecordModalOpen(true)}
                  >
                    <PlusCircle size={14} className="mr-2" />
                    Add Record
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {patient.medicalHistory.length > 0 ? (
                  <div className="space-y-6">
                    {patient.medicalHistory.map((record) => (
                      <div 
                        key={record.id}
                        className="p-4 border rounded-md hover:shadow-sm transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-base font-medium text-gray-900">
                            {record.title}
                          </h4>
                          <Badge
                            variant={
                              record.type === 'diagnosis' ? 'primary' :
                              record.type === 'prescription' ? 'secondary' :
                              record.type === 'lab' ? 'warning' : 'gray'
                            }
                          >
                            {record.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">
                          {record.date} • {record.doctor}
                        </p>
                        <p className="text-sm text-gray-700 mb-4">
                          {record.description}
                        </p>
                        {record.attachments && record.attachments.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-500 mb-2">Attachments:</p>
                            <div className="flex flex-wrap gap-2">
                              {record.attachments.map((attachment, idx) => (
                                <a 
                                  key={idx}
                                  href={attachment.url}
                                  className="text-sm text-primary-600 flex items-center p-1 hover:bg-gray-50 rounded"
                                >
                                  <FileText size={14} className="mr-1" />
                                  {attachment.name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <FileText size={40} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-gray-500">No medical records found</p>
                    <Button 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setIsAddRecordModalOpen(true)}
                    >
                      <PlusCircle size={14} className="mr-2" />
                      Add First Record
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {activeTab === 'appointments' && (
            <Card>
              <CardHeader className="px-6 py-4">
                <div className="flex justify-between items-center">
                  <CardTitle>Appointments</CardTitle>
                  <Button size="sm">
                    <PlusCircle size={14} className="mr-2" />
                    New Appointment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {patient.upcomingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {patient.upcomingAppointments.map((appointment) => (
                      <div 
                        key={appointment.id}
                        className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          <div className="p-3 bg-primary-50 rounded-md text-primary-600 mr-4">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {appointment.date} at {appointment.time}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {appointment.doctorName} • {appointment.type} • {appointment.duration} minutes
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Badge
                            variant={
                              appointment.status === 'confirmed' ? 'success' :
                              appointment.status === 'scheduled' ? 'warning' : 'gray'
                            }
                            className="mr-3"
                          >
                            {appointment.status}
                          </Badge>
                          <Button variant="outline" size="sm">
                            Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Calendar size={40} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-gray-500">No appointments found</p>
                    <Button size="sm" className="mt-3">
                      <PlusCircle size={14} className="mr-2" />
                      Schedule Appointment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <FormModal
        isOpen={isAddRecordModalOpen}
        onClose={() => setIsAddRecordModalOpen(false)}
        title="Add Medical Record"
      >
        <AddMedicalRecordForm
          patientId={id || ''}
          onSuccess={() => setIsAddRecordModalOpen(false)}
        />
      </FormModal>
    </div>
  );
};

export default PatientDetail;