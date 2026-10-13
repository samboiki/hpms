import React from 'react';
import Button from '../ui/Button';

interface Props {
  patientId: string;
  onSuccess: () => void;
}

// This form used to "save" into the in-memory patients store, which is never written to the database:
// for a real patient Save silently did nothing, and anything it did keep was gone after a refresh.
// There is no medical records table to save to, so say so instead of offering a form that loses work.
const AddMedicalRecordForm: React.FC<Props> = ({ onSuccess }) => (
  <div className="space-y-6">
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-medium">Medical records can't be saved here yet.</p>
      <p className="mt-1">
        Record diagnoses, prescriptions and notes in a visit instead: close this window and use Record Visit.
      </p>
    </div>
    <div className="flex justify-end">
      <Button type="button" variant="outline" onClick={() => onSuccess()}>
        Close
      </Button>
    </div>
  </div>
);

export default AddMedicalRecordForm;