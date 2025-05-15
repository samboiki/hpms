```typescript
// Update the imports to include EditVisitForm
import EditVisitForm from '../forms/EditVisitForm';

// Add this to the existing state declarations
const [isEditModalOpen, setIsEditModalOpen] = useState(false);

// Add this to the JSX, just before the closing </Card> tag
<FormModal
  isOpen={isEditModalOpen}
  onClose={() => setIsEditModalOpen(false)}
  title="Edit Visit"
>
  {selectedVisit && (
    <EditVisitForm
      visitId={selectedVisit}
      initialData={{
        visit_type: visits.find(v => v.id === selectedVisit)?.visit_type || 'consultation',
        chief_complaint: visits.find(v => v.id === selectedVisit)?.chief_complaint || '',
        diagnosis: visits.find(v => v.id === selectedVisit)?.diagnosis || '',
        treatment_plan: visits.find(v => v.id === selectedVisit)?.treatment_plan || '',
        prescription: visits.find(v => v.id === selectedVisit)?.prescription || '',
        follow_up_required: visits.find(v => v.id === selectedVisit)?.follow_up_required || false,
        follow_up_date: visits.find(v => v.id === selectedVisit)?.follow_up_date || '',
        notes: visits.find(v => v.id === selectedVisit)?.notes || '',
        status: visits.find(v => v.id === selectedVisit)?.status || 'in-progress'
      }}
      onSuccess={() => {
        setIsEditModalOpen(false);
        setSelectedVisit(null);
        fetchVisits();
      }}
    />
  )}
</FormModal>
```