import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Clock, 
  User,
  Heart,
  Activity,
  Stethoscope,
  Pill,
  Clipboard,
  Brain,
  Edit3,
  Trash2,
  XCircle,
  X,
  Download,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  File
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface VisitModalProps {
  visit: any;
  onClose: () => void;
  onStatusChange: (status: 'completed' | 'in-progress') => void;
  onEdit: () => void;
}

const VisitModal: React.FC<VisitModalProps> = ({ visit, onClose, onStatusChange, onEdit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      // Delete vitals
      const { error: vitalsError } = await supabase
        .from('vitals')
        .delete()
        .eq('visit_id', visit.id);

      if (vitalsError) throw vitalsError;

      // Delete lab results
      const { error: labResultsError } = await supabase
        .from('lab_results')
        .delete()
        .eq('visit_id', visit.id);

      if (labResultsError) throw labResultsError;

      // Delete lab requests
      const { error: labRequestsError } = await supabase
        .from('lab_requests')
        .delete()
        .eq('visit_id', visit.id);

      if (labRequestsError) throw labRequestsError;

      // Delete media
      const { error: mediaError } = await supabase
        .from('visit_media')
        .delete()
        .eq('visit_id', visit.id);

      if (mediaError) throw mediaError;

      // Delete media requests
      const { error: mediaRequestsError } = await supabase
        .from('media_requests')
        .delete()
        .eq('visit_id', visit.id);

      if (mediaRequestsError) throw mediaRequestsError;

      // Finally, delete the visit
      const { error: visitError } = await supabase
        .from('visits')
        .delete()
        .eq('id', visit.id);

      if (visitError) throw visitError;

      onClose();
      window.location.reload(); // Refresh to update the visits list
    } catch (error) {
      console.error('Error deleting visit:', error);
      alert('Failed to delete visit. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      setIsDeletingMedia(mediaId);
      
      // Delete from visit_media table
      const { error: deleteError } = await supabase
        .from('visit_media')
        .delete()
        .eq('id', mediaId);

      if (deleteError) throw deleteError;

      // Refresh the page to update the media list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Failed to delete media. Please try again.');
    } finally {
      setIsDeletingMedia(null);
    }
  };

  const formatFileSize = (url: string): string => {
    // This is a placeholder. In a real app, you'd get the actual file size
    return '2.4 MB';
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className={`bg-gradient-to-r ${visit.status === 'in-progress' ? 'from-amber-500 to-orange-600' : 'from-[#01b9d4] to-[#0197d4]'} -mx-6 -mt-6 p-6 text-white rounded-t-xl`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">
              {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
            </h3>
            <div className="flex items-center mt-2 space-x-4 text-white/80">
              <div className="flex items-center">
                <Clock size={16} className="mr-2" />
                {format(new Date(visit.visit_date), 'MMMM d, yyyy')} at {visit.visit_time}
              </div>
              <div className="flex items-center">
                <User size={16} className="mr-2" />
                {visit.doctor_name || 'No doctor assigned'}
              </div>
            </div>
          </div>
          <Badge
            variant={
              visit.status === 'completed' ? 'success' :
              visit.status === 'in-progress' ? 'warning' :
              'error'
            }
            size="sm"
            className="uppercase tracking-wider"
          >
            {visit.status}
          </Badge>
        </div>
      </div>

      {/* Clinical Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
              <Clipboard size={18} className="mr-2 text-teal-500" />
              Chief Complaint
            </h4>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
              {visit.chief_complaint}
            </p>
          </div>

          <div>
            <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
              <Brain size={18} className="mr-2 text-indigo-500" />
              Diagnosis
            </h4>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
              {visit.diagnosis}
            </p>
          </div>

          <div>
            <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
              <Activity size={18} className="mr-2 text-amber-500" />
              Treatment Plan
            </h4>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-line">
              {visit.treatment_plan}
            </p>
          </div>

          {visit.prescription && (
            <div>
              <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                <Pill size={18} className="mr-2 text-red-500" />
                Prescription
              </h4>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-line">
                {visit.prescription}
              </p>
            </div>
          )}

          {visit.notes && (
            <div>
              <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                <FileText size={18} className="mr-2 text-blue-500" />
                Additional Notes
              </h4>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                {visit.notes}
              </p>
            </div>
          )}
        </div>

        {/* Media Gallery */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <ImageIcon size={18} className="mr-2 text-[#01b9d4]" />
                Media & Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visit.media && visit.media.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {visit.media.map((item: any, index: number) => (
                      <div
                        key={item.id}
                        className="relative group bg-gray-50 rounded-lg overflow-hidden"
                      >
                        {/* Preview */}
                        <div
                          className="aspect-square cursor-pointer"
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          {item.url ? (
                            <img
                              src={item.url}
                              alt={item.description || `Media ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <File size={24} className="text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Overlay with actions */}
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white/90 hover:bg-white"
                              onClick={() => setSelectedImageIndex(index)}
                            >
                              <ZoomIn size={14} className="mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white/90 hover:bg-white text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteMedia(item.id)}
                              disabled={isDeletingMedia === item.id}
                            >
                              {isDeletingMedia === item.id ? (
                                <span className="flex items-center">
                                  <Clock size={14} className="animate-spin mr-1" />
                                  Deleting...
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <Trash2 size={14} className="mr-1" />
                                  Delete
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span>{item.type}</span>
                            <span>{format(new Date(item.date), 'MMM d, yyyy')}</span>
                          </div>
                          {item.description && (
                            <p className="mt-1 truncate">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <ImageIcon size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">No media files available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('completed')}
            disabled={visit.status === 'completed' || isDeleting}
          >
            <Activity size={16} className="mr-2" />
            Complete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('in-progress')}
            disabled={visit.status === 'in-progress' || isDeleting}
          >
            <Clock size={16} className="mr-2" />
            In Progress
          </Button>
        </div>
        <div className="space-x-2">
          {showDeleteConfirm ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-red-50 text-red-600 hover:bg-red-100"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                <Trash2 size={16} className="mr-2" />
                Delete Visit
              </Button>
              <Button variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
                <XCircle size={16} className="mr-2" />
                Close
              </Button>
              <Button
                onClick={onEdit}
                disabled={isDeleting}
                style={{ backgroundColor: '#01b9d4' }}     
                className="text-white hover:bg-opacity-90"
                size="sm"
              >
                <Edit3 size={16} className="mr-2" />
                Edit Visit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Full-screen Image Modal */}
      <AnimatePresence>
        {selectedImageIndex !== null && visit.media && visit.media[selectedImageIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
            onClick={() => setSelectedImageIndex(null)}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Navigation */}
              {selectedImageIndex > 0 && (
                <button
                  className="absolute left-4 p-2 text-white hover:bg-white/10 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(selectedImageIndex - 1);
                  }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {selectedImageIndex < visit.media.length - 1 && (
                <button
                  className="absolute right-4 p-2 text-white hover:bg-white/10 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(selectedImageIndex + 1);
                  }}
                >
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Close button */}
              <button
                className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
                onClick={() => setSelectedImageIndex(null)}
              >
                <X size={24} />
              </button>

              {/* Image */}
              <img
                src={visit.media[selectedImageIndex].url}
                alt={visit.media[selectedImageIndex].description || 'Image'}
                className="max-h-[90vh] max-w-[90vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Image info */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white p-4 rounded-lg">
                <p className="font-medium">
                  {visit.media[selectedImageIndex].description || `Image ${selectedImageIndex + 1}`}
                </p>
                <p className="text-sm text-white/80">
                  {format(new Date(visit.media[selectedImageIndex].date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisitModal;