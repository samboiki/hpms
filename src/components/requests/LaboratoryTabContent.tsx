import React, { useState, useEffect } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TestTube, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Link,
  Upload,
  Bot,
  FileDown,
  Edit3,
  Trash2,
  X,
  Image,
  File
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { RECORD_LINK_SECONDS, bucketOf } from '../../services/recordFiles';
import FileUploadComponent from '../uploads/FileUploadComponent';
import FileDisplayComponent from '../uploads/FileDisplayComponent';
import LabRequestForm from './LabRequestForm';

interface LaboratoryTabContentProps {
  patientId: string;
  visitId: string;
}

// lab_requests has no test_name, test_category, priority, clinical_indication or requested_by
// column (see database.types.ts), so rows arrive without them; calling string methods on them
// crashed this tab as soon as a visit had a lab request
interface LabRequest {
  id: string;
  test_name?: string;
  test_category?: string;
  priority?: string;
  status: string;
  request_date: string;
  clinical_indication?: string;
  result_file_id?: string;
  result_text_ids?: string[];
  requested_by?: string;
}

const LaboratoryTabContent: React.FC<LaboratoryTabContentProps> = ({
  patientId,
  visitId
}) => {
  const [activeSection, setActiveSection] = useState<'files' | 'requests'>('requests');
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LabRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [fileCount, setFileCount] = useState(0);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const [extractionType, setExtractionType] = useState<'request' | 'result'>('request');
  const [currentRequestId, setCurrentRequestId] = useState<string>('');

  // Fetch lab requests and file count for this visit
  useEffect(() => {
    fetchLabRequests();
    fetchFileCount();
  }, [visitId]);

  // Fetch file count for badge
  const fetchFileCount = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_laboratory' as any)
        .select('id')
        .eq('patient_id', patientId)
        .eq('visit_id', visitId);

      if (error) {
        console.error('Error fetching lab file count:', error);
        return;
      }

      setFileCount(data?.length || 0);
    } catch (error) {
      console.error('Error in fetchFileCount:', error);
    }
  };

  const fetchLabRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lab_requests')
        .select('*')
        .eq('visit_id', visitId)
        .order('request_date', { ascending: false });

      if (error) {
        console.error('Error fetching lab requests:', error);
        toast.error('Could not load lab requests. Check your connection and try again.');
        return;
      }

      setLabRequests(data || []);
    } catch (error) {
      console.error('Error in fetchLabRequests:', error);
      toast.error('Could not load lab requests. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'routine': return 'bg-blue-100 text-blue-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      case 'stat': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = labRequests.filter(request => {
    const matchesSearch = (request.test_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (request.clinical_indication ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleRequestSuccess = () => {
    setShowRequestForm(false);
    setEditingRequest(null);
    fetchLabRequests();
  };

  // AI extraction for lab request forms
  const handleAIExtractRequest = async (requestId: string) => {
    try {
      console.log('🤖 Starting AI extraction for lab request:', requestId);
      
      // 1. Get the uploaded files from patient_laboratory table linked to this request
      const { data: labFiles, error: filesError } = await supabase
        .from('patient_laboratory' as any)
        .select('*')
        .eq('visit_id', visitId)
        .eq('patient_id', patientId);

      if (filesError || !labFiles || labFiles.length === 0) {
        console.error('❌ No lab files found for extraction:', filesError);
        toast.error('No lab request files found to extract from. Please upload a lab request form first.');
        return;
      }

      // Find files suitable for AI extraction (images and PDFs)
      const extractableFiles = labFiles
        .filter(file => file.mime_type && [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'
        ].includes(file.mime_type))
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      if (extractableFiles.length === 0) {
        toast.error('No AI-compatible files found for extraction. Please upload an image (JPG, PNG, GIF, WebP) or PDF for AI processing.');
        return;
      }

      let selectedFile;
      
      // If multiple files, let user choose via modal
      if (extractableFiles.length > 1) {
        setAvailableFiles(extractableFiles);
        setExtractionType('request');
        setCurrentRequestId(requestId);
        setShowFileSelector(true);
        return;
      } else {
        selectedFile = extractableFiles[0];
      }

      await performRequestExtraction(requestId, selectedFile);
      
    } catch (error) {
      console.error('❌ AI extraction failed:', error);
      toast.error('AI extraction failed. Please try again.');
    }
  };

  // Perform the actual extraction for lab requests
  const performRequestExtraction = async (requestId: string, selectedFile: any) => {
    try {
      console.log('🔍 Selected file for extraction:', selectedFile.original_name, 'Type:', selectedFile.mime_type);

      // Check if file type is supported for AI extraction
      const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const supportedPdfTypes = ['application/pdf'];
      const allSupportedTypes = [...supportedImageTypes, ...supportedPdfTypes];

      if (!allSupportedTypes.includes(selectedFile.mime_type)) {
        console.error('❌ Unsupported file type for AI extraction:', selectedFile.mime_type);
        toast.error(`File type "${selectedFile.mime_type}" is not supported for AI extraction. Please upload JPG, PNG, GIF, WebP, or PDF files.`);
        return;
      }

      // 2. Get signed URL for the file (from the bucket its row names; short-lived, for this reading only)
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucketOf(selectedFile.storage_path, selectedFile.storage_bucket))
        .createSignedUrl(selectedFile.storage_path, RECORD_LINK_SECONDS);

      if (urlError || !urlData?.signedUrl) {
        console.error('❌ Failed to get file URL:', urlError);
        toast.error('Failed to access the uploaded file. Please try again.');
        return;
      }

      // 3. Call the extract-text edge function
      console.log('🚀 Calling AI extraction service...');
      console.log('🔍 File details being sent:', {
        originalName: selectedFile.original_name,
        mimeType: selectedFile.mime_type,
        fileSize: selectedFile.file_size,
        urlLength: urlData.signedUrl.length,
        urlStart: urlData.signedUrl.substring(0, 100) + '...'
      });

      // Ensure MIME type is properly formatted for OpenAI
      let processedMimeType = selectedFile.mime_type;
      if (selectedFile.mime_type === 'image/jpg') {
        processedMimeType = 'image/jpeg'; // OpenAI expects 'jpeg' not 'jpg'
      }
      
      console.log('🔧 Processed MIME type for OpenAI:', processedMimeType);
      
      const { data: extractionData, error: extractionError } = await supabase.functions
        .invoke('extract-text', {
          body: { 
            imageUrl: urlData.signedUrl,
            fileType: processedMimeType,
            extractionType: 'request' // Specify we're extracting lab requests, not results
          }
        });

      if (extractionError) {
        console.error('❌ AI extraction service error:', extractionError);
        console.error('❌ Full error details:', extractionData);
        
        // Handle specific error types
        if (extractionData?.error) {
          // Use the error message from the edge function
          toast.error(`AI Extraction Failed: ${extractionData.message || extractionData.error}`);
        } else if (extractionError.message && extractionError.message.includes('PDF processing')) {
          toast.error('PDF files are not yet supported for AI extraction. Please convert your PDF to JPG or PNG format and upload again for AI processing.');
        } else {
          toast.error('AI extraction service failed. Please try again.');
        }
        return;
      }

      if (!extractionData?.results || extractionData.results.length === 0) {
        console.log('⚠️ No lab data extracted from image');
        toast.error('No lab request data could be extracted from the file. Please ensure the image is clear and contains lab request information.');
        return;
      }

      // 4. Parse the extracted results and update the lab request
      const extractedResults = extractionData.results;
      console.log('✅ Extracted lab data:', extractedResults);

      // Use the first result or combine multiple test names
      const testNames = extractedResults.map(r => r.testName).filter(Boolean);
      const updatedTestName = testNames.length > 0 ? testNames.join(', ') : 'Extracted Test';

      // Update the lab request with extracted information
      const { error: updateError } = await supabase
        .from('lab_requests')
        .update({
          test_name: updatedTestName,
          test_category: 'extracted',
          clinical_indication: `AI Extracted from ${selectedFile.original_name}`,
          status: 'pending',
          extracted_request_data: extractedResults,
          ai_processing_status: 'completed'
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('❌ Failed to update lab request:', updateError);
        toast.error('Failed to update lab request with extracted data.');
        return;
      }

      console.log('✅ Lab request updated with AI extracted data');
      toast.success(`Lab request updated: ${updatedTestName} (${extractedResults.length} tests found)`);
      
      // Refresh the lab requests list
      fetchLabRequests();
      
    } catch (error) {
      console.error('❌ AI extraction failed:', error);
      toast.error('AI extraction failed. Please try again.');
    }
  };

  // AI extraction for lab results
  const handleAIExtractResults = async (requestId: string) => {
    try {
      console.log('🤖 Starting AI extraction for lab results:', requestId);
      
      // 1. Get the uploaded result files from patient_laboratory table
      const { data: labFiles, error: filesError } = await supabase
        .from('patient_laboratory' as any)
        .select('*')
        .eq('visit_id', visitId)
        .eq('patient_id', patientId);

      if (filesError || !labFiles || labFiles.length === 0) {
        console.error('❌ No lab files found for results extraction:', filesError);
        toast.error('No lab result files found to extract from. Please upload lab result documents first.');
        return;
      }

      // Find files suitable for results extraction (images and PDFs)
      const resultFiles = labFiles
        .filter(file => file.mime_type && [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'
        ].includes(file.mime_type))
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      if (resultFiles.length === 0) {
        toast.error('No AI-compatible files found for extraction. Please upload an image (JPG, PNG, GIF, WebP) or PDF for AI processing.');
        return;
      }

      let selectedResultFile;
      
      // If multiple files, let user choose via modal
      if (resultFiles.length > 1) {
        setAvailableFiles(resultFiles);
        setExtractionType('result');
        setCurrentRequestId(requestId);
        setShowFileSelector(true);
        return;
      } else {
        selectedResultFile = resultFiles[0];
      }
      await performResultExtraction(requestId, selectedResultFile);
      
    } catch (error) {
      console.error('❌ AI results extraction failed:', error);
      toast.error('AI results extraction failed. Please try again.');
    }
  };

  // Perform the actual extraction for lab results
  const performResultExtraction = async (requestId: string, selectedResultFile: any) => {
    try {
      console.log('🔍 Selected result file for extraction:', selectedResultFile.original_name, 'Type:', selectedResultFile.mime_type);

      // Check if file type is supported for AI extraction
      const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const supportedPdfTypes = ['application/pdf'];
      const allSupportedTypes = [...supportedImageTypes, ...supportedPdfTypes];

      if (!allSupportedTypes.includes(selectedResultFile.mime_type)) {
        console.error('❌ Unsupported file type for AI extraction:', selectedResultFile.mime_type);
        toast.error(`File type "${selectedResultFile.mime_type}" is not supported for AI extraction. Please upload JPG, PNG, GIF, WebP, or PDF files.`);
        return;
      }

      // 2. Get signed URL for the file (from the bucket its row names; short-lived, for this reading only)
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucketOf(selectedResultFile.storage_path, selectedResultFile.storage_bucket))
        .createSignedUrl(selectedResultFile.storage_path, RECORD_LINK_SECONDS);

      if (urlError || !urlData?.signedUrl) {
        console.error('❌ Failed to get file URL:', urlError);
        toast.error('Failed to access the uploaded file. Please try again.');
        return;
      }

      // 3. Call the extract-text edge function
      console.log('🚀 Calling AI extraction service for results...');
      
      // Ensure MIME type is properly formatted for OpenAI
      let processedMimeType = selectedResultFile.mime_type;
      if (selectedResultFile.mime_type === 'image/jpg') {
        processedMimeType = 'image/jpeg'; // OpenAI expects 'jpeg' not 'jpg'
      }
      
      console.log('🔧 Processed MIME type for OpenAI:', processedMimeType);
      
      const { data: extractionData, error: extractionError } = await supabase.functions
        .invoke('extract-text', {
          body: { 
            imageUrl: urlData.signedUrl,
            fileType: processedMimeType,
            extractionType: 'results' // Specify we're extracting lab results with values
          }
        });

      if (extractionError) {
        console.error('❌ AI extraction service error:', extractionError);
        console.error('❌ Full error details:', extractionData);
        
        // Handle specific error types
        if (extractionData?.error) {
          // Use the error message from the edge function
          toast.error(`AI Extraction Failed: ${extractionData.message || extractionData.error}`);
        } else if (extractionError.message && extractionError.message.includes('PDF processing')) {
          toast.error('PDF files are not yet supported for AI extraction. Please convert your PDF to JPG or PNG format and upload again for AI processing.');
        } else {
          toast.error('AI extraction service failed. Please try again.');
        }
        return;
      }

      if (!extractionData?.results || extractionData.results.length === 0) {
        console.log('⚠️ No lab results extracted from file');
        toast.error('No lab result data could be extracted from the file. Please ensure the image is clear and contains lab test results.');
        return;
      }

      // 4. Parse the extracted results and update the lab request
      const extractedResults = extractionData.results;
      console.log('✅ Extracted lab results:', extractedResults);

      // Create lab_results entries for each extracted test. Uses the columns lab_results actually has
      // (same as manual entry in EnterLabResults); the old payload wrote patient_id, visit_id,
      // result_value, unit, abnormal_flag, performed_at and result_date, which don't exist, so every
      // AI-extracted save failed. Results link to the patient and visit through the lab request.
      const labResultsToInsert = extractedResults.map(result => ({
        lab_request_id: requestId,
        test_name: result.testName || 'Unknown Test',
        test_value: result.value || '',
        test_unit: result.unit || null,
        reference_range: result.referenceRange || null
      }));

      // Insert the lab results
      const { data: insertedResults, error: insertError } = await supabase
        .from('lab_results')
        .insert(labResultsToInsert)
        .select();

      if (insertError) {
        console.error('❌ Failed to insert lab results:', insertError);
        toast.error('Failed to save extracted lab results to database.');
        return;
      }

      // 5. Mark the lab request completed. lab_requests only has `status` of the fields this used to
      // write (extracted_results_data, ai_processing_status, clinical_indication, completed_at don't exist).
      const { error: updateError } = await supabase
        .from('lab_requests')
        .update({ status: 'completed' })
        .eq('id', requestId);

      if (updateError) {
        console.error('❌ Failed to update lab request:', updateError);
        toast.error('Failed to update lab request with extracted results.');
        return;
      }

      console.log('✅ Lab request updated with AI extracted results');
      // Values are read automatically and can be misread, so ask for a check against the report
      toast.success(`Saved ${extractedResults.length} lab results from ${selectedResultFile.original_name}. Please check them against the original.`);
      
      // Refresh the lab requests list
      fetchLabRequests();
      
    } catch (error) {
      console.error('❌ AI results extraction failed:', error);
      toast.error('AI results extraction failed. Please try again.');
    }
  };

  // Delete lab request
  const handleDeleteRequest = async (requestId: string) => {
    try {
      console.log('🗑️ Deleting lab request:', requestId);
      
      const { error } = await supabase
        .from('lab_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('❌ Error deleting lab request:', error);
        throw new Error(error.message);
      }

      console.log('✅ Lab request deleted successfully');
      toast.success('Lab request deleted');
      fetchLabRequests(); // Refresh the list
      
    } catch (error) {
      console.error('💥 Error deleting lab request:', error);
      toast.error(`Failed to delete lab request: ${error instanceof Error ? plainWords(error.message) : 'Unknown error'}`);
    }
  };

  const sections = [
    { id: 'requests' as const, label: 'Lab Requests', icon: Calendar, count: labRequests.length },
    { id: 'files' as const, label: 'File Uploads', icon: FileText, count: fileCount }
  ];

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {sections.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveSection(section.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-white text-green-700 shadow-sm' 
                    : 'text-gray-600 hover:text-green-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
                {section.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {section.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeSection === 'requests' && (
          <button
            type="button"
            onClick={() => {
              console.log('🔘 Laboratory Tab - New Lab Request button clicked');
              setShowRequestForm(true);
              setEditingRequest(null);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Lab Request
          </button>
        )}
      </div>

      {/* Content Sections */}
      <AnimatePresence mode="wait">
        {/* Lab Requests Section */}
        {activeSection === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Search and Filter */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search lab requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-[150px]"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Requests List */}
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  {labRequests.length > 0 ? 'No lab requests match your search' : 'No lab requests yet'}
                </h4>
                <p className="text-gray-500">
                  {labRequests.length > 0
                    ? 'Clear the search or choose All Status to see every request.'
                    : "Use 'New Lab Request' to add one."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Test Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Request Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Request Form</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Results</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-gray-900">{request.test_name || '—'}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs" title={request.clinical_indication}>
                              {request.clinical_indication}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {request.test_category
                              ? request.test_category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                              : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {request.priority ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                              {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(request.request_date), 'dd MMM yyyy')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔘 Upload request form for:', request.id);
                                setActiveSection('files');
                              }}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors flex items-center gap-1"
                              title="Upload lab request form"
                            >
                              <Upload className="w-3 h-3" />
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAIExtractRequest(request.id);
                              }}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors flex items-center gap-1"
                              title="AI Extract from uploaded request form"
                            >
                              <Bot className="w-3 h-3" />
                              Extract Request
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔘 Upload results for:', request.id);
                                setActiveSection('files');
                              }}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors flex items-center gap-1"
                              title="Upload lab results"
                            >
                              <FileDown className="w-3 h-3" />
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAIExtractResults(request.id);
                              }}
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded transition-colors flex items-center gap-1"
                              title="AI Extract from uploaded result files"
                            >
                              <Bot className="w-3 h-3" />
                              Extract Results
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingRequest(request);
                                setShowRequestForm(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              aria-label="Edit lab request"
                              title="Edit request"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (window.confirm(`Delete the lab request${request.test_name ? ` for ${request.test_name}` : ''} from ${format(new Date(request.request_date), 'dd MMM yyyy')}? This cannot be undone.`)) {
                                  handleDeleteRequest(request.id);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              aria-label="Delete lab request"
                              title="Delete request"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}


        {/* File Uploads Section */}
        {activeSection === 'files' && (
          <motion.div
            key="files"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <FileUploadComponent
              patientId={patientId}
              visitId={visitId}
              uploadType="laboratory"
              maxFileSize={50 * 1024 * 1024} // 50MB
              acceptedTypes={[
                // Only image formats supported by OpenAI Vision API for AI extraction
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                // Keep other formats for manual processing
                'application/pdf',
                'text/plain',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              ]}
              onUploadSuccess={(file) => {
                console.log('✅ Laboratory file uploaded:', file);
                fetchFileCount(); // Refresh file count badge
                
                // Auto-switch back to requests tab after upload for easy AI extraction
                setTimeout(() => {
                  setActiveSection('requests');
                  toast.success(`File "${file.originalName}" uploaded. You can now use AI extraction in the Lab Requests tab.`);
                }, 1000);
              }}
              onUploadError={(error) => {
                console.error('❌ Laboratory upload error:', error);
                toast.error(`Upload failed: ${error}`);
              }}
            />
            
            <FileDisplayComponent
              patientId={patientId}
              visitId={visitId}
              uploadType="laboratory"
              onFileDelete={(fileId) => {
                console.log('🗑️ Laboratory file deleted:', fileId);
                fetchFileCount(); // Refresh file count badge
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Form Modal */}
      <AnimatePresence>
        {showRequestForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRequestForm(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <LabRequestForm
                key={`lab-request-form-${Date.now()}`}
                patientId={patientId}
                visitId={visitId}
                editRequest={editingRequest}
                onSuccess={handleRequestSuccess}
                onCancel={() => setShowRequestForm(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Selector Modal */}
      <AnimatePresence>
        {showFileSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowFileSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Select File for AI Extraction
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFileSelector(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close file list"
                  title="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Multiple files found. Please select which file you want to use for {extractionType === 'request' ? 'lab request' : 'lab results'} extraction:
              </p>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {availableFiles.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={async () => {
                      setShowFileSelector(false);
                      if (extractionType === 'request') {
                        await performRequestExtraction(currentRequestId, file);
                      } else {
                        await performResultExtraction(currentRequestId, file);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{file.original_name}</p>
                      <p className="text-sm text-gray-500">
                        {file.mime_type}{file.uploaded_at ? ` • Uploaded ${format(new Date(file.uploaded_at), 'dd MMM yyyy')}` : ''}
                      </p>
                      {file.description && (
                        <p className="text-xs text-gray-400 mt-1">{file.description}</p>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        {file.mime_type?.startsWith('image/') ? (
                          <Image className="w-5 h-5 text-blue-600" />
                        ) : file.mime_type === 'application/pdf' ? (
                          <FileText className="w-5 h-5 text-blue-600" />
                        ) : (
                          <File className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowFileSelector(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LaboratoryTabContent;