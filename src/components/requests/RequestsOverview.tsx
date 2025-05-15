import React, { useState } from 'react';
import FormModal from '../modals/FormModal';
import AddLabRequestForm from '../forms/AddLabRequestForm';
import AddMediaRequestForm from '../forms/AddMediaRequestForm';
import { useAuth } from '../../stores/authStore';

const RequestsOverview: React.FC = () => {
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const { user } = useAuth();

  const fetchRequests = () => {
    // Implement request fetching logic
  };

  return (
    <>
      <FormModal
        isOpen={isLabModalOpen}
        onClose={() => setIsLabModalOpen(false)}
        title="New Lab Request"
      >
        <AddLabRequestForm
          doctorId={user?.id || ''} // Get the current user's ID from auth store
          onSuccess={() => {
            setIsLabModalOpen(false);
            fetchRequests();
          }}
        />
      </FormModal>

      <FormModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        title="New Media Request"
      >
        <AddMediaRequestForm
          doctorId={user?.id || ''} // Get the current user's ID from auth store
          onSuccess={() => {
            setIsMediaModalOpen(false);
            fetchRequests();
          }}
        />
      </FormModal>
    </>
  );
};

export default RequestsOverview;