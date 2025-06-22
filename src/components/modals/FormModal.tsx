import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}

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

  // Create a portal to render the modal at body level to avoid z-index issues
  const modalContent = isOpen ? (
    <div 
      className="fixed inset-0"
      style={{ 
        zIndex: 2147483648, // Just above FullScreenModal (2147483647)
      }}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xl"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden animate-scale-in">
          {!hideHeader && (
            <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-20 backdrop-blur-sm"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="w-5 h-5 bg-white rounded"></div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h2>
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
          
          {/* Content */}
          <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-white">
            {children}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // Portal to document body
  return modalContent ? ReactDOM.createPortal(modalContent, document.body) : null;
};

export default FormModal;