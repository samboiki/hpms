import React, { useState } from 'react';
import Modal from 'react-modal';
import { X, ArrowUp, ArrowDown, Clock, User } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useAppointmentsStore } from '../../stores/appointmentsStore';
import { usePatientsStore } from '../../stores/patientsStore';

interface QueueManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

Modal.setAppElement('#root');

const QueueManagementModal: React.FC<QueueManagementModalProps> = ({ isOpen, onClose }) => {
  const { appointments, updateAppointment } = useAppointmentsStore();
  const { patients } = usePatientsStore();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Get today's appointments
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(app => app.date === today);

  // Sort appointments by time
  const sortedAppointments = [...todayAppointments].sort((a, b) => {
    const timeA = new Date(`${a.date} ${a.time}`).getTime();
    const timeB = new Date(`${b.date} ${b.time}`).getTime();
    return timeA - timeB;
  });

  // Filter appointments by status
  const filteredAppointments = selectedStatus === 'all' 
    ? sortedAppointments 
    : sortedAppointments.filter(app => app.status === selectedStatus);

  const moveAppointment = async (appointmentId: string, direction: 'up' | 'down') => {
    const currentIndex = filteredAppointments.findIndex(app => app.id === appointmentId);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === filteredAppointments.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetAppointment = filteredAppointments[newIndex];
    
    // Swap times
    const currentTime = filteredAppointments[currentIndex].time;
    await updateAppointment(appointmentId, { time: targetAppointment.time });
    await updateAppointment(targetAppointment.id, { time: currentTime });
  };

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    await updateAppointment(appointmentId, { status: newStatus });
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="max-w-4xl mx-auto mt-20 bg-white rounded-xl shadow-xl"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4"
    >
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Queue Management</h2>

          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-2">
              <Button 
                variant={selectedStatus === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('all')}
              >
                All
              </Button>
              <Button 
                variant={selectedStatus === 'scheduled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('scheduled')}
              >
                Scheduled
              </Button>
              <Button 
                variant={selectedStatus === 'in-progress' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('in-progress')}
              >
                In Progress
              </Button>
              <Button 
                variant={selectedStatus === 'completed' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('completed')}
              >
                Completed
              </Button>
            </div>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {filteredAppointments.map((appointment, index) => {
              const patient = patients.find(p => p.id === appointment.patientId);
              
              return (
                <div 
                  key={appointment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center flex-1">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-brand-light rounded-full text-brand-primary font-medium">
                      {index + 1}
                    </div>
                    
                    <div className="ml-4 flex items-center">
                      {patient?.avatar ? (
                        <img 
                          src={patient.avatar} 
                          alt={`${patient.firstName} ${patient.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <User size={16} className="text-gray-500" />
                        </div>
                      )}
                      
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                        </h4>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock size={14} className="mr-1" />
                          {appointment.time} • {appointment.type}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <select
                      value={appointment.status}
                      onChange={(e) => updateStatus(appointment.id, e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:ring-brand-primary focus:border-brand-primary"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => moveAppointment(appointment.id, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => moveAppointment(appointment.id, 'down')}
                        disabled={index === filteredAppointments.length - 1}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAppointments.length === 0 && (
              <div className="text-center py-8">
                <Clock size={40} className="mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No appointments found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default QueueManagementModal;