export interface ProfessionalEmailTemplate {
  id: string;
  name: string;
  category: 'appointment' | 'invoice' | 'follow-up' | 'welcome' | 'reminder' | 'marketing';
  subject: string;
  body: string;
  variables: string[];
  description: string;
  htmlTemplate: string;
}

export const professionalEmailTemplates: ProfessionalEmailTemplate[] = [
  {
    id: 'appointment-reminder-24h',
    name: '24 Hour Appointment Reminder',
    category: 'appointment',
    subject: 'Reminder: Your appointment tomorrow at {{appointmentTime}} - {{practiceName}}',
    body: `Dear {{patientName}},

This is a friendly reminder about your appointment scheduled for tomorrow.

Please remember to:
• Arrive 15 minutes early for check-in
• Bring a valid ID and medical aid card (if applicable)
• Bring any previous medical records or test results
• List of current medications you are taking

If you need to reschedule or cancel, please contact us as soon as possible.

We look forward to seeing you tomorrow!`,
    variables: ['{{patientName}}', '{{appointmentDate}}', '{{appointmentTime}}', '{{doctorName}}', '{{practiceName}}', '{{practicePhone}}', '{{practiceAddress}}'],
    description: 'Professional appointment reminder sent 24 hours before the appointment',
    htmlTemplate: 'appointment-reminder'
  },
  
  {
    id: 'appointment-confirmation',
    name: 'Appointment Confirmation',
    category: 'appointment',
    subject: 'Appointment Confirmed - {{appointmentDate}} at {{appointmentTime}}',
    body: `Dear {{patientName}},

Your appointment has been successfully confirmed with the following details:

We're looking forward to providing you with exceptional healthcare service.

Important reminders:
• Please arrive 15 minutes before your scheduled time
• Bring your ID document and medical aid card
• If you're a new patient, please complete our online forms beforehand
• Contact us immediately if you need to make any changes

Thank you for choosing {{practiceName}} for your healthcare needs.`,
    variables: ['{{patientName}}', '{{appointmentDate}}', '{{appointmentTime}}', '{{doctorName}}', '{{practiceName}}', '{{practicePhone}}', '{{practiceWebsite}}'],
    description: 'Confirmation email sent immediately after appointment booking',
    htmlTemplate: 'appointment-confirmation'
  },

  {
    id: 'invoice-delivery',
    name: 'Invoice Delivery',
    category: 'invoice',
    subject: 'Invoice {{invoiceNumber}} - {{practiceName}}',
    body: `Dear {{patientName}},

Thank you for visiting {{practiceName}}. We hope you had a positive experience with our healthcare services.

Your invoice details are provided below. Payment can be made conveniently through our secure online portal or at our reception.

Payment options:
• Online payment via our secure portal (recommended)
• Bank transfer (details provided in invoice)
• Card payment at reception
• Cash payment at reception

If you have any questions about your invoice or our services, please don't hesitate to contact our billing department.

Thank you for choosing {{practiceName}}.`,
    variables: ['{{patientName}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{visitDate}}', '{{paymentLink}}', '{{practiceName}}', '{{practicePhone}}'],
    description: 'Professional invoice delivery with payment instructions',
    htmlTemplate: 'invoice-delivery'
  },

  {
    id: 'payment-reminder',
    name: 'Payment Reminder',
    category: 'reminder',
    subject: 'Payment Reminder - Invoice {{invoiceNumber}} Due {{dueDate}}',
    body: `Dear {{patientName}},

This is a friendly reminder that your invoice payment is due. We want to help you stay current with your account.

We understand that sometimes payments can be overlooked, and we're here to make the process as convenient as possible for you.

Payment options available:
• Quick online payment (takes less than 2 minutes)
• Phone payment by calling our billing department
• In-person payment at our reception

If you're experiencing financial difficulties, please contact our billing department to discuss payment arrangement options. We're committed to working with you to find a solution.

Thank you for your prompt attention to this matter.`,
    variables: ['{{patientName}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{paymentLink}}', '{{practiceName}}', '{{practicePhone}}'],
    description: 'Gentle payment reminder with multiple payment options',
    htmlTemplate: 'payment-reminder'
  },

  {
    id: 'welcome-new-patient',
    name: 'Welcome New Patient',
    category: 'welcome',
    subject: 'Welcome to {{practiceName}} - Your Healthcare Journey Begins Here',
    body: `Dear {{patientName}},

Welcome to {{practiceName}}! We're thrilled to have you as a new patient and look forward to being your trusted healthcare partner.

To help you get started, we've prepared everything you need:

✓ Your patient portal account is ready for access
✓ Online appointment booking is available 24/7
✓ Digital health records for easy access to your medical history
✓ Secure messaging with your healthcare team

Getting the most from your patient portal:
• View and download your medical records
• Schedule appointments at your convenience
• Access test results as soon as they're available
• Communicate securely with your healthcare team
• Update your personal and insurance information

Our commitment to you is to provide exceptional healthcare with a personal touch. If you have any questions or need assistance with anything, our friendly staff is always here to help.

Welcome to the family!`,
    variables: ['{{patientName}}', '{{practiceName}}', '{{portalLink}}', '{{practicePhone}}', '{{practiceWebsite}}', '{{doctorName}}'],
    description: 'Warm welcome email for new patients with portal setup instructions',
    htmlTemplate: 'welcome-new-patient'
  },

  {
    id: 'post-visit-followup',
    name: 'Post-Visit Follow-up',
    category: 'follow-up',
    subject: 'Thank you for your visit - Follow-up care instructions',
    body: `Dear {{patientName}},

Thank you for visiting {{practiceName}} on {{visitDate}}. We hope you had a positive experience with Dr. {{doctorName}} and our healthcare team.

Your health and recovery are our top priorities. Please follow the care instructions provided during your visit:

{{careInstructions}}

Important reminders:
• Take all medications as prescribed
• Follow the recommended activity restrictions
• Watch for any warning signs discussed during your visit
• Keep all follow-up appointments

If you experience any concerning symptoms or have questions about your care, please don't hesitate to contact us immediately. Our medical team is here to support your recovery.

We're committed to your health and well-being. Thank you for trusting us with your healthcare.`,
    variables: ['{{patientName}}', '{{visitDate}}', '{{doctorName}}', '{{careInstructions}}', '{{followUpInstructions}}', '{{nextAppointment}}', '{{practiceName}}', '{{practicePhone}}'],
    description: 'Comprehensive post-visit follow-up with care instructions',
    htmlTemplate: 'post-visit-followup'
  },

  {
    id: 'birthday-greeting',
    name: 'Birthday Greeting with Health Check Reminder',
    category: 'marketing',
    subject: '🎉 Happy Birthday {{patientName}}! Special birthday offer inside',
    body: `Dear {{patientName}},

Happy Birthday! 🎂

On this special day, the entire team at {{practiceName}} wants to wish you a year filled with good health, happiness, and wonderful memories.

As a birthday gift from us to you, we're offering a 15% discount on your next preventive health screening. Regular health check-ups are one of the best gifts you can give yourself!

Your birthday offer includes:
• 15% off comprehensive health screening
• Complimentary consultation with our wellness team
• Priority booking for the next 30 days
• Free health and wellness resource pack

This is also a perfect time to schedule your annual check-up if you haven't already this year. Prevention is always better than cure, and we're here to help you maintain optimal health.

To schedule your birthday health check, simply call us or use your patient portal. Mention "Birthday2024" to receive your special discount.

Wishing you the happiest of birthdays and a healthy year ahead!`,
    variables: ['{{patientName}}', '{{practiceName}}', '{{practicePhone}}', '{{practiceWebsite}}', '{{portalLink}}'],
    description: 'Birthday greeting with health screening promotion',
    htmlTemplate: 'birthday-greeting'
  },

  {
    id: 'health-screening-reminder',
    name: 'Health Screening Reminder',
    category: 'reminder',
    subject: 'Time for your health screening - {{practiceName}}',
    body: `Dear {{patientName}},

Your health is important to us, and we want to help you stay on top of your preventive care.

Based on your age ({{patientAge}}) and medical history, it's time for your routine health screening. Regular screenings are crucial for early detection and prevention of health issues.

Recommended screenings for you:
{{recommendedScreenings}}

Why regular screenings matter:
• Early detection leads to better treatment outcomes
• Prevention is more cost-effective than treatment
• Peace of mind knowing your health status
• Opportunity to discuss any health concerns with your doctor

We've made scheduling easy for you:
• Book online through your patient portal (available 24/7)
• Call our friendly reception team
• Use our new mobile app for instant booking

Many of these screenings are covered by medical aid, and we'll verify your benefits before your appointment.

Don't wait – your future self will thank you for taking this important step today.`,
    variables: ['{{patientName}}', '{{patientAge}}', '{{recommendedScreenings}}', '{{lastScreeningDate}}', '{{practiceName}}', '{{practicePhone}}', '{{portalLink}}'],
    description: 'Personalized health screening reminders based on patient age and history',
    htmlTemplate: 'health-screening-reminder'
  },

  {
    id: 'test-results-ready',
    name: 'Test Results Available',
    category: 'follow-up',
    subject: 'Your test results are ready - {{practiceName}}',
    body: `Dear {{patientName}},

Your recent test results from your visit on {{visitDate}} are now available in your patient portal.

What's available:
• Complete test results with reference ranges
• Summary and interpretation by Dr. {{doctorName}}
• Recommendations for next steps (if any)
• Option to schedule a follow-up consultation

How to access your results:
1. Log into your patient portal using the link below
2. Navigate to "Test Results" section
3. Click on the most recent results to view details

If your results require follow-up care or if you have any questions, Dr. {{doctorName}} or our medical team will contact you directly. For routine results, you can review them at your convenience through the portal.

We believe in keeping you informed about your health every step of the way. If you have any questions about your results, please don't hesitate to contact us.

Taking charge of your health information empowers you to make informed decisions about your care.`,
    variables: ['{{patientName}}', '{{visitDate}}', '{{doctorName}}', '{{testType}}', '{{portalLink}}', '{{practiceName}}', '{{practicePhone}}'],
    description: 'Professional notification when test results are available',
    htmlTemplate: 'test-results-ready'
  }
];

export const getTemplateByCategory = (category: string) => {
  return professionalEmailTemplates.filter(template => template.category === category);
};

export const getTemplateById = (id: string) => {
  return professionalEmailTemplates.find(template => template.id === id);
};