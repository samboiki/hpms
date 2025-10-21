import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas';

interface PsemasFormPrintableProps {
  isOpen: boolean;
  onClose: () => void;
  visitData: {
    id: string;
    visit_date: string;
    patient: {
      id: string;
      first_name: string;
      last_name: string;
      date_of_birth: string;
    };
    medical_aid_details?: {
      membership_number: string;
      main_member_name: string;
      main_member_id_number: string;
      provider: string;
    };
    practice: {
      name: string;
      contact_phone: string;
      contact_email: string;
      address: string;
      city: string;
      postal_code: string;
      practice_number: string;
      logo_url?: string;
    };
    doctor: {
      full_name: string;
    };
  };
}

const PsemasFormPrintable: React.FC<PsemasFormPrintableProps> = ({
  isOpen,
  onClose,
  visitData
}) => {
  const [isGenerating, setIsGenerating] = React.useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);

    try {
      // Import jsPDF
      const jsPDF = (await import('jspdf')).default;

      // Get the form container
      const formElement = document.getElementById('psemas-form-content');
      if (!formElement) {
        throw new Error('Form element not found');
      }

      // Generate canvas from HTML
      const canvas = await html2canvas(formElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // If image is taller than page, scale it to fit
      if (imgHeight > pdfHeight) {
        const scaledHeight = pdfHeight;
        const scaledWidth = (canvas.width * pdfHeight) / canvas.height;
        pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, 0, scaledWidth, scaledHeight, '', 'FAST');
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, '', 'FAST');
      }

      // Download the PDF
      const fileName = `PSEMAS-${visitData.patient.first_name}-${visitData.patient.last_name}-${format(new Date(visitData.visit_date), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);

      toast.success('PSEMAS form downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const patientInitials = `${visitData.patient.first_name.charAt(0)}${visitData.patient.last_name.charAt(0)}`;
  const membershipNumber = visitData.medical_aid_details?.membership_number || '';
  const mainMemberName = visitData.medical_aid_details?.main_member_name || '';
  const mainMemberIdNumber = visitData.medical_aid_details?.main_member_id_number || '';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">PSEMAS Medical Aid Form</h3>
            <p className="text-blue-100 text-sm">Patient visit documentation for PSEMAS</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div
            id="psemas-form-content"
            className="bg-white mx-auto"
            style={{
              width: '210mm',
              minHeight: '297mm',
              fontFamily: 'Arial, sans-serif',
              padding: '20mm'
            }}
          >
            {/* Practice Header */}
            <div className="border-2 border-gray-800 p-4 mb-6 relative">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold uppercase text-gray-800 mb-2">
                    {visitData.practice.name}
                  </h1>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>TEL: {visitData.practice.contact_phone}</p>
                    <p>EMAIL: {visitData.practice.contact_email}</p>
                    <p>P.O.BOX {visitData.practice.postal_code}</p>
                    <p>{visitData.practice.city.toUpperCase()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">PR: {visitData.practice.practice_number}</p>
                  {mainMemberIdNumber && (
                    <p className="text-lg font-bold mt-2">{mainMemberIdNumber}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form Declaration */}
            <div className="mb-6">
              <p className="text-sm text-gray-800 mb-4">
                I, the undersigned, do hereby declare that I am currently a registered member/defendant of Psemas:
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Main Member's Surname */}
              <div className="flex items-baseline border-b border-gray-400 pb-1">
                <label className="text-sm text-gray-700 w-48 flex-shrink-0">
                  MAIN MEMBER'S SURNAME
                </label>
                <div className="flex-1 border-dotted border-b border-gray-400 relative">
                  <span className="text-base font-medium text-gray-800 pl-2">
                    {mainMemberName.split(' ')[mainMemberName.split(' ').length - 1] || visitData.patient.last_name}
                  </span>
                  <span className="absolute right-0 text-sm text-gray-600">INITIALS</span>
                </div>
              </div>

              {/* Member Number */}
              <div className="flex items-baseline border-b border-gray-400 pb-1">
                <label className="text-sm text-gray-700 w-48 flex-shrink-0">
                  MEMBER NUMBER
                </label>
                <div className="flex-1 border-dotted border-b border-gray-400 relative">
                  <span className="text-base font-medium text-gray-800 pl-2">
                    {membershipNumber}
                  </span>
                  <span className="absolute right-0 text-sm text-gray-600">MINISTRY</span>
                </div>
              </div>

              {/* Patient Date of Birth */}
              <div className="flex items-baseline border-b border-gray-400 pb-1">
                <label className="text-sm text-gray-700 w-48 flex-shrink-0">
                  PATIENT DATE OF BIRTH
                </label>
                <div className="flex-1 border-dotted border-b border-gray-400 relative">
                  <span className="text-base font-medium text-gray-800 pl-2">
                    {format(new Date(visitData.patient.date_of_birth), 'dd/MM/yyyy')}
                  </span>
                  <span className="absolute right-0 text-sm text-gray-600">PATIENT'S NAME</span>
                </div>
              </div>

              {/* Confirmation Text */}
              <div className="mt-6 mb-4">
                <p className="text-sm text-gray-800">
                  I, here confirm that treatment/medical service was provided by the above medical practitioner for the above mentioned patient.
                </p>
              </div>

              {/* Signature Line - Member/Dependent/Guardian */}
              <div className="border-b border-gray-800 pb-1 mb-6">
                <label className="text-sm text-gray-700 uppercase">
                  Signature of Member/Dependent/Guardian
                </label>
                <div className="h-16 flex items-end">
                  <span className="text-xs text-gray-500">Patient/Guardian signature required</span>
                </div>
              </div>

              {/* Doctor Confirmation */}
              <div className="mt-8 mb-4">
                <p className="text-sm text-gray-800">
                  I, the undersigned hereby confirm that I have seen and provided treatment/medical service to the above patient, and verify of the patient on{' '}
                  <span className="font-semibold underline">{format(new Date(visitData.visit_date), 'dd/MM/yyyy')}</span>
                </p>
              </div>

              {/* Signature Line - Doctor */}
              <div className="border-b border-gray-800 pb-1">
                <label className="text-sm text-gray-700 uppercase">
                  Signature of Doctor
                </label>
                <div className="h-16 flex items-end pb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {visitData.doctor.full_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer - Practice Stamp Area */}
            <div className="mt-8 border-t border-gray-300 pt-4">
              <p className="text-xs text-gray-500 text-center">
                This form must be stamped with the practice stamp and signed by the attending physician
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-6 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isGenerating}
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            disabled={isGenerating}
          >
            <Printer className="w-4 h-4" />
            Print Form
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #psemas-form-content,
          #psemas-form-content * {
            visibility: visible;
          }
          #psemas-form-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            background: white;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default PsemasFormPrintable;
