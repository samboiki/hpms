import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
  icon?: string;
}

const FormModal: React.FC<FormModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  className,
  hideHeader = false,
  icon = "solar:calendar-add-bold-duotone"
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
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0"
          style={{ 
            zIndex: 2147483648, // Just above FullScreenModal (2147483647)
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Backdrop */}
          <motion.div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 20 }}
            >
          {!hideHeader && (
            <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-20 backdrop-blur-sm"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Icon icon={icon} className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h2>
                    <p className="text-blue-100 text-sm">Complete the information below</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-white">
            {children}
          </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal to document body
  return ReactDOM.createPortal(modalContent, document.body);
};

export default FormModal;