import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Plus, 
  Calendar,
  Upload,
  FileText,
  Building2,
  Edit2,
  Trash2,
  Loader2,
  Eye,
  Download,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ImagingRequestSimple from './ImagingRequestSimple';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ImagingTabContentSimpleProps {
  patientId: string;
  visitId: string;
}

// The Add Visit screen passes an empty visitId until the visit is saved, and an imaging request
// needs a saved visit to belong to
const NEW_VISIT_HINT = 'Save the visit first, then open it again to add imaging requests.';

interface ImagingFile {
  id: string;
  file_name: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  url?: string;
}

interface ImagingRequest {
  id: string;
  imaging_type: string;
  request_date: string;
  preferred_date?: string;
  scheduled_date?: string;
  facility_name?: string;
  status: string;
  body_part: string;
  clinical_indication: string;
  result_file_ids?: string[];
  completed_date?: string;
  patient_imaging?: ImagingFile[];
}

const ImagingTabContentSimple: React.FC<ImagingTabContentSimpleProps> = ({
  patientId,
  visitId
}) => {
  const [imagingRequests, setImagingRequests] = useState<ImagingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ImagingRequest | null>(null);
  const [uploadingRequestId, setUploadingRequestId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ImagingFile | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  useEffect(() => {
    fetchImagingRequests();
  }, [visitId]);

  const fetchImagingRequests = async () => {
    try {
      setLoading(true);
      
      // For new visits (empty visitId), don't load any existing data
      if (!visitId || visitId.trim() === "") {
        setImagingRequests([]);
        setLoading(false);
        return;
      }
      
      // First, fetch the imaging requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('imaging_requests' as any)
        .select('id, imaging_type, request_date, preferred_date, scheduled_date, facility_name, status, body_part, clinical_indication, result_file_ids, completed_date')
        .eq('visit_id', visitId)
        .order('request_date', { ascending: false });

      if (requestsError) {
        console.error('Error fetching imaging requests:', requestsError);
        toast.error('Could not load imaging requests. Please try again.');
        return;
      }

      // Then fetch the related files for requests that have file IDs
      const requestsWithFiles = await Promise.all(
        (requestsData || []).map(async (request) => {
          if (request.result_file_ids && request.result_file_ids.length > 0) {
            const { data: filesData, error: filesError } = await supabase
              .from('patient_imaging')
              .select('id, file_name, original_name, storage_path, mime_type')
              .in('id', request.result_file_ids);

            if (filesError) {
              console.error('Error fetching files for request:', request.id, filesError);
              return { ...request, patient_imaging: [] };
            }

            return { ...request, patient_imaging: filesData || [] };
          }
          return { ...request, patient_imaging: [] };
        })
      );

      setImagingRequests(requestsWithFiles as ImagingRequest[]);
    } catch (error) {
      console.error('Error in fetchImagingRequests:', error);
      toast.error('Could not load imaging requests. Please try again.');
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'completed': return 'text-green-600';
      case 'cancelled': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getFileUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const downloadFile = async (file: ImagingFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(file.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download the file. Please try again.');
    }
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const viewFile = async (file: ImagingFile) => {
    if (isImageFile(file.mime_type)) {
      // For images, use the photo viewer
      const url = await getSignedUrl(file.storage_path);
      if (url) {
        setSelectedFile({ ...file, url });
        setShowPhotoViewer(true);
      } else {
        toast.error('Could not open the image. Please try again, or download it instead.');
      }
    } else {
      // For non-images, open in new tab
      const url = getFileUrl(file.storage_path);
      window.open(url, '_blank');
    }
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Error generating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error in getSignedUrl:', error);
      return null;
    }
  };

  const handleMultipleFileUpload = async (requestId: string, files: FileList) => {
    setUploadingRequestId(requestId);

    try {
      const uploadedFileIds: string[] = [];
      const user = await supabase.auth.getUser();

      // Upload each file
      for (const file of Array.from(files)) {
        // Upload to Supabase storage
        const fileName = `imaging-results/${patientId}/${Date.now()}_${Math.random().toString(36).substring(2)}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Create patient_imaging record
        const { data: imagingData, error: imagingError } = await supabase
          .from('patient_imaging')
          .insert({
            patient_id: patientId,
            visit_id: visitId,
            file_name: fileName,
            original_name: file.name,
            file_size: file.size,
            file_type: file.type.split('/')[1] || 'unknown',
            mime_type: file.type,
            storage_path: fileName,
            storage_bucket: 'documents',
            imaging_type: 'other',
            uploaded_by: user.data.user?.id
          })
          .select()
          .single();

        if (imagingError) throw imagingError;
        uploadedFileIds.push(imagingData.id);
      }

      // Get existing file IDs and append new ones. If they can't be read, stop: saving only the new
      // IDs would unlink the results uploaded earlier.
      const { data: currentRequest, error: readError } = await supabase
        .from('imaging_requests')
        .select('result_file_ids')
        .eq('id', requestId)
        .single();

      if (readError) throw readError;

      const existingIds = currentRequest?.result_file_ids || [];
      const allFileIds = [...existingIds, ...uploadedFileIds];

      // Update imaging request with all file IDs
      const { error: updateError } = await supabase
        .from('imaging_requests')
        .update({
          result_file_ids: allFileIds,
          status: 'completed',
          // Local calendar date; toISOString() is UTC and gave yesterday before 02:00 in Namibia
          completed_date: format(new Date(), 'yyyy-MM-dd')
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      toast.success(`${uploadedFileIds.length} file${uploadedFileIds.length === 1 ? '' : 's'} uploaded`);
      // Refresh the list
      await fetchImagingRequests();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload the files. Please try again.');
    } finally {
      setUploadingRequestId(null);
    }
  };

  const handleDeleteRequest = async (request: ImagingRequest) => {
    const requestDate = request.request_date ? ` from ${format(new Date(request.request_date), 'dd MMM yyyy')}` : '';
    if (!window.confirm(`Delete the ${getImagingTypeLabel(request.imaging_type)} request${requestDate}? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('imaging_requests')
        .delete()
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Imaging request deleted');
      // Refresh the list
      await fetchImagingRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Failed to delete the imaging request. Please try again.');
    }
  };

  const handleRequestSuccess = () => {
    setShowRequestForm(false);
    setEditingRequest(null);
    fetchImagingRequests();
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Imaging Requests</h3>
          <p className="text-sm text-gray-600">Manage imaging requests and upload results</p>
        </div>
        {/* A disabled button shows no tooltip, so the wrapper carries the reason */}
        <span title={visitId.trim() === '' ? NEW_VISIT_HINT : undefined} className={visitId.trim() === '' ? 'cursor-not-allowed' : undefined}>
          <button
            type="button"
            onClick={() => {
              setShowRequestForm(true);
              setEditingRequest(null);
            }}
            disabled={visitId.trim() === ''}
            className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 ${visitId.trim() === '' ? 'pointer-events-none' : ''}`}
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </span>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Body Part
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Files
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {imagingRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No imaging requests yet</h4>
                    <p className="text-gray-500">
                      {visitId.trim() === '' ? NEW_VISIT_HINT : "Use 'New Request' to order an imaging study for this visit."}
                    </p>
                  </td>
                </tr>
              ) : (
                imagingRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Camera className="w-4 h-4 text-purple-600 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {getImagingTypeLabel(request.imaging_type)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      {format(new Date(request.request_date), 'dd MMM yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {request.body_part || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      {request.facility_name ? (
                        <>
                          <Building2 className="w-4 h-4 mr-1" />
                          {request.facility_name}
                        </>
                      ) : (
                        '-'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium capitalize ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    {request.result_file_ids && request.result_file_ids.length > 0 && (
                      <FileText className="w-4 h-4 inline ml-2 text-green-600" title="Results uploaded" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {request.patient_imaging && request.patient_imaging.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {request.patient_imaging.slice(0, 3).map((file, index) => (
                          <div key={file.id} className="relative group">
                            {isImageFile(file.mime_type) ? (
                              <img
                                src={getFileUrl(file.storage_path)}
                                alt={file.original_name}
                                className="w-10 h-10 object-cover rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => viewFile(file)}
                              />
                            ) : (
                              <div 
                                className="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                                onClick={() => viewFile(file)}
                              >
                                <FileText className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                        {request.patient_imaging.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{request.patient_imaging.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No files</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {/* Upload Button */}
                      <label className="relative cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              handleMultipleFileUpload(request.id, files);
                            }
                          }}
                          className="hidden"
                          disabled={uploadingRequestId === request.id}
                        />
                        <span className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors flex items-center gap-1 font-medium">
                          {uploadingRequestId === request.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" />
                              {request.patient_imaging && request.patient_imaging.length > 0 ? 'Add More' : 'Upload'}
                            </>
                          )}
                        </span>
                      </label>
                      
                      {/* File Actions */}
                      {request.patient_imaging && request.patient_imaging.length > 0 && (
                        <div className="flex items-center gap-1">
                          {request.patient_imaging.map((file, index) => (
                            <div key={file.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => viewFile(file)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title={`View ${file.original_name}`}
                                aria-label={`View ${file.original_name}`}
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadFile(file)}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title={`Download ${file.original_name}`}
                                aria-label={`Download ${file.original_name}`}
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRequest(request);
                          setShowRequestForm(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Edit request"
                        aria-label={`Edit ${getImagingTypeLabel(request.imaging_type)} request`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(request)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete request"
                        aria-label={`Delete ${getImagingTypeLabel(request.imaging_type)} request`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </div>

      {/* Request Form Modal */}
      <AnimatePresence>
        {showRequestForm && (
          <ImagingRequestSimple
            patientId={patientId}
            visitId={visitId}
            editRequest={editingRequest}
            onClose={() => {
              setShowRequestForm(false);
              setEditingRequest(null);
            }}
            onRequestCreated={handleRequestSuccess}
          />
        )}
      </AnimatePresence>

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {showPhotoViewer && selectedFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
            onClick={() => setShowPhotoViewer(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full h-full max-w-7xl max-h-screen p-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 text-white">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold truncate">{selectedFile.original_name}</h3>
                  <p className="text-sm text-gray-300">Imaging Result</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      downloadFile(selectedFile);
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded text-white"
                    title="Download"
                    aria-label={`Download ${selectedFile.original_name}`}
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPhotoViewer(false);
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded text-white"
                    title="Close"
                    aria-label="Close the image viewer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 flex items-center justify-center">
                {selectedFile.url && isImageFile(selectedFile.mime_type) ? (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.original_name}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl cursor-zoom-in"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open in new tab for full zoom
                      window.open(selectedFile.url, '_blank');
                    }}
                  />
                ) : selectedFile.url && selectedFile.mime_type === 'application/pdf' ? (
                  <div className="w-full h-[80vh] bg-white rounded-lg">
                    <iframe
                      src={selectedFile.url}
                      className="w-full h-full border-0 rounded-lg"
                      title={selectedFile.original_name}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-white">
                    <FileText className="w-16 h-16 text-white text-opacity-60 mx-auto mb-4" />
                    <p className="text-white text-opacity-80 mb-4">Preview not available for this file type</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        downloadFile(selectedFile);
                      }}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Download to View
                    </button>
                  </div>
                )}
              </div>

              {/* File Details */}
              <div className="border-t border-white border-opacity-20 pt-4 mt-4">
                <dl className="grid grid-cols-2 gap-4 text-sm text-white">
                  <div>
                    <dt className="font-medium text-white text-opacity-90">File Name</dt>
                    <dd className="text-white text-opacity-70">{selectedFile.original_name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-white text-opacity-90">File Type</dt>
                    <dd className="text-white text-opacity-70">{selectedFile.mime_type}</dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImagingTabContentSimple;