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
        visit_type: visit.visit_type,
        chief_complaint: visit.chief_complaint,
        diagnosis: visit.diagnosis,
        treatment_plan: visit.treatment_plan,
        prescription: visit.prescription,
        follow_up_required: visit.follow_up_required,
        follow_up_date: visit.follow_up_date,
        notes: visit.notes,
        status: visit.status
      }}
      onSuccess={() => {
        setIsEditModalOpen(false);
        setSelectedVisit(null);
        fetchVisits();
      }}
    />
  )}
</FormModal>

// Update the Edit button onClick handler in the visit card
<Button
  variant="outline"
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    setSelectedVisit(visit.id);
    setIsEditModalOpen(true);
  }}
>
  <Edit3 size={14} className="mr-2" />
  Edit
</Button>
```