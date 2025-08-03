import React from 'react';

export default function TestCursor() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Premium Cursor Test</h1>
          <p className="text-lg text-gray-600">
            Experience the new modern purple cursor with advanced interactions
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Standard Button Test */}
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Button Interactions</h3>
            <button className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Hover & Click Me
            </button>
            <button className="w-full px-6 py-3 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors">
              Outline Button
            </button>
          </div>
          
          {/* Magnetic Effect */}
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Magnetic Effect</h3>
            <button 
              data-cursor="magnetic"
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg"
            >
              Magnetic Button
            </button>
            <div 
              data-cursor="magnetic"
              className="p-4 bg-purple-100 rounded-lg text-center cursor-pointer"
            >
              Magnetic Card
            </div>
          </div>
          
          {/* Text Input Test */}
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Text Cursor</h3>
            <input 
              type="text" 
              placeholder="Type here..."
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
            />
            <textarea 
              placeholder="Multi-line text..."
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              rows={3}
            />
          </div>
          
          {/* Links Test */}
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Link Interactions</h3>
            <a href="#" className="block text-purple-600 hover:text-purple-700 underline">
              Standard Link
            </a>
            <a href="#" className="block px-4 py-2 bg-purple-100 rounded-lg text-purple-700 hover:bg-purple-200 transition-colors">
              Card Link
            </a>
            <a href="#" data-cursor="magnetic" className="inline-block px-4 py-2 text-purple-600 font-semibold">
              Magnetic Link
            </a>
          </div>
          
          {/* Interactive Area */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Interactive Area</h3>
            <div className="h-32 bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg flex items-center justify-center">
              <p className="text-gray-600">Move cursor here</p>
            </div>
          </div>
          
          {/* Special States */}
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Special States</h3>
            <button 
              data-cursor="loading"
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg"
            >
              Loading State
            </button>
            <button 
              data-cursor="disabled"
              className="w-full px-6 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
              disabled
            >
              Disabled State
            </button>
          </div>
        </div>
        
        {/* Click Ripple Test */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Click Ripple Effect</h3>
            <div className="h-48 bg-gradient-to-br from-purple-50 to-white rounded-lg border-2 border-dashed border-purple-300 flex items-center justify-center">
              <p className="text-gray-600">Click anywhere to see ripple effect</p>
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h4 className="font-semibold text-purple-800 mb-2">Cursor Features:</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>✓ Smooth spring physics animation</li>
              <li>✓ Purple theme (RGB: 147, 51, 234)</li>
              <li>✓ Outer ring with slower movement</li>
              <li>✓ Click ripple effects</li>
              <li>✓ Text cursor for inputs</li>
              <li>✓ Hover states for interactive elements</li>
              <li>✓ Magnetic effect on special elements</li>
              <li>✓ Trailing glow effect on hover</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}