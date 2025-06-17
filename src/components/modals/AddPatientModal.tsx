import React, { useEffect } from 'react';
import Modal from 'react-modal';
import { X, ArrowLeft, Plus, UserPlus, Maximize, Users, Shield, Activity, Stethoscope } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../stores/themeStore';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

Modal.setAppElement('#root');

const AddPatientModal: React.FC<AddPatientModalProps> = ({ 
  isOpen, 
  onClose, 
  children
}) => {
  const { currentTheme } = useTheme();

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

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
      overlayClassName="fixed inset-0 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xl"
      contentLabel="Add New Patient"
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
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>Add New Patient</h2>
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

export default AddPatientModal;