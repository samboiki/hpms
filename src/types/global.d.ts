declare global {
  interface Window {
    addAppointmentToPatientTimeline?: (appointment: any) => void;
  }
}

export {};