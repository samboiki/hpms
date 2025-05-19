import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Clock,
  User,
  Heart,
  Activity,
  Brain,
  Stethoscope,
  Pill,
  Clipboard,
  AlertCircle,
  Edit3,
  ImageIcon,
  Microscope,
  ChevronRight,
  Trash2,
  XCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  X
} from 'lucide-react';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { supabase } from '../../lib/supabase';
import Badge from '../ui/Badge';

interface VisitModalProps {
  visit: any;
  onClose: () => void;
  onStatusChange: (status: 'completed' | 'in-progress') => void;
  onEdit: () => void;
}

const VisitModal: React.FC<VisitModalProps> = ({ visit, onClose, onStatusChange, onEdit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

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
                {visit.visit_date} at {visit.visit_time}
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Clinical Information */}
        <div className="col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-[#494c61] flex items-center">
                <Stethoscope size={24} className="mr-3" />
                Clinical Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chief Complaint */}
              <div>
                <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                  <Clipboard size={18} className="mr-2 text-teal-500" />
                  Chief Complaint
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.chief_complaint}
                </p>
              </div>

              {/* Diagnosis */}
              <div>
                <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                  <Brain size={18} className="mr-2 text-indigo-500" />
                  Diagnosis
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.diagnosis}
                </p>
              </div>

              {/* Treatment Plan */}
              <div>
                <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                  <Activity size={18} className="mr-2 text-amber-500" />
                  Treatment Plan
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-line">
                  {visit.treatment_plan}
                </p>
              </div>

              {/* Prescription */}
              <div>
                <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                  <Pill size={18} className="mr-2 text-red-500" />
                  Prescription
                </h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-line">
                  {visit.prescription}
                </p>
              </div>

              {/* Additional Notes */}
              <div>
                <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                  <FileText size={18} className="mr-2 text-blue-500" />
                  Additional Notes
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.notes}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lab Results and Media */}
        <div className="col-span-4 space-y-6">
          {/* Lab Results */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center">
                <Microscope size={24} className="mr-3 text-[#01b9d4]" />
                Lab Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visit.lab_results?.length > 0 ? (
                <div className="space-y-3">
                  {visit.lab_results.map((result: any, index: number) => (
                    <div 
                      key={index}
                      className="bg-white rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">#{index + 1}. {result.name}</p>
                          <p className="text-sm text-gray-500">
                            {result.value} {result.unit}
                            {result.reference_range && (
                              <span className="ml-2 text-gray-400">
                                (Ref: {result.reference_range})
                              </span>
                            )}
                          </p>
                        </div>
                        <Badge
                          variant={
                            result.status === 'normal' ? 'success' :
                            result.status === 'high' ? 'warning' :
                            result.status === 'low' ? 'azure' :
                            'error'
                          }
                          size="sm"
                        >
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Microscope size={32} className="mx-auto mb-2 text-gray-400" />
                  No lab results available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Media Gallery */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center">
                <ImageIcon size={24} className="mr-3 text-[#01b9d4]" />
                Media Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visit.media?.length > 0 ? (
                <div className="space-y-4">
                  {visit.media.map((item: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">#{index + 1}. {item.type.toUpperCase()}</h4>
                          {item.description && (
                            <p className="text-sm text-gray-500">{item.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedImage(item.url)}
                          className="text-brand-primary"
                        >
                          <ExternalLink size={14} className="mr-1" />
                          View
                        </Button>
                      </div>
                      {item.url && (
                        <div className="relative group">
                          <img
                            src={item.url}
                            alt={item.description || `Media ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg cursor-pointer"
                            onClick={() => setExpandedImage(item.url)}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                            <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <ImageIcon size={32} className="mx-auto mb-2 text-gray-400" />
                  No media files available
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
            <CheckCircle2 size={16} className="mr-2" />
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
              >
                <Edit3 size={16} className="mr-2" />
                Edit Visit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {expandedImage && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedImage(null)}
              className="absolute top-2 right-2 text-white bg-black bg-opacity-50 hover:bg-opacity-75"
            >
              <X size={20} />
            </Button>
            <img
              src={expandedImage}
              alt="Expanded view"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitModal;