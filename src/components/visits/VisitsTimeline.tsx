```typescript
// Update the imports to include FormModal and EditVisitForm
import FormModal from '../modals/FormModal';
import EditVisitForm from '../forms/EditVisitForm';

// Add to the existing state declarations
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);

// Add this inside the component, after the other modals
<FormModal
  isOpen={isEditModalOpen}
  onClose={() => setIsEditModalOpen(false)}
  title="Edit Visit"
>
  {selectedVisit && (
    <EditVisitForm
      visitId={selectedVisit.id}
      initialData={selectedVisit}
      onSuccess={() => {
        setIsEditModalOpen(false);
        fetchVisits();
      }}
    />
  )}
</FormModal>

// Update the edit button click handler
<Button
  variant="outline"
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    setSelectedVisit(visit);
    setIsEditModalOpen(true);
  }}
>
  <Edit3 size={14} className="mr-2" />
  Edit
</Button>
```