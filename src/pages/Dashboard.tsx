import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import QueueManagementModal from '../components/modals/QueueManagementModal';

const Dashboard: React.FC = () => {
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isQueueManagementModalOpen, setIsQueueManagementModalOpen] = useState(false);

  return (
    <div>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsQueueManagementModalOpen(true)}
      >
        Manage Queue
      </Button>

      <QueueManagementModal
        isOpen={isQueueManagementModalOpen}
        onClose={() => setIsQueueManagementModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;