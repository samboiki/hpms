import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface FullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  modalId?: string;
}

const FullScreenModal: React.FC<FullScreenModalProps> = ({ 
  isOpen, 
  onClose, 
  children,
  modalId = 'fullscreen-modal'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Save current body styles
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      // Get scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      // Lock body scroll and compensate for scrollbar
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      // Add aria-hidden to main content
      const appRoot = document.getElementById('root');
      if (appRoot) {
        appRoot.setAttribute('aria-hidden', 'true');
      }

      // Focus the modal
      if (modalRef.current) {
        modalRef.current.focus();
      }

      // Cleanup function
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        
        if (appRoot) {
          appRoot.removeAttribute('aria-hidden');
        }
        
        // Restore focus to previous element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('🔐 FULLSCREEN MODAL: ESC key pressed, closing modal');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    // Use capture phase to intercept before any other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  // Create portal root if it doesn't exist
  useEffect(() => {
    let portalRoot = document.getElementById('modal-portal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'modal-portal-root';
      document.body.appendChild(portalRoot);
    }
  }, []);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0"
          style={{ 
            zIndex: 2147483647, // Maximum z-index value
            isolation: 'isolate' // Create new stacking context
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ 
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1]
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${modalId}-title`}
            tabIndex={-1}
            data-fullscreen-modal="true"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Always render to a portal at the document body level
  const portalRoot = document.getElementById('modal-portal-root');
  if (!portalRoot) return null;
  
  return ReactDOM.createPortal(modalContent, portalRoot);
};

export default FullScreenModal;