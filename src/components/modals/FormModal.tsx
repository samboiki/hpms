import React, { useEffect } from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}

Modal.setAppElement('#root');

const FormModal: React.FC<FormModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  className,
  hideHeader = false
}) => {
  // Handle modal open/close effects
  useEffect(() => {
    if (isOpen) {
      // Hide scrollbar and prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Add modal-open class to body for styling
      document.body.classList.add('modal-open');
    } else {
      // Restore scrolling and remove modal-open class
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
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4 pointer-events-none",
        className
      )}
      overlayClassName={cn(
        "fixed inset-0 bg-black/60 flex items-center justify-center p-4",
        "backdrop-blur-xl"
      )}
      contentLabel={title}
      style={{
        overlay: {
          zIndex: 1000,
        }
      }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden animate-scale-in">
        {!hideHeader && (
          <div className="relative bg-gradient-to-r from-[#01b9d5] to-purple-600 p-6 text-white">
            <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-purple-600/20 backdrop-blur-sm"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-5 h-5 bg-white rounded"></div>
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{title}</h2>
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
        )}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
          {children}
        </div>
      </div>
    </Modal>
  );
};

export default FormModal;