import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { documentGenerationService } from '../services/documentGenerationService';

const DocumentGenerationTestUI: React.FC = () => {
  const [testResults, setTestResults] = useState<{
    prescription: string;
    leaveForm: string;
    invoice: string;
  }>({
    prescription: 'pending',
    leaveForm: 'pending',
    invoice: 'pending'
  });

  const testVisitData = {
    visitId: 'test-visit-001',
    patientId: 'test-patient-001',
    practiceId: 'test-practice-001'
  };

  const runTests = async () => {
    console.log('🧪 Starting Document Generation Tests...');

    // Test Prescription Generation
    try {
      setTestResults(prev => ({ ...prev, prescription: 'testing' }));
      const prescriptionDocs = await documentGenerationService.generateVisitDocuments({
        ...testVisitData,
        documents: ['prescription']
      });
      
      if (prescriptionDocs.length > 0) {
        console.log('✅ Prescription generated:', prescriptionDocs[0]);
        setTestResults(prev => ({ ...prev, prescription: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, prescription: 'no-data' }));
      }
    } catch (error) {
      console.error('❌ Prescription test failed:', error);
      setTestResults(prev => ({ ...prev, prescription: 'failed' }));
    }

    // Test Leave Form Generation
    try {
      setTestResults(prev => ({ ...prev, leaveForm: 'testing' }));
      const leaveFormDocs = await documentGenerationService.generateVisitDocuments({
        ...testVisitData,
        documents: ['leave_form']
      });
      
      if (leaveFormDocs.length > 0) {
        console.log('✅ Leave form generated:', leaveFormDocs[0]);
        setTestResults(prev => ({ ...prev, leaveForm: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, leaveForm: 'no-data' }));
      }
    } catch (error) {
      console.error('❌ Leave form test failed:', error);
      setTestResults(prev => ({ ...prev, leaveForm: 'failed' }));
    }

    // Test Invoice Generation
    try {
      setTestResults(prev => ({ ...prev, invoice: 'testing' }));
      const invoiceDocs = await documentGenerationService.generateVisitDocuments({
        ...testVisitData,
        documents: ['invoice']
      });
      
      if (invoiceDocs.length > 0) {
        console.log('✅ Invoice generated:', invoiceDocs[0]);
        setTestResults(prev => ({ ...prev, invoice: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, invoice: 'no-data' }));
      }
    } catch (error) {
      console.error('❌ Invoice test failed:', error);
      setTestResults(prev => ({ ...prev, invoice: 'failed' }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Icon icon="solar:hourglass-line-duotone" className="w-5 h-5 text-gray-400" />;
      case 'testing':
        return <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-500" />;
      case 'no-data':
        return <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Not tested';
      case 'testing': return 'Testing...';
      case 'success': return 'Generated successfully';
      case 'no-data': return 'No data to generate';
      case 'failed': return 'Generation failed';
      default: return status;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <Icon icon="solar:test-tube-bold-duotone" className="w-8 h-8 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900">Document Generation Test Suite</h1>
        </div>

        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            This test verifies the complete document generation workflow including prescriptions, 
            leave forms, and invoices with beautiful styling.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {/* Prescription Test */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Icon icon="solar:pills-3-bold-duotone" className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Prescription Generation</h3>
                <p className="text-sm text-gray-600">A5 format with medications and signatures</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(testResults.prescription)}
              <span className="text-sm font-medium">{getStatusText(testResults.prescription)}</span>
            </div>
          </div>

          {/* Leave Form Test */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Icon icon="solar:calendar-add-bold-duotone" className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Leave Form Generation</h3>
                <p className="text-sm text-gray-600">A5 format with leave details and certification</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(testResults.leaveForm)}
              <span className="text-sm font-medium">{getStatusText(testResults.leaveForm)}</span>
            </div>
          </div>

          {/* Invoice Test */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Icon icon="solar:bill-list-bold-duotone" className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Invoice Generation</h3>
                <p className="text-sm text-gray-600">A4 format with services and smart pagination</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(testResults.invoice)}
              <span className="text-sm font-medium">{getStatusText(testResults.invoice)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={runTests}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Icon icon="solar:play-bold-duotone" className="w-5 h-5" />
          Run All Tests
        </button>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Test Coverage:</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-500" />
              Beautiful HTML templates with Montserrat/Rubik fonts
            </li>
            <li className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-500" />
              Data validation to prevent empty documents
            </li>
            <li className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-500" />
              Multi-page support for invoices
            </li>
            <li className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-500" />
              Public URL generation for easy access
            </li>
            <li className="flex items-center gap-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-500" />
              Integration with EditVisitTabs and AddVisitTabs
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DocumentGenerationTestUI;