import { useState, useCallback, useEffect } from 'react';

export interface ModalState {
  isNextOfKinModalOpen: boolean;
  isAddVisitModalOpen: boolean;
  isEditVisitModalOpen: boolean;
  isSmsModalOpen: boolean;
  isMedicalAidModalOpen: boolean;
  isMessageModalOpen: boolean;
  isVitalsModalOpen: boolean;
  isLabRequestModalOpen: boolean;
  isMediaRequestModalOpen: boolean;
  isBillingModalOpen: boolean;
  isEmailModalOpen: boolean;
  isFullScreen: boolean;
}

export interface ModalActions {
  openNextOfKinModal: () => void;
  closeNextOfKinModal: () => void;
  openAddVisitModal: () => void;
  closeAddVisitModal: () => void;
  openEditVisitModal: () => void;
  closeEditVisitModal: () => void;
  openSmsModal: () => void;
  closeSmsModal: () => void;
  openMedicalAidModal: () => void;
  closeMedicalAidModal: () => void;
  openMessageModal: () => void;
  closeMessageModal: () => void;
  openVitalsModal: () => void;
  closeVitalsModal: () => void;
  openLabRequestModal: () => void;
  closeLabRequestModal: () => void;
  openMediaRequestModal: () => void;
  closeMediaRequestModal: () => void;
  openBillingModal: () => void;
  closeBillingModal: () => void;
  openEmailModal: () => void;
  closeEmailModal: () => void;
  toggleFullScreen: () => void;
  closeAllModals: () => void;
}

export const usePatientModalState = () => {
  const [modalState, setModalState] = useState<ModalState>({
    isNextOfKinModalOpen: false,
    isAddVisitModalOpen: false,
    isEditVisitModalOpen: false,
    isSmsModalOpen: false,
    isMedicalAidModalOpen: false,
    isMessageModalOpen: false,
    isVitalsModalOpen: false,
    isLabRequestModalOpen: false,
    isMediaRequestModalOpen: false,
    isBillingModalOpen: false,
    isEmailModalOpen: false,
    isFullScreen: true, // Default to full screen
  });

  // Debug state changes
  useEffect(() => {
    console.log('🔧 MODAL STATE DEBUG: Modal state changed:', {
      isMessageModalOpen: modalState.isMessageModalOpen,
      isEmailModalOpen: modalState.isEmailModalOpen,
      timestamp: new Date().toISOString()
    });
  }, [modalState.isMessageModalOpen, modalState.isEmailModalOpen]);

  const openNextOfKinModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isNextOfKinModalOpen: true })), []);
  
  const closeNextOfKinModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isNextOfKinModalOpen: false })), []);

  const openAddVisitModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isAddVisitModalOpen: true })), []);
  
  const closeAddVisitModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isAddVisitModalOpen: false })), []);

  const openEditVisitModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isEditVisitModalOpen: true })), []);
  
  const closeEditVisitModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isEditVisitModalOpen: false })), []);

  const openSmsModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isSmsModalOpen: true })), []);
  
  const closeSmsModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isSmsModalOpen: false })), []);

  const openMedicalAidModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isMedicalAidModalOpen: true })), []);
  
  const closeMedicalAidModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isMedicalAidModalOpen: false })), []);

  const openMessageModal = useCallback(() => {
    console.log('🔧 MODAL STATE DEBUG: openMessageModal() called');
    setModalState(prev => ({ ...prev, isMessageModalOpen: true }));
  }, []);
  
  const closeMessageModal = useCallback(() => {
    console.log('🔧 MODAL STATE DEBUG: closeMessageModal() called');
    console.trace('🔧 MODAL STATE DEBUG: Call stack for closeMessageModal');
    setModalState(prev => ({ ...prev, isMessageModalOpen: false }));
  }, []);

  const openVitalsModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isVitalsModalOpen: true })), []);
  
  const closeVitalsModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isVitalsModalOpen: false })), []);

  const openLabRequestModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isLabRequestModalOpen: true })), []);
  
  const closeLabRequestModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isLabRequestModalOpen: false })), []);

  const openMediaRequestModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isMediaRequestModalOpen: true })), []);
  
  const closeMediaRequestModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isMediaRequestModalOpen: false })), []);

  const openBillingModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isBillingModalOpen: true })), []);
  
  const closeBillingModal = useCallback(() => 
    setModalState(prev => ({ ...prev, isBillingModalOpen: false })), []);

  const openEmailModal = useCallback(() => {
    console.log('🔧 MODAL STATE DEBUG: openEmailModal() called');
    setModalState(prev => ({ ...prev, isEmailModalOpen: true }));
  }, []);
  
  const closeEmailModal = useCallback(() => {
    console.log('🔧 MODAL STATE DEBUG: closeEmailModal() called');
    console.trace('🔧 MODAL STATE DEBUG: Call stack for closeEmailModal');
    setModalState(prev => ({ ...prev, isEmailModalOpen: false }));
  }, []);

  const toggleFullScreen = useCallback(() => 
    setModalState(prev => ({ ...prev, isFullScreen: !prev.isFullScreen })), []);

  const closeAllModals = useCallback(() => {
    console.log('🔧 MODAL STATE DEBUG: closeAllModals() called - THIS WILL CLOSE MESSAGE AND EMAIL MODALS');
    console.trace('🔧 MODAL STATE DEBUG: Call stack for closeAllModals');
    setModalState(prev => ({ 
      ...prev, 
      isNextOfKinModalOpen: false,
      isAddVisitModalOpen: false,
      isEditVisitModalOpen: false,
      isSmsModalOpen: false,
      isMedicalAidModalOpen: false,
      isMessageModalOpen: false,
      isVitalsModalOpen: false,
      isLabRequestModalOpen: false,
      isMediaRequestModalOpen: false,
      isBillingModalOpen: false,
      isEmailModalOpen: false,
    }));
  }, []);

  const actions: ModalActions = {
    openNextOfKinModal,
    closeNextOfKinModal,
    openAddVisitModal,
    closeAddVisitModal,
    openEditVisitModal,
    closeEditVisitModal,
    openSmsModal,
    closeSmsModal,
    openMedicalAidModal,
    closeMedicalAidModal,
    openMessageModal,
    closeMessageModal,
    openVitalsModal,
    closeVitalsModal,
    openLabRequestModal,
    closeLabRequestModal,
    openMediaRequestModal,
    closeMediaRequestModal,
    openBillingModal,
    closeBillingModal,
    openEmailModal,
    closeEmailModal,
    toggleFullScreen,
    closeAllModals,
  };

  return {
    modalState,
    ...actions,
  };
};