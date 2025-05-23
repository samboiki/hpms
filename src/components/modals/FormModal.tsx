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
        "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4",
        "backdrop-blur-sm"
      )}
      contentLabel={title}
      style={{
        overlay: {
          zIndex: 1000,
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col relative animate-scale-in">
        {!hideHeader && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
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