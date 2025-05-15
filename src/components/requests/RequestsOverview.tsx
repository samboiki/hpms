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