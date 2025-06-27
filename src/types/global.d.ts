declare global {
  interface Window {
    addAppointmentToPatientTimeline?: (appointment: any) => void;
    Iconify?: {
      scan: (element?: HTMLElement) => void;
      renderSVG: (name: string) => SVGElement | null;
      loadIcons: (icons: string[], callback?: () => void) => void;
    };
    iconifyLoaded?: boolean;
  }
}

export {};