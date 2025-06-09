import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Image,
  File,
  Download,
  Eye,
  Trash2,
  Tag,
  Calendar,
  User,
  Search,
  Filter,
  Grid,
  List,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

interface Document {
  id: string;
  patient_id: string;
  visit_id?: string;
  file_name: string;
  original_name: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  description?: string;
  category: string;
  tags?: string[];
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

interface DocumentListProps {
  patientId: string;
  refreshTrigger?: number;
}

const ALLOWED_TYPES = {
  'application/pdf': { icon: FileText, color: 'text-red-600', bg: 'bg-red-100' },
  'image/jpeg': { icon: Image, color: 'text-blue-600', bg: 'bg-blue-100' },
  'image/jpg': { icon: Image, color: 'text-blue-600', bg: 'bg-blue-100' },
  'image/png': { icon: Image, color: 'text-green-600', bg: 'bg-green-100' },
  'image/gif': { icon: Image, color: 'text-purple-600', bg: 'bg-purple-100' },
  'image/webp': { icon: Image, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  'application/msword': { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  'text/plain': { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
  'application/vnd.ms-excel': { icon: FileText, color: 'text-green-600', bg: 'bg-green-100' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileText, color: 'text-green-600', bg: 'bg-green-100' }
};

const CATEGORIES = {
  'general': 'General Documents',
  'lab_results': 'Lab Results',
  'imaging': 'Medical Imaging',
  'referrals': 'Referrals',
  'consent_forms': 'Consent Forms',
  'insurance': 'Insurance Documents',
  'prescriptions': 'Prescriptions',
  'discharge_summaries': 'Discharge Summaries'
};

const DocumentList: React.FC<DocumentListProps> = ({ patientId, refreshTrigger }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchDocuments();
  }, [patientId, refreshTrigger]);

  const fetchDocuments = async () => {
    try {
      console.log('📂 Fetching documents for patient:', patientId);
      setLoading(true);
      
      const { data, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching documents:', error);
        
        // Check if table doesn't exist
        if (error.code === '42P01') {
          toast.error('Documents table not created yet. Please run the setup SQL first.');
          console.error('🚨 SETUP REQUIRED: Run CREATE_DOCUMENTS_TABLE_IN_SUPABASE.sql in Supabase Dashboard');
        } else {
          toast.error('Failed to load documents: ' + error.message);
        }
        setDocuments([]);
        return;
      }

      console.log('✅ Documents fetched successfully:', data?.length || 0, 'documents');
      setDocuments(data || []);
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast.error('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    const typeInfo = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    return typeInfo ? typeInfo.icon : File;
  };

  const getFileColor = (mimeType: string) => {
    const typeInfo = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    return typeInfo ? typeInfo.color : 'text-gray-600';
  };

  const getFileBg = (mimeType: string) => {
    const typeInfo = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    return typeInfo ? typeInfo.bg : 'bg-gray-100';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadDocument = async (document: Document) => {
    try {
      console.log('📥 Downloading document:', document.original_name);
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) {
        console.error('❌ Download failed:', error);
        toast.error('Failed to download document: ' + error.message);
        return;
      }

      console.log('✅ Document data retrieved, creating download link');
      
      // Create download link
      const url = window.URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ Download completed successfully');
      toast.success('Document downloaded');
    } catch (error) {
      console.error('❌ Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const previewDocument = async (document: Document) => {
    try {
      console.log('👁️ Creating preview for document:', document.original_name);
      
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.storage_path, 3600); // 1 hour expiry

      if (error) {
        console.error('❌ Preview failed:', error);
        toast.error('Failed to preview document: ' + error.message);
        return;
      }

      console.log('✅ Signed URL created, opening preview');
      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('❌ Preview error:', error);
      toast.error('Failed to preview document');
    }
  };

  const deleteDocument = async (document: Document) => {
    if (!confirm(`Are you sure you want to delete "${document.original_name}"?`)) {
      console.log('🚫 Document deletion cancelled by user');
      return;
    }

    try {
      console.log('🗑️ Deleting document:', document.original_name);
      
      // Delete from storage
      console.log('1️⃣ Deleting from storage...');
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.storage_path]);

      if (storageError) {
        console.error('⚠️ Storage deletion error (continuing anyway):', storageError);
      } else {
        console.log('✅ Storage deletion successful');
      }

      // Delete from database
      console.log('2️⃣ Deleting from database...');
      const { error: dbError } = await supabase
        .from('patient_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        console.error('❌ Database deletion failed:', dbError);
        toast.error('Failed to delete document: ' + dbError.message);
        return;
      }

      console.log('✅ Document deleted successfully');
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));
      toast.success('Document deleted');
    } catch (error) {
      console.error('❌ Delete error:', error);
      toast.error('Failed to delete document');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const DocumentCard: React.FC<{ document: Document; index: number }> = ({ document, index }) => {
    const Icon = getFileIcon(document.mime_type);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 group"
      >
        <div className="space-y-3">
          {/* File Icon and Actions */}
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl ${getFileBg(document.mime_type)}`}>
              <Icon className={`w-6 h-6 ${getFileColor(document.mime_type)}`} />
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => previewDocument(document)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Preview"
              >
                <Eye className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => downloadDocument(document)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => deleteDocument(document)}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>

          {/* File Info */}
          <div>
            <h4 className="font-medium text-gray-800 text-sm truncate" title={document.original_name}>
              {document.original_name}
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              {formatFileSize(document.file_size)} • {CATEGORIES[document.category as keyof typeof CATEGORIES]}
            </p>
          </div>

          {/* Description */}
          {document.description && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {document.description}
            </p>
          )}

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {document.tags.slice(0, 2).map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
              {document.tags.length > 2 && (
                <span className="text-xs text-gray-500">
                  +{document.tags.length - 2} more
                </span>
              )}
            </div>
          )}

          {/* Upload Date */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            <span>{format(parseISO(document.created_at), 'MMM dd, yyyy')}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  const DocumentRow: React.FC<{ document: Document; index: number }> = ({ document, index }) => {
    const Icon = getFileIcon(document.mime_type);
    
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 group"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${getFileBg(document.mime_type)}`}>
            <Icon className={`w-5 h-5 ${getFileColor(document.mime_type)}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-gray-800 truncate">
                  {document.original_name}
                </h4>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                  <span>{formatFileSize(document.file_size)}</span>
                  <span>•</span>
                  <span>{CATEGORIES[document.category as keyof typeof CATEGORIES]}</span>
                  <span>•</span>
                  <span>{format(parseISO(document.created_at), 'MMM dd, yyyy')}</span>
                </div>
                {document.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    {document.description}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => previewDocument(document)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Preview"
                >
                  <Eye className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => downloadDocument(document)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => deleteDocument(document)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4]"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4]"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          
          <div className="flex items-center border border-gray-200 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-[#01b9d4] text-white' : 'text-gray-600'} rounded-l-lg transition-colors`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-[#01b9d4] text-white' : 'text-gray-600'} rounded-r-lg transition-colors`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Documents Grid/List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">
            {searchTerm || selectedCategory !== 'all' ? 'No documents found' : 'No documents uploaded'}
          </h4>
          <p className="text-gray-500 text-sm">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Upload documents to get started'
            }
          </p>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
        }>
          {filteredDocuments.map((document, index) => 
            viewMode === 'grid' 
              ? <DocumentCard key={document.id} document={document} index={index} />
              : <DocumentRow key={document.id} document={document} index={index} />
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentList;