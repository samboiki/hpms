import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Complete Test Component for 30-Agent System
 * 
 * This component contains various patterns to trigger different agents:
 * - Error Detective: React errors and missing keys
 * - Performance Engine: Unoptimized rendering
 * - Privacy & HIPAA: Security violations
 * - Business Logic Validator: Workflow violations
 * - AI Code Generation: Incomplete components
 */

// ERROR: Incomplete component (AI Code Generation Agent should detect)
export const QuickComponent = () => {
  
};

// Main test component with multiple issues
export const CompleteSystemTest = ({ practiceId }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // ERROR: Missing dependencies (Error Detective)
  useEffect(() => {
    loadPatients();
  }, []);
  
  // ERROR: Business workflow violation - no patient validation
  const createVisitWithoutPatient = async () => {
    const { data } = await supabase
      .from('visits')
      .insert({
        visit_date: new Date(),
        practice_id: practiceId || 'fallback' // CRITICAL: Security violation
      });
  };
  
  // ERROR: Performance issue - no memoization
  const processLargeDataset = () => {
    return patients.map(patient => {
      // Heavy calculation without optimization
      const appointments = patient.visits?.map(visit => ({
        ...visit,
        formatted: new Date(visit.visit_date).toLocaleDateString()
      }));
      
      return {
        ...patient,
        appointments,
        age: calculateAge(patient.date_of_birth)
      };
    });
  };
  
  // ERROR: HIPAA violation - logging patient data
  const debugPatient = (patient) => {
    console.log('Patient SSN:', patient.id_number); // CRITICAL: HIPAA violation
    console.log('Medical history:', patient.medical_history);
  };
  
  // ERROR: Missing key props (Error Detective)
  const renderPatientList = () => {
    return processLargeDataset().map(patient => (
      <div onClick={() => debugPatient(patient)}>
        <h3>{patient.full_name}</h3>
        <p>Ref: {patient.system_patient_reference_number}</p>
        
        {/* ERROR: Nested map without keys */}
        {patient.appointments?.map(apt => (
          <span>{apt.formatted}</span>
        ))}
      </div>
    ));
  };
  
  // ERROR: Wrong field usage (Medical Validator)
  const scheduleAppointment = async (patientId, date) => {
    const { data } = await supabase
      .from('visits')
      .insert({
        patient_id: patientId,
        scheduled_date: date, // ERROR: Should be visit_date
        status: 'completed' // ERROR: Direct status change without workflow
      });
  };
  
  // ERROR: Business logic violation - invoice without visit
  const createStandaloneInvoice = async () => {
    const { data } = await supabase
      .from('invoices_enhanced')
      .insert({
        amount: 500, // ERROR: Hardcoded price
        practice_id: practiceId
        // Missing visit_id - workflow violation
      });
  };
  
  // ERROR: Missing practice isolation
  const loadAllPatientsUnsafe = async () => {
    const { data } = await supabase
      .from('patients')
      .select('*'); // ERROR: No practice_id filter
  };
  
  // ERROR: N+1 query pattern (Performance)
  const loadPatientsWithVisits = async () => {
    const { data: patients } = await supabase
      .from('patients')
      .select('*');
      
    // ERROR: Loop queries instead of JOIN
    for (const patient of patients) {
      const { data: visits } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', patient.id);
      patient.visits = visits;
    }
  };
  
  // ERROR: Unbatched communication (Performance)
  const sendAppointmentReminders = async () => {
    patients.forEach(async patient => {
      // ERROR: Not using centralized gateway
      await sendSMS(patient.phone, 'Reminder');
    });
  };
  
  return (
    <div className="p-4">
      <h1>Complete Agent System Test</h1>
      
      {/* ERROR: Component without error boundary */}
      <div className="patient-list">
        {loading ? (
          <div>Loading...</div>
        ) : (
          renderPatientList()
        )}
      </div>
      
      {/* Test buttons to trigger various violations */}
      <div className="mt-4 space-x-2">
        <button onClick={createVisitWithoutPatient}>
          Create Visit (No Patient)
        </button>
        <button onClick={createStandaloneInvoice}>
          Create Invoice (No Visit)
        </button>
        <button onClick={loadAllPatientsUnsafe}>
          Load All Patients (Unsafe)
        </button>
        <button onClick={sendAppointmentReminders}>
          Send Reminders (Unbatched)
        </button>
      </div>
    </div>
  );
};

// Helper without proper error handling
const calculateAge = (dob) => {
  return new Date().getFullYear() - new Date(dob).getFullYear();
};