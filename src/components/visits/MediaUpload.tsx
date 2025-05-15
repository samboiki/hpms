import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';

interface MediaUploadProps {
  visitId: string;
  onUploadComplete?: () => void;
}

interface MediaFile {
  id: string;
  filename: string;
  url: string;
  description: string;
  created_at: string;
}

const MediaUpload: React.FC<MediaUploadProps> = ({ visitId, onUploadComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [descriptions, setDescriptions] = useState<{ [key: string]: string }>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMediaFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('media_files')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMediaFiles(data || []);
    } catch (err) {
      console.error('Error fetching media files:', err);
      setError('Failed to fetch media files. Please try again.');
    }
  };

  useEffect(() => {
    if (visitId) {
      fetchMediaFiles();
    }
  }, [visitId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
    
    // Initialize descriptions for new files
    const newDescriptions = { ...descriptions };
    selectedFiles.forEach(file => {
      newDescriptions[file.name] = '';
    });
    setDescriptions(newDescriptions);
  };

  const handleRemoveFile = (filename: string) => {
    setFiles(prev => prev.filter(file => file.name !== filename));
    const newDescriptions = { ...descriptions };
    delete newDescriptions[filename];
    setDescriptions(newDescriptions);
  };

  const handleDescriptionChange = (filename: string, value: string) => {
    setDescriptions(prev => ({
      ...prev,
      [filename]: value
    }));
  };

  const handleUpload = async () => {
    if (!visitId) {
      setError('Cannot upload files: No visit ID provided');
      return;
    }

    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${visitId}/${fileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        // Save file metadata to database
        const { error: dbError } = await supabase
          .from('media_files')
          .insert({
            filename: file.name,
            url: publicUrl,
            description: descriptions[file.name],
            visit_id: visitId,
            type: file.type.startsWith('image/') ? 'photo' : 'document'
          });

        if (dbError) throw dbError;
      }

      // Clear form
      setFiles([]);
      setDescriptions({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh media files list
      fetchMediaFiles();
      onUploadComplete?.();
    } catch (err) {
      console.error('Error uploading files:', err);
      setError('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string, url: string) => {
    try {
      // Extract file path from URL
      const filePath = url.split('/').slice(-2).join('/');
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('media_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Refresh list
      fetchMediaFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file. Please try again.');
    }
  };

  // If no visitId is provided, show a message
  if (!visitId) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500">Media upload is not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Upload Media</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} className="mr-2" />
            Select Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="space-y-4">
            {files.map((file) => (
              <div
                key={file.name}
                className="bg-gray-50 p-4 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon size={20} className="text-gray-400 mr-2" />
                    ) : (
                      <FileText size={20} className="text-gray-400 mr-2" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {file.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(file.name)}
                  >
                    <X size={16} />
                  </Button>
                </div>

                <textarea
                  placeholder="Add a description..."
                  value={descriptions[file.name] || ''}
                  onChange={(e) => handleDescriptionChange(file.name, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={2}
                />

                {file.type.startsWith('image/') && (
                  <div className="relative h-40 bg-gray-100 rounded-md overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setFiles([]);
                  setDescriptions({});
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Clear All
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-error-50 text-error-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Existing Files */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Uploaded Media</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white border rounded-lg overflow-hidden shadow-sm"
            >
              {file.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <div className="relative h-48">
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gray-100 flex items-center justify-center">
                  <FileText size={48} className="text-gray-400" />
                </div>
              )}
              
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {file.filename}
                </h4>
                {file.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {file.description}
                  </p>
                )}
                <div className="mt-4 flex justify-between items-center">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-primary hover:text-brand-dark"
                  >
                    View
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.id, file.url)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {mediaFiles.length === 0 && (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
              <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No media files uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaUpload