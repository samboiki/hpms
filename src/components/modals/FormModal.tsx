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
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col relative animate-scale-in border border-white/20">
        {!hideHeader && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100/50 bg-gradient-to-r from-white/50 to-gray-50/50">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-all duration-200 p-2.5 rounded-xl hover:bg-gray-100/80 hover:shadow-md hover:scale-105"
            >
              <X size={24} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </Modal>
  );
};

export default FormModal;