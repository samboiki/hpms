import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { X, ArrowLeft, MessageSquare, Mail, Edit, Maximize, Plus, User, Clock, Activity, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../stores/themeStore';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  medical_aid_details?: any[];
  created_at: string;
}

interface RecordNewVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  children: React.ReactNode;
}

Modal.setAppElement('#root');

const RecordNewVisitModal: React.FC<RecordNewVisitModalProps> = ({ 
  isOpen, 
  onClose, 
  patient,
  children
}) => {
  const { currentTheme } = useTheme();

  // Calculate age function
  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Handle modal open/close effects
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  if (!patient) return null;

  const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : 0;
  const hasMedicalAid = patient.medical_aid_details && patient.medical_aid_details.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
      overlayClassName="fixed inset-0 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xl"
      contentLabel="Record New Visit"
      style={{
        overlay: {
          zIndex: 99998,
        }
      }}
    >
      {/* Floating background elements */}
      <div className="absolute bottom-40 right-20 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-float-delayed"></div>
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className={`relative bg-gradient-to-r ${currentTheme.gradients.sidebar} p-6 text-white`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.gradients.sidebar} opacity-20 backdrop-blur-sm`}></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <div className="w-6 h-6 flex items-center justify-center">
                  <div className="w-5 h-5 bg-white rounded"></div>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>Record New Visit</h2>
                <p className="text-blue-100 text-sm">Complete the information below</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-all duration-200 p-2.5 rounded-xl hover:bg-white/20 hover:scale-105"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
          {children}
        </div>
      </div>
    </Modal>
  );
};

export default RecordNewVisitModal;