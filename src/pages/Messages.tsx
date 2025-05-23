import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';

const Messages = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [messageContent, setMessageContent] = useState<string>('');

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageContent(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle message submission
    console.log('Message submitted:', { template: selectedTemplate, content: messageContent });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-[30px] text-[#494c61] mb-8 flex items-center gap-2">
        <Mail className="h-8 w-8" />
        Messages
      </h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-2">
              Message Template
            </label>
            <select
              id="template"
              value={selectedTemplate}
              onChange={handleTemplateChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a template</option>
              <option value="appointment_reminder">Appointment Reminder</option>
              <option value="test_results">Test Results Available</option>
              <option value="follow_up">Follow-up Reminder</option>
            </select>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Message Content
            </label>
            <textarea
              id="content"
              value={messageContent}
              onChange={handleContentChange}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your message here..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Messages;