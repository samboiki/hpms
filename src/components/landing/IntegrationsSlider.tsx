'use client';

import React from 'react';
import { Icon } from '@iconify/react';

const integrations = [
  // Communication & Messaging
  { name: 'WhatsApp', icon: 'logos:whatsapp-icon', color: '#25D366' },
  { name: 'Telegram', icon: 'logos:telegram', color: '#0088CC' },
  { name: 'SMS', icon: 'solar:chat-square-text-bold-duotone', color: '#6366F1' },
  { name: 'Email', icon: 'solar:letter-bold-duotone', color: '#EA4335' },
  
  // Calendar & Scheduling
  { name: 'Google Calendar', icon: 'logos:google-calendar', color: '#4285F4' },
  { name: 'Outlook Calendar', icon: 'vscode-icons:file-type-outlook', color: '#0078D4' },
  { name: 'Apple Calendar', icon: 'simple-icons:apple', color: '#000000' },
  
  // Payment Processing
  { name: 'PayPal', icon: 'logos:paypal', color: '#00457C' },
  { name: 'Stripe', icon: 'logos:stripe', color: '#008CDD' },
  { name: 'FNB', icon: 'simple-icons:fnb', color: '#004C3F' },
  { name: 'Standard Bank', icon: 'simple-icons:standardbank', color: '#0033A0' },
  
  // Medical Systems
  { name: 'HL7 FHIR', icon: 'simple-icons:hl7', color: '#FF6B35' },
  { name: 'DICOM', icon: 'solar:health-bold-duotone', color: '#00A8E8' },
  { name: 'ICD-10', icon: 'solar:document-medicine-bold-duotone', color: '#FF4B5C' },
  
  // Cloud Storage
  { name: 'Google Drive', icon: 'logos:google-drive', color: '#4285F4' },
  { name: 'Dropbox', icon: 'logos:dropbox', color: '#0061FF' },
  { name: 'OneDrive', icon: 'logos:microsoft-onedrive', color: '#0078D4' },
  
  // Video Conferencing
  { name: 'Zoom', icon: 'logos:zoom-icon', color: '#2D8CFF' },
  { name: 'Microsoft Teams', icon: 'logos:microsoft-teams', color: '#6264A7' },
  { name: 'Google Meet', icon: 'logos:google-meet', color: '#00897B' },
  
  // Accounting & ERP
  { name: 'QuickBooks', icon: 'simple-icons:quickbooks', color: '#2CA01C' },
  { name: 'Xero', icon: 'simple-icons:xero', color: '#13B5EA' },
  { name: 'Sage', icon: 'simple-icons:sage', color: '#00DC06' },
  
  // Lab Systems
  { name: 'LabCorp', icon: 'solar:test-tube-bold-duotone', color: '#0057B8' },
  { name: 'Quest', icon: 'solar:virus-bold-duotone', color: '#00A94F' },
  
  // Pharmacy
  { name: 'CVS', icon: 'solar:pills-3-bold-duotone', color: '#CC0000' },
  { name: 'Walgreens', icon: 'solar:pills-bold-duotone', color: '#E31837' },
  
  // Insurance
  { name: 'Medical Aid', icon: 'solar:shield-plus-bold-duotone', color: '#4CAF50' },
  { name: 'Discovery', icon: 'solar:shield-check-bold-duotone', color: '#0E4DA4' },
  
  // Analytics
  { name: 'Power BI', icon: 'simple-icons:powerbi', color: '#F2C811' },
  { name: 'Tableau', icon: 'simple-icons:tableau', color: '#E97627' },
  
  // Security
  { name: 'Auth0', icon: 'simple-icons:auth0', color: '#EB5424' },
  { name: 'Okta', icon: 'simple-icons:okta', color: '#007DC1' },
];

export function IntegrationsSlider() {
  return (
    <section className="py-24 overflow-hidden bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Seamlessly Connect Your Favorite Tools
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            OneHealth integrates with 50+ popular healthcare, communication, and business tools to streamline your practice workflow.
          </p>
        </div>

        <div className="relative">
          {/* Gradient masks for fade effect */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />

          {/* Slider container */}
          <div className="relative h-[400px] flex items-center">
            {/* Forward scrolling row */}
            <div className="absolute top-1/4 -translate-y-1/2 flex gap-8 animate-scroll-forward">
              {[...integrations, ...integrations].map((integration, index) => (
                <div
                  key={`forward-${index}`}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 min-w-[120px]"
                >
                  <Icon
                    icon={integration.icon}
                    className="w-12 h-12 mb-2"
                    style={{ color: integration.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    {integration.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Center logo */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="bg-white rounded-full p-8 shadow-2xl">
                <Icon
                  icon="solar:health-bold-duotone"
                  className="w-16 h-16 text-primary-600"
                />
              </div>
            </div>

            {/* Reverse scrolling row */}
            <div className="absolute top-3/4 -translate-y-1/2 flex gap-8 animate-scroll-reverse">
              {[...integrations.slice().reverse(), ...integrations.slice().reverse()].map((integration, index) => (
                <div
                  key={`reverse-${index}`}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 min-w-[120px]"
                >
                  <Icon
                    icon={integration.icon}
                    className="w-12 h-12 mb-2"
                    style={{ color: integration.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    {integration.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-16">
          <a
            href="/integrations"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold text-lg"
          >
            View all integrations
            <Icon icon="solar:arrow-right-line-duotone" className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}