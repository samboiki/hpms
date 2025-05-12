import React, { useEffect } from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

Modal.setAppElement('#root');

const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, title, children }) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      contentLabel={title}
      aria={{
        labelledby: 'modal-title',
        describedby: 'modal-description'
      }}
    >
      <div 
        className="
          bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] 
          pointer-events-auto flex flex-col relative animate-scale-in
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 
            id="modal-title"
            className="text-2xl font-bold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div 
          id="modal-description"
          className="flex-1 overflow-y-auto p-6 custom-scrollbar"
        >
          {children}
        </div>
      </div>
    </Modal>
  );
};

export default FormModal;