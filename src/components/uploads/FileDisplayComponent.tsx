import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, 
  Image, 
  Video, 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Calendar,
  User,
  Tag,
  AlertTriangle,
  Clock,
  MapPin,
  TestTube,
  Zap,
  Search,
  Filter,
  Grid3X3,
  List,
  X,
  Edit2,
  Save,
  CreditCard,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { bucketOf, recordLink } from '../../services/recordFiles';

interface FileDisplayProps {
  patientId: string;
  visitId?: string;
  uploadType: 'media' | 'laboratory' | 'imaging';
  onFileDelete?: (fileId: string) => void;
}

interface DisplayedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  storagePath: string;
  /** The row's storage_bucket: "records" since the move to the private bucket, "documents" before */
  storageBucket?: string | null;
  title?: string;
  category?: string;
  subcategory?: string;
  testType?: string;
  imagingType?: string;
  bodyPart?: string;
  description?: string;
  uploadedAt: string;
  uploadedBy?: string;
  isUrgent?: boolean;
  isSensitive?: boolean;
  status?: string;
  studyDate?: string;
  url?: string;
  // Additional fields that might come from the database
  file_name?: string;
  original_name?: string;
  file_size?: number;
  file_type?: string;
  mime_type?: string;
  storage_path?: string;
  uploaded_at?: string;
}

const FileDisplayComponent: React.FC<FileDisplayProps> = ({
  patientId,
  visitId,
  uploadType,
  onFileDelete
}) => {
  const [files, setFiles] = useState<DisplayedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState<DisplayedFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table'); // Default to table/list view
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFile, setEditingFile] = useState<DisplayedFile | null>(null);
  const [editFormData, setEditFormData] = useState({
    subcategory: '',
    description: ''
  });
  const { user } = useAuthStore();

  // Media categories (same as in MediaUploadWrapper)
  const MEDIA_CATEGORIES = [
    { value: 'drivers_license', label: 'Driver\'s License', icon: CreditCard, dbCategory: 'document' },
    { value: 'id_document', label: 'ID Document', icon: User, dbCategory: 'document' },
    { value: 'passport', label: 'Passport', icon: FileText, dbCategory: 'document' },
    { value: 'birth_certificate', label: 'Birth Certificate', icon: FileText, dbCategory: 'document' },
    { value: 'medical_aid_card', label: 'Medical Aid Card', icon: Shield, dbCategory: 'document' },
    { value: 'insurance_card', label: 'Insurance Card', icon: Shield, dbCategory: 'document' },
    { value: 'referral_letter', label: 'Referral Letter', icon: FileText, dbCategory: 'document' },
    { value: 'prescription', label: 'Prescription', icon: FileText, dbCategory: 'document' },
    { value: 'medical_certificate', label: 'Medical Certificate', icon: FileText, dbCategory: 'document' },
    { value: 'consent_form', label: 'Consent Form', icon: FileText, dbCategory: 'document' },
    { value: 'clinical_photo', label: 'Clinical Photo', icon: Image, dbCategory: 'photo' },
    { value: 'before_after', label: 'Before/After Photo', icon: Image, dbCategory: 'photo' },
    { value: 'wound_care', label: 'Wound Care Photo', icon: Image, dbCategory: 'photo' },
    { value: 'xray_film', label: 'X-Ray Film', icon: Image, dbCategory: 'photo' },
    { value: 'scan_copy', label: 'Scan Copy', icon: Image, dbCategory: 'photo' },
    { value: 'other', label: 'Other', icon: File, dbCategory: 'other' }
  ];


  // Get table name based on upload type (each row names its own bucket: storage_bucket)

  const getTableName = () => {
    switch (uploadType) {
      case 'media':
        return 'patient_media';
      case 'laboratory':
        return 'patient_laboratory';
      case 'imaging':
        return 'patient_imaging';
      default:
        return 'patient_documents'; // fallback
    }
  };

  const getOrderByColumn = () => {
    // patient_documents uses 'created_at', others use 'uploaded_at'
    return uploadType === 'media' || uploadType === 'laboratory' || uploadType === 'imaging' 
      ? 'uploaded_at' 
      : 'created_at';
  };

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string | undefined) => {
    if (!mimeType) return File;
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    return File;
  };

  // Fetch files from database with retry logic
  const fetchFiles = async (retryCount = 0) => {
    try {
      setLoading(true);
      
      const tableName = getTableName();
      const orderColumn = getOrderByColumn();
      
      console.log(`🔵 Fetching from table: ${tableName}, order by: ${orderColumn}`);
      console.log(`🔍 Patient ID: ${patientId}`);
      console.log(`🔍 Visit ID: ${visitId || 'NO VISIT ID'}`);
      console.log(`🔍 Upload Type: ${uploadType}`);
      
      let query = supabase
        .from(tableName as any)
        .select('*')
        .eq('patient_id', patientId)
        .order(orderColumn, { ascending: false });

      if (visitId && visitId.trim()) {
        console.log(`🔍 Adding visit_id filter: ${visitId}`);
        query = query.eq('visit_id', visitId);
      } else if (visitId === "") {
        // For new visits (empty visitId), don't load any existing files
        console.log(`🆕 New visit detected - not loading existing files`);
        setFiles([]);
        setLoading(false);
        return;
      }
      
      console.log(`🔍 Query: ${tableName} WHERE patient_id = '${patientId}'${visitId ? ` AND visit_id = '${visitId}'` : ''}`);

      const { data, error } = await query;
      
      console.log(`📊 Query Result: ${data ? data.length : 0} records found`);
      console.log(`📊 First record:`, data && data.length > 0 ? data[0] : 'No records');

      if (error) {
        console.error('❌ Error fetching files:', error);
        console.error('❌ Table:', tableName);
        console.error('❌ Error details:', error);
        
        // Handle network errors with retry logic
        if (error.message && error.message.includes('Failed to fetch') && retryCount < 3) {
          console.log(`🔄 Network error detected, retrying... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => fetchFiles(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        
        // Provide more helpful error message
        if (error.code === '42703') {
          console.error('💡 Column missing - this might be due to table schema mismatch');
        } else if (error.message && error.message.includes('Failed to fetch')) {
          console.error('💡 Network connection issue - check internet connectivity or try refreshing the page');
        }

        // Otherwise a failed load looks the same as "no files uploaded"
        toast.error('Could not load the files. Check your connection and try again.');
        setFiles([]);
        setLoading(false);
        return;
      }

      console.log(`✅ Fetched ${data?.length || 0} files for ${uploadType}`);
      
      // Map the database response to our DisplayedFile interface
      const mappedFiles = (data || []).map((file: any) => ({
        id: file.id,
        fileName: file.file_name || file.fileName,
        originalName: file.original_name || file.originalName,
        fileSize: file.file_size || file.fileSize,
        fileType: file.file_type || file.fileType,
        mimeType: file.mime_type || file.mimeType,
        storagePath: file.storage_path || file.storagePath,
        storageBucket: file.storage_bucket ?? null,
        title: file.title,
        category: file.category,
        subcategory: file.subcategory,
        testType: file.test_type,
        imagingType: file.imaging_type,
        bodyPart: file.body_part,
        description: file.description,
        uploadedAt: file.uploaded_at || file.created_at || file.uploadedAt,
        uploadedBy: file.uploaded_by,
        isUrgent: file.is_urgent,
        isSensitive: file.is_sensitive,
        status: file.status,
        studyDate: file.study_date
      }));
      
      // Generate thumbnail URLs for image files
      const filesWithThumbnails = await Promise.all(
        mappedFiles.map(async (file) => {
          if (file.mimeType && file.mimeType.startsWith('image/')) {
            const url = await getFileUrl(file.storagePath, file.storageBucket);
            return { ...file, url: url || undefined };
          }
          return file;
        })
      );
      
      setFiles(filesWithThumbnails as DisplayedFile[]);

    } catch (error) {
      console.error('💥 Error in fetchFiles:', error);
      
      // Handle network errors with retry logic at the catch level too
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Failed to fetch') && retryCount < 3) {
          console.log(`🔄 Catch: Network error detected, retrying... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => fetchFiles(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
      }

      toast.error('Could not load the files. Check your connection and try again.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Load files on component mount
  useEffect(() => {
    console.log('🔄 FileDisplayComponent mounted/updated');
    console.log('🔄 Props:', { patientId, visitId, uploadType });
    fetchFiles();
  }, [patientId, visitId, uploadType]);

  // Generate a short-lived signed URL for file preview/download (made now, never stored)
  const getFileUrl = async (filePath: string, bucket?: string | null): Promise<string | null> => {
    try {
      return await recordLink(filePath, bucket);
    } catch (error) {
      console.error('💥 Error in getFileUrl:', error);
      return null;
    }
  };

  // Handle file download. Browsers ignore "download" on a link to another site (the storage
  // server) and open the file in place of the app, losing unsaved work, so fetch it first.
  const handleDownload = async (file: DisplayedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketOf(file.storagePath, file.storageBucket))
        .download(file.storagePath);
      if (error || !data) throw error ?? new Error('The file is empty');

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      toast.error('Could not download the file. Please try again.');
    }
  };

  // Handle file preview
  const handlePreview = async (file: DisplayedFile) => {
    const url = await getFileUrl(file.storagePath, file.storageBucket);
    if (url) {
      setSelectedFile({ ...file, url });
      setShowPreview(true);
    } else {
      toast.error('Could not open the file. Please try again, or download it instead.');
    }
  };

  // Handle edit button click
  const handleEdit = (file: DisplayedFile) => {
    setEditingFile(file);
    setEditFormData({
      subcategory: file.subcategory || '',
      description: file.description || ''
    });
    setShowEditModal(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingFile) return;

    try {
      const tableName = getTableName();
      
      // Find the selected category to get the database category
      const categoryInfo = MEDIA_CATEGORIES.find(cat => cat.value === editFormData.subcategory);
      const dbCategory = categoryInfo?.dbCategory || editingFile.category || 'other';
      
      // Update the database
      const { error } = await supabase
        .from(tableName as any)
        .update({
          category: dbCategory,
          subcategory: editFormData.subcategory,
          description: editFormData.description,
          metadata: {
            ...(editingFile as any).metadata,
            specificType: editFormData.subcategory,
            lastUpdated: new Date().toISOString()
          }
        })
        .eq('id', editingFile.id);

      if (error) {
        console.error('❌ Error updating file:', error);
        toast.error('Failed to save the changes. Please try again.');
        return;
      }

      // Update local state
      setFiles(prev => prev.map(f => 
        f.id === editingFile.id 
          ? { 
              ...f, 
              category: dbCategory,
              subcategory: editFormData.subcategory,
              description: editFormData.description 
            }
          : f
      ));

      console.log('✅ File updated successfully');
      toast.success('Changes saved');
      setShowEditModal(false);
      setEditingFile(null);
    } catch (error) {
      console.error('💥 Error in handleSaveEdit:', error);
      toast.error('Failed to save the changes. Please try again.');
    }
  };

  // Handle file deletion
  const handleDelete = async (file: DisplayedFile) => {
    if (!window.confirm(`Delete "${file.title || file.originalName}" from this patient's files? This cannot be undone.`)) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketOf(file.storagePath, file.storageBucket))
        .remove([file.storagePath]);

      if (storageError) {
        console.error('❌ Storage deletion error:', storageError);
      }

      // Delete from database
      const tableName = getTableName();
      console.log(`🔵 Deleting from table: ${tableName}`);
      
      const { error: dbError } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', file.id);

      if (dbError) {
        console.error('❌ Database deletion error:', dbError);
        throw new Error(`Failed to delete file: ${dbError.message}`);
      }

      // Update local state
      setFiles(prev => prev.filter(f => f.id !== file.id));
      onFileDelete?.(file.id);

      console.log('✅ File deleted successfully');
      toast.success('File deleted');

    } catch (error) {
      console.error('💥 Error deleting file:', error);
      toast.error('Failed to delete the file. Please try again.');
    }
  };

  // Filter files based on search and category
  const filteredFiles = files.filter(file => {
    const matchesSearch = !searchTerm || 
      file.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !filterCategory || 
      file.category === filterCategory ||
      file.testType === filterCategory ||
      file.imagingType === filterCategory;

    return matchesSearch && matchesCategory;
  });

  // Get category options based on upload type
  const getCategoryOptions = () => {
    if (uploadType === 'media') {
      return [
        'clinical_photo', 'before_after', 'procedure_video', 'patient_education', 
        'consultation_recording', 'documentation', 'progress_photo', 'scan_copy',
        'form_document', 'id_document', 'drivers_license', 'passport', 
        'birth_certificate', 'medical_certificate', 'insurance_card', 
        'referral_letter', 'prescription', 'test_results', 'xray_film', 'other'
      ];
    } else if (uploadType === 'laboratory') {
      return ['blood_work', 'urine_analysis', 'microbiology', 'chemistry', 'pathology', 'genetics', 'other'];
    } else if (uploadType === 'imaging') {
      return ['x_ray', 'ct_scan', 'mri', 'ultrasound', 'mammography', 'dental_x_ray', 'panoramic_x_ray', 'cbct', 'other'];
    }
    return [];
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date: day-month-year with a 24-hour time, as used across the app
  const formatDate = (dateString: string) => {
    const date = dateString ? new Date(dateString) : null;
    return date && !isNaN(date.getTime()) ? format(date, 'dd MMM yyyy, HH:mm') : '—';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search, Filter and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
          >
            <option value="">All Types</option>
            {getCategoryOptions().map(option => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              console.log('🔘 FileDisplay - Grid view button clicked');
              setViewMode('grid');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'grid' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-gray-600 hover:text-blue-700'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => {
              console.log('🔘 FileDisplay - Table view button clicked');
              setViewMode('table');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'table' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-gray-600 hover:text-blue-700'
            }`}
          >
            <List className="w-4 h-4" />
            Table
          </button>
        </div>
      </div>

      {/* Files Display */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {files.length > 0
              ? 'No files match your search. Clear the search or choose All Types.'
              : visitId === ''
                ? 'Save the visit first, then open it again to see and add files.'
                : 'No files uploaded yet.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const FileIcon = getFileIcon(file.mimeType);
            
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200"
              >
                {/* File Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm truncate" title={file.title || file.originalName}>
                        {file.title || file.originalName}
                      </h4>
                      {file.title && (
                        <p className="text-xs text-gray-500 truncate" title={file.originalName}>
                          {file.originalName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
                    </div>
                  </div>
                  
                  {/* Status Badges */}
                  <div className="flex gap-1">
                    {file.isUrgent && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Urgent
                      </span>
                    )}
                    {file.isSensitive && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        Sensitive
                      </span>
                    )}
                  </div>
                </div>

                {/* Image Preview for All Image Files */}
                {file.mimeType?.startsWith('image/') && file.url && (
                  <div className="mb-3 relative group">
                    <img
                      src={file.url}
                      alt={file.title || file.originalName}
                      className="w-full h-40 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-all duration-200 group-hover:scale-105"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 FileDisplay Grid - Image preview clicked:', file.originalName);
                        handlePreview(file);
                      }}
                    />
                    {/* Overlay with zoom icon */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                  </div>
                )}

                {/* File Info */}
                <div className="space-y-2 mb-4">
                  {/* Category/Type */}
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {((uploadType === 'media' && file.subcategory) || file.category || file.testType || file.imagingType || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {formatDate(file.uploadedAt)}
                    </span>
                  </div>

                  {/* Additional info for imaging */}
                  {uploadType === 'imaging' && file.bodyPart && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{file.bodyPart}</span>
                    </div>
                  )}

                  {/* Additional info for laboratory */}
                  {uploadType === 'laboratory' && file.status && (
                    <div className="flex items-center gap-2">
                      <TestTube className="w-4 h-4 text-gray-400" />
                      <span className={`text-sm px-2 py-1 rounded-full text-xs ${
                        file.status === 'completed' ? 'bg-green-100 text-green-800' :
                        file.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {file.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {file.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{file.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 FileDisplay Grid - Preview button clicked:', file.originalName);
                        handlePreview(file);
                      }}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Preview"
                      aria-label={`View ${file.title || file.originalName}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 FileDisplay Grid - Download button clicked:', file.originalName);
                        handleDownload(file);
                      }}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Download"
                      aria-label={`Download ${file.title || file.originalName}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {uploadType === 'media' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔘 FileDisplay Grid - Edit button clicked:', file.originalName);
                          handleEdit(file);
                        }}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Edit"
                        aria-label={`Edit ${file.title || file.originalName}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 FileDisplay Grid - Delete button clicked:', file.originalName);
                        handleDelete(file);
                      }}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                      aria-label={`Delete ${file.title || file.originalName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFiles.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                const isImage = file.mimeType?.startsWith('image/');
                
                return (
                  <tr key={file.id} className="hover:bg-gray-50">
                    {/* Preview Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {isImage && file.url ? (
                          <img
                            src={file.url}
                            alt={file.title || file.originalName}
                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🔘 FileDisplay - Image preview clicked:', file.originalName);
                              handlePreview(file);
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border">
                            <FileIcon className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Name Column */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm" title={file.title || file.originalName}>
                          {file.title || file.originalName}
                        </p>
                        {file.title && (
                          <p className="text-xs text-gray-500 truncate" title={file.originalName}>
                            {file.originalName}
                          </p>
                        )}
                        {file.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {file.description}
                          </p>
                        )}
                      </div>
                    </td>
                    
                    {/* Category Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {((uploadType === 'media' && file.subcategory) || file.category || file.testType || file.imagingType || 'Unknown')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        {file.isUrgent && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Urgent
                          </span>
                        )}
                        {file.isSensitive && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Sensitive
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Size Column */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {formatFileSize(file.fileSize)}
                      </span>
                    </td>
                    
                    {/* Date Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {formatDate(file.uploadedAt)}
                      </div>
                    </td>
                    
                    {/* Actions Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 FileDisplay - View button clicked:', file.originalName);
                            // Only images have a link loaded with the list; PDFs and videos need one fetched
                            handlePreview(file);
                          }}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View"
                          aria-label={`View ${file.title || file.originalName}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 FileDisplay - Download button clicked:', file.originalName);
                            handleDownload(file);
                          }}
                          className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Download"
                          aria-label={`Download ${file.title || file.originalName}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {uploadType === 'media' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🔘 FileDisplay - Edit button clicked:', file.originalName);
                              handleEdit(file);
                            }}
                            className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Edit"
                            aria-label={`Edit ${file.title || file.originalName}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 FileDisplay - Delete button clicked:', file.originalName);
                            handleDelete(file);
                          }}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                          aria-label={`Delete ${file.title || file.originalName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Enhanced Image Viewer Modal */}
      <AnimatePresence>
        {showPreview && selectedFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
            onClick={() => setShowPreview(false)}
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
                  <h3 className="text-lg font-semibold truncate">{selectedFile.title || selectedFile.originalName}</h3>
                  {selectedFile.title && (
                    <p className="text-sm text-gray-300 truncate">{selectedFile.originalName}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDownload(selectedFile);
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded text-white"
                    title="Download"
                    aria-label={`Download ${selectedFile.title || selectedFile.originalName}`}
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPreview(false);
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded text-white"
                    title="Close"
                    aria-label="Close the preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 flex items-center justify-center">
                {selectedFile.mimeType?.startsWith('image/') && selectedFile.url ? (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.originalName}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl cursor-zoom-in"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open in new tab for full zoom
                      window.open(selectedFile.url, '_blank');
                    }}
                  />
                ) : selectedFile.mimeType === 'application/pdf' && selectedFile.url ? (
                  <div className="w-full h-[80vh] bg-white rounded-lg">
                    <iframe
                      src={selectedFile.url}
                      className="w-full h-full border-0 rounded-lg"
                      title={selectedFile.originalName}
                    />
                  </div>
                ) : selectedFile.mimeType?.startsWith('video/') && selectedFile.url ? (
                  <video
                    src={selectedFile.url}
                    controls
                    className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="text-center py-8 text-white">
                    <File className="w-16 h-16 text-white text-opacity-60 mx-auto mb-4" />
                    <p className="text-white text-opacity-80 mb-4">Preview not available for this file type</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownload(selectedFile);
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    <dt className="font-medium text-white text-opacity-90">File Size</dt>
                    <dd className="text-white text-opacity-70">{formatFileSize(selectedFile.fileSize)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-white text-opacity-90">Upload Date</dt>
                    <dd className="text-white text-opacity-70">{formatDate(selectedFile.uploadedAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-white text-opacity-90">Type</dt>
                    <dd className="text-white text-opacity-70">
                      {((uploadType === 'media' && selectedFile.subcategory) || selectedFile.category || selectedFile.testType || selectedFile.imagingType || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </dd>
                  </div>
                  {selectedFile.bodyPart && (
                    <div>
                      <dt className="font-medium text-white text-opacity-90">Body Part</dt>
                      <dd className="text-white text-opacity-70">{selectedFile.bodyPart}</dd>
                    </div>
                  )}
                </dl>
                {selectedFile.description && (
                  <div className="mt-4">
                    <dt className="font-medium text-white text-opacity-90">Description</dt>
                    <dd className="text-white text-opacity-70 mt-1">{selectedFile.description}</dd>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingFile && uploadType === 'media' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Edit Media File</h3>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">{editingFile.originalName}</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type
                  </label>
                  <select
                    value={editFormData.subcategory}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-[#01b9d4]"
                  >
                    <option value="">Select type...</option>
                    {MEDIA_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Add a description..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d4] focus:border-[#01b9d4] resize-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileDisplayComponent;