'use client';

import React from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

const integrations = [
  // Communication & Messaging
  { name: 'WhatsApp', icon: 'logos:whatsapp-icon', color: '#25D366' },
  { name: 'Telegram', icon: 'logos:telegram', color: '#0088CC' },
  { name: 'SMS', icon: 'solar:chat-square-text-bold-duotone', color: '#6366F1' },
  { name: 'Email', icon: 'logos:google-gmail', color: '#EA4335' },
  { name: 'Slack', icon: 'logos:slack-icon', color: '#4A154B' },
  
  // Calendar & Scheduling
  { name: 'Google Calendar', icon: 'logos:google-calendar', color: '#4285F4' },
  { name: 'Outlook', icon: 'vscode-icons:file-type-outlook', color: '#0078D4' },
  { name: 'Calendly', icon: 'simple-icons:calendly', color: '#006BFF' },
  
  // Payment Processing
  { name: 'PayPal', icon: 'logos:paypal', color: '#00457C' },
  { name: 'Stripe', icon: 'logos:stripe', color: '#008CDD' },
  { name: 'Square', icon: 'simple-icons:square', color: '#3E4348' },
  { name: 'PayFast', icon: 'simple-icons:paypal', color: '#2AA1E0' },
  
  // Medical Systems
  { name: 'HL7 FHIR', icon: 'simple-icons:hl7', color: '#FF6B35' },
  { name: 'Epic', icon: 'solar:health-bold-duotone', color: '#FF0080' },
  { name: 'Cerner', icon: 'solar:heart-pulse-bold-duotone', color: '#00A8E8' },
  
  // Cloud Storage
  { name: 'Google Drive', icon: 'logos:google-drive', color: '#4285F4' },
  { name: 'Dropbox', icon: 'logos:dropbox', color: '#0061FF' },
  { name: 'OneDrive', icon: 'logos:microsoft-onedrive', color: '#0078D4' },
  { name: 'Box', icon: 'logos:box', color: '#0061D5' },
  
  // Video Conferencing
  { name: 'Zoom', icon: 'logos:zoom-icon', color: '#2D8CFF' },
  { name: 'Teams', icon: 'logos:microsoft-teams', color: '#6264A7' },
  { name: 'Meet', icon: 'logos:google-meet', color: '#00897B' },
  
  // Accounting & ERP
  { name: 'QuickBooks', icon: 'simple-icons:quickbooks', color: '#2CA01C' },
  { name: 'Xero', icon: 'simple-icons:xero', color: '#13B5EA' },
  { name: 'SAP', icon: 'logos:sap', color: '#008FD3' },
  { name: 'Sage', icon: 'simple-icons:sage', color: '#00DC06' },
  
  // Lab Systems
  { name: 'LabCorp', icon: 'solar:test-tube-bold-duotone', color: '#0057B8' },
  { name: 'Quest', icon: 'solar:virus-bold-duotone', color: '#00A94F' },
  { name: 'PathCare', icon: 'solar:dna-bold-duotone', color: '#E74C3C' },
  
  // Pharmacy
  { name: 'Dis-Chem', icon: 'solar:pills-3-bold-duotone', color: '#00A651' },
  { name: 'Clicks', icon: 'solar:pills-bold-duotone', color: '#ED1C24' },
  { name: 'MediRite', icon: 'solar:pills-2-bold-duotone', color: '#0066CC' },
  
  // Insurance
  { name: 'Discovery', icon: 'solar:shield-check-bold-duotone', color: '#0E4DA4' },
  { name: 'Momentum', icon: 'solar:shield-star-bold-duotone', color: '#8B1538' },
  { name: 'Bonitas', icon: 'solar:shield-plus-bold-duotone', color: '#00A79D' },
  
  // Analytics
  { name: 'Power BI', icon: 'simple-icons:powerbi', color: '#F2C811' },
  { name: 'Tableau', icon: 'simple-icons:tableau', color: '#E97627' },
  { name: 'Looker', icon: 'simple-icons:looker', color: '#4285F4' },
  
  // Security & Auth
  { name: 'Auth0', icon: 'simple-icons:auth0', color: '#EB5424' },
  { name: 'Okta', icon: 'simple-icons:okta', color: '#007DC1' },
  { name: '2FA', icon: 'solar:shield-keyhole-bold-duotone', color: '#F39C12' },
  
  // Additional
  { name: 'Twilio', icon: 'logos:twilio-icon', color: '#F22F46' },
  { name: 'SendGrid', icon: 'simple-icons:sendgrid', color: '#3A86FF' },
  { name: 'Mailchimp', icon: 'logos:mailchimp', color: '#FFE01B' },
  { name: 'HubSpot', icon: 'logos:hubspot', color: '#FF7A59' },
  { name: 'Salesforce', icon: 'logos:salesforce', color: '#00A1E0' },
];

export function IntegrationsSlider() {
  // Split integrations into two rows for better distribution
  const halfPoint = Math.ceil(integrations.length / 2);
  const firstRowIntegrations = integrations.slice(0, halfPoint);
  const secondRowIntegrations = integrations.slice(halfPoint);
  
  // Create enough copies for seamless infinite scroll
  const infiniteFirstRow = [...firstRowIntegrations, ...firstRowIntegrations, ...firstRowIntegrations, ...firstRowIntegrations, ...firstRowIntegrations, ...firstRowIntegrations];
  const infiniteSecondRow = [...secondRowIntegrations, ...secondRowIntegrations, ...secondRowIntegrations, ...secondRowIntegrations, ...secondRowIntegrations, ...secondRowIntegrations];
  
  return (
    <section className="py-24 overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 relative">
      {/* Animated background patterns */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-300/20 to-blue-300/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tr from-blue-300/20 to-purple-300/20 rounded-full blur-3xl animate-pulse" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 font-semibold text-sm uppercase tracking-wider">
            Integrations
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
            Seamlessly Connect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Favorite Tools</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            OneHealth integrates with 50+ popular healthcare, communication, and business tools to streamline your practice workflow.
          </p>
        </motion.div>

        <div className="relative">
          {/* Slider container with proper height for both rows */}
          <div className="relative h-[280px] flex flex-col justify-center gap-6 overflow-hidden">
            {/* Fade gradients at edges */}
            <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-purple-50 via-purple-50/90 via-purple-50/60 via-purple-50/30 to-transparent z-20 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-blue-50 via-blue-50/90 via-blue-50/60 via-blue-50/30 to-transparent z-20 pointer-events-none" />
            
            {/* Forward scrolling row - Top */}
            <div className="relative">
              <div className="flex gap-4 animate-scroll-forward-slow whitespace-nowrap">
                {infiniteFirstRow.map((integration, index) => (
                  <motion.div
                    key={`forward-${index}`}
                    whileHover={{ scale: 1.1, y: -5 }}
                    className="group relative flex-shrink-0"
                  >
                    <div className="flex flex-col items-center justify-center p-4 bg-white/90 backdrop-blur-md rounded-xl shadow-md hover:shadow-xl transition-all duration-300 w-[100px] h-[100px] border border-gray-100/50 group-hover:border-purple-200">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full blur-lg opacity-0 group-hover:opacity-20 transition-opacity" />
                        <Icon
                          icon={integration.icon}
                          className="w-8 h-8 mb-2 relative z-10 transition-transform group-hover:scale-110"
                          style={{ color: integration.icon.includes('logos:') || integration.icon.includes('simple-icons:') || integration.icon.includes('vscode-icons:') ? undefined : integration.color }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 whitespace-nowrap group-hover:text-gray-800 text-center">
                        {integration.name}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Reverse scrolling row - Bottom */}
            <div className="relative">
              <div className="flex gap-4 animate-scroll-reverse-slow whitespace-nowrap">
                {infiniteSecondRow.map((integration, index) => (
                  <motion.div
                    key={`reverse-${index}`}
                    whileHover={{ scale: 1.1, y: -5 }}
                    className="group relative flex-shrink-0"
                  >
                    <div className="flex flex-col items-center justify-center p-4 bg-white/90 backdrop-blur-md rounded-xl shadow-md hover:shadow-xl transition-all duration-300 w-[100px] h-[100px] border border-gray-100/50 group-hover:border-blue-200">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-lg opacity-0 group-hover:opacity-20 transition-opacity" />
                        <Icon
                          icon={integration.icon}
                          className="w-8 h-8 mb-2 relative z-10 transition-transform group-hover:scale-110"
                          style={{ color: integration.icon.includes('logos:') || integration.icon.includes('simple-icons:') || integration.icon.includes('vscode-icons:') ? undefined : integration.color }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 whitespace-nowrap group-hover:text-gray-800 text-center">
                        {integration.name}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <a
            href="/integrations"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:shadow-lg transition-all hover:scale-[1.02]"
          >
            View all integrations
            <Icon icon="solar:arrow-right-bold" className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}