import React, { useState } from 'react';
import FullScreenModal from '../components/ui/FullScreenModal';
import { ModalClickWrapper } from '../components/ui/ModalClickWrapper';
import { Icon } from '@iconify/react';

const TestModalClick: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [debugMode, setDebugMode] = useState(false);

  const handleModalClick = (element: string) => {
    setClickCount(prev => prev + 1);
    console.log(`✅ Clicked: ${element}, Total clicks: ${clickCount + 1}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Modal Click Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          
          <div className="space-y-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Open Test Modal
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="debugMode"
                checked={debugMode}
                onChange={(e) => {
                  setDebugMode(e.target.checked);
                  localStorage.setItem('modalDebugMode', e.target.checked ? 'true' : 'false');
                }}
                className="h-4 w-4 text-indigo-600"
              />
              <label htmlFor="debugMode" className="text-sm font-medium text-gray-700">
                Enable Debug Mode
              </label>
            </div>
            
            <div className="text-sm text-gray-600">
              Click count: <span className="font-bold text-indigo-600">{clickCount}</span>
            </div>
          </div>
        </div>

        <FullScreenModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          modalId="test-modal-click"
        >
          <ModalClickWrapper className="h-full flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Modal Click Test</h2>
                <button
                  onClick={() => {
                    handleModalClick('Close button');
                    setIsModalOpen(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon icon="solar:close-bold-duotone" className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 font-medium mb-2">Test Instructions:</p>
                  <p className="text-blue-700 text-sm">
                    Click on any button or interactive element below. Each click should register and increment the counter.
                  </p>
                </div>

                {/* Test Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleModalClick('Primary button')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Primary Button
                  </button>
                  
                  <button
                    onClick={() => handleModalClick('Secondary button')}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Secondary Button
                  </button>
                  
                  <button
                    onClick={() => handleModalClick('Outlined button')}
                    className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Outlined Button
                  </button>
                  
                  <button
                    onClick={() => handleModalClick('Icon button')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />
                    <span>Icon Button</span>
                  </button>
                </div>

                {/* Form Elements */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Form Elements Test</h3>
                  
                  <input
                    type="text"
                    placeholder="Click to focus this input"
                    onFocus={() => handleModalClick('Text input')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  
                  <select
                    onChange={() => handleModalClick('Select dropdown')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option>Select an option</option>
                    <option>Option 1</option>
                    <option>Option 2</option>
                    <option>Option 3</option>
                  </select>
                  
                  <textarea
                    placeholder="Click to focus this textarea"
                    onFocus={() => handleModalClick('Textarea')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                </div>

                {/* Nested Modal Test */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 font-medium mb-2">Z-Index Test:</p>
                  <p className="text-yellow-700 text-sm mb-4">
                    This section tests if elements with high z-index values can still be clicked.
                  </p>
                  <div className="relative">
                    <button
                      onClick={() => handleModalClick('High z-index button')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors relative"
                      style={{ zIndex: 9999 }}
                    >
                      High Z-Index Button
                    </button>
                  </div>
                </div>

                {/* Click Results */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Click Results:</h3>
                  <p className="text-gray-700">
                    Total clicks registered: <span className="font-bold text-indigo-600">{clickCount}</span>
                  </p>
                  {clickCount > 0 && (
                    <p className="text-green-600 text-sm mt-2">
                      ✅ Modal clicks are working correctly!
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    handleModalClick('Cancel button');
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleModalClick('Confirm button');
                    alert('All clicks working! 🎉');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </ModalClickWrapper>
        </FullScreenModal>
      </div>
    </div>
  );
};

export default TestModalClick;