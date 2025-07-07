import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BookingModalContextType {
  isOpen: boolean;
  selectedLocation?: string;
  selectedService?: string;
  openBookingModal: (location?: string, service?: string) => void;
  closeBookingModal: () => void;
}

const BookingModalContext = createContext<BookingModalContextType | undefined>(undefined);

export const useBookingModal = () => {
  const context = useContext(BookingModalContext);
  if (!context) {
    throw new Error('useBookingModal must be used within a BookingModalProvider');
  }
  return context;
};

interface BookingModalProviderProps {
  children: ReactNode;
}

export const BookingModalProvider: React.FC<BookingModalProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>();
  const [selectedService, setSelectedService] = useState<string | undefined>();

  const openBookingModal = (location?: string, service?: string) => {
    setSelectedLocation(location);
    setSelectedService(service);
    setIsOpen(true);
  };
  
  const closeBookingModal = () => {
    setIsOpen(false);
    setSelectedLocation(undefined);
    setSelectedService(undefined);
  };

  return (
    <BookingModalContext.Provider value={{ 
      isOpen, 
      selectedLocation, 
      selectedService, 
      openBookingModal, 
      closeBookingModal 
    }}>
      {children}
    </BookingModalContext.Provider>
  );
};