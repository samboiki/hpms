import React, { useEffect, useState } from 'react';

/**
 * Test Component for Agent System - UPDATED
 * 
 * This component contains several intentional issues that should be
 * detected by our intelligent agent system:
 * 1. Missing key props in map function
 * 2. useEffect with missing dependencies  
 * 3. Direct state mutation
 * 4. HPMS-specific issues (wrong date field)
 * 5. Performance issues (unoptimized rendering)
 * 6. Practice ID security violation
 */
export const TestAgentDetection = ({ practiceId, patients }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);

  // ERROR: Missing dependency in useEffect
  useEffect(() => {
    loadAppointments();
  }, []);

  // ERROR: HPMS-specific wrong field usage  
  const createAppointment = async (patientId, appointmentDate) => {
    const appointment = await supabase
      .from('visits')
      .insert({ 
        patient_id: patientId,
        scheduled_date: appointmentDate, // WRONG: Should be visit_date
        practice_id: practiceId || 'default-practice-id' // SECURITY: Fallback practice ID - CRITICAL ISSUE
      });
    
    // ERROR: Direct state mutation
    appointments.push(appointment.data);
  };

  // ERROR: Missing key props in map - AGENT TEST
  const renderPatients = () => {
    return patients.map(patient => (
      <div onClick={() => selectPatient(patient)}>
        {patient.full_name}
      </div>
    ));
  };

  // ERROR: No memoization for expensive operation
  const processPatientData = () => {
    return patients.map(patient => {
      return {
        ...patient,
        displayName: `${patient.first_name} ${patient.last_name}`,
        age: calculateAge(patient.date_of_birth)
      };
    });
  };

  // ERROR: Inline function creates new function on every render
  return (
    <div>
      <h2>Patient Management</h2>
      
      {/* ERROR: Missing keys in mapped elements */}
      {processPatientData().map(patient => (
        <PatientCard 
          patient={patient}
          onSelect={() => setSelectedPatient(patient)}
        />
      ))}
      
      {/* POTENTIAL: Patient data exposure in console */}
      <button onClick={() => console.log('Selected patient:', selectedPatient?.id_number)}>
        Debug Patient
      </button>
    </div>
  );
};

// Helper component with its own issues
const PatientCard = ({ patient, onSelect }) => {
  // ERROR: Component should be memoized for performance
  return (
    <div className="patient-card" onClick={onSelect}>
      <span>{patient.displayName}</span>
      <span>{patient.system_patient_reference_number}</span>
    </div>
  );
};

// Utility function
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  return today.getFullYear() - birth.getFullYear();
};