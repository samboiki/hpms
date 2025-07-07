import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  AlertTriangle,
  Eye,
  Link,
  ImageIcon,
  Upload
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FileUploadComponent from '../uploads/FileUploadComponent';
import FileDisplayComponent from '../uploads/FileDisplayComponent';
import ImagingRequestForm from './ImagingRequestForm';

interface ImagingTabContentProps {
  patientId: string;
  visitId: string;
}

interface ImagingRequest {
  id: string;
  imaging_type: string;
  body_part: string;
  view_position?: string;
  contrast_required: boolean;
  priority: string;
  status: string;
  request_date: string;
  clinical_indication: string;
  clinical_history?: string;
  facility_name?: string;
  result_file_ids?: string[];
  radiologist_name?: string;
  report_text?: string;
  requested_by: string;
}

const ImagingTabContent: React.FC<ImagingTabContentProps> = ({
  patientId,
  visitId
}) => {
  const [activeSection, setActiveSection] = useState<'files' | 'requests'>('requests');
  const [imagingRequests, setImagingRequests] = useState<ImagingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ImagingRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [fileCount, setFileCount] = useState(0);

  // Fetch imaging requests and file count for this visit
  useEffect(() => {
    fetchImagingRequests();
    fetchFileCount();
  }, [visitId]);

  // Fetch file count for badge
  const fetchFileCount = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_imaging' as any)
        .select('id')
        .eq('patient_id', patientId)
        .eq('visit_id', visitId);

      if (error) {
        console.error('Error fetching imaging file count:', error);
        return;
      }

      setFileCount(data?.length || 0);
    } catch (error) {
      console.error('Error in fetchFileCount:', error);
    }
  };

  const fetchImagingRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('imaging_requests' as any)
        .select('*')
        .eq('visit_id', visitId)
        .order('request_date', { ascending: false });

      if (error) {
        console.error('Error fetching imaging requests:', error);
        return;
      }

      setImagingRequests((data as unknown as ImagingRequest[]) || []);
    } catch (error) {
      console.error('Error in fetchImagingRequests:', error);
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

  const getImagingTypeLabel = (type: string) => {
    const typeLabels: { [key: string]: string } = {
      'x_ray': 'X-Ray',
      'ct_scan': 'CT Scan',
      'mri': 'MRI',
      'ultrasound': 'Ultrasound',
      'mammography': 'Mammography',
      'nuclear_medicine': 'Nuclear Medicine',
      'dental_x_ray': 'Dental X-Ray',
      'panoramic_x_ray': 'Panoramic X-Ray',
      'cbct': 'CBCT',
      'other': 'Other'
    };
    return typeLabels[type] || type;
  };

  const filteredRequests = imagingRequests.filter(request => {
    const matchesSearch = request.body_part.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.clinical_indication.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getImagingTypeLabel(request.imaging_type).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleRequestSuccess = () => {
    setShowRequestForm(false);
    setEditingRequest(null);
    fetchImagingRequests();
  };

  const sections = [
    { id: 'requests' as const, label: 'Imaging Requests', icon: Calendar, count: imagingRequests.length },
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
                  console.log(`🔘 Imaging Tab - ${section.label} section clicked`);
                  setActiveSection(section.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-white text-purple-700 shadow-sm' 
                    : 'text-gray-600 hover:text-purple-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
                {section.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'
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
              console.log('🔘 Imaging Tab - New Imaging Request button clicked');
              setShowRequestForm(true);
              setEditingRequest(null);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Imaging Request
          </button>
        )}
      </div>

      {/* Content Sections */}
      <AnimatePresence mode="wait">
        {/* Imaging Requests Section */}
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
                  placeholder="Search imaging requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-w-[150px]"
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No imaging requests yet</h4>
                <p className="text-gray-500">Create imaging requests to track studies ordered for this patient</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {getImagingTypeLabel(request.imaging_type)} - {request.body_part}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                            {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                          </span>
                        </div>
                        
                        {request.view_position && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>View/Position:</strong> {request.view_position}
                          </p>
                        )}
                        
                        <p className="text-gray-600 mb-3">{request.clinical_indication}</p>
                        
                        {request.clinical_history && (
                          <p className="text-sm text-gray-500 mb-3">
                            <strong>Clinical History:</strong> {request.clinical_history}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(request.request_date).toLocaleDateString()}
                          </div>
                          {request.contrast_required && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              <span className="text-orange-600">Contrast Required</span>
                            </div>
                          )}
                          {request.facility_name && (
                            <div className="flex items-center gap-1">
                              <ImageIcon className="w-4 h-4" />
                              {request.facility_name}
                            </div>
                          )}
                        </div>

                        {/* Results and Report */}
                        {(request.result_file_ids && request.result_file_ids.length > 0) || request.report_text && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-sm text-purple-600">
                              <Link className="w-4 h-4" />
                              <span>Results available</span>
                              {request.result_file_ids && request.result_file_ids.length > 0 && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                  {request.result_file_ids.length} Files
                                </span>
                              )}
                              {request.report_text && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                  Report
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Radiologist Report */}
                        {request.report_text && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">
                                Radiology Report
                                {request.radiologist_name && (
                                  <span className="ml-2 text-gray-500">by {request.radiologist_name}</span>
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{request.report_text}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Imaging Request - Upload button clicked for request:', request.id);
                            // TODO: Open upload modal for this specific request
                            setActiveSection('files');
                          }}
                          className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors flex items-center gap-1"
                          title="Upload files for this request"
                        >
                          <Upload className="w-3 h-3" />
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Imaging Tab - Edit request clicked:', request.id);
                            setEditingRequest(request);
                            setShowRequestForm(true);
                          }}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="Edit request"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
              uploadType="imaging"
              maxFileSize={100 * 1024 * 1024} // 100MB for imaging files
              acceptedTypes={[
                'application/pdf',
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/dicom',
                'image/dicom'
              ]}
              onUploadSuccess={(file: any) => {
                console.log('✅ Imaging file uploaded:', file);
                fetchFileCount(); // Refresh file count badge
              }}
              onUploadError={(error: any) => {
                console.error('❌ Imaging upload error:', error);
                alert(`Upload failed: ${error}`);
              }}
            />
            
            <FileDisplayComponent
              patientId={patientId}
              visitId={visitId}
              uploadType="imaging"
              onFileDelete={(fileId) => {
                console.log('🗑️ Imaging file deleted:', fileId);
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
                console.log('🔘 Imaging Tab - Modal backdrop clicked');
                setShowRequestForm(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-auto"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <ImagingRequestForm
                patientId={patientId}
                visitId={visitId}
                editRequest={editingRequest}
                onSuccess={handleRequestSuccess}
                onCancel={() => {
                  console.log('🔘 Imaging Tab - Request form cancelled');
                  setShowRequestForm(false);
                  setEditingRequest(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImagingTabContent;