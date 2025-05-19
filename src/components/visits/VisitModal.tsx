import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity,
  FileText, 
  Clock,
  User,
  Heart,
  Thermometer,
  Stethoscope,
  Pill,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  ImageIcon,
  Microscope,
  Calendar,
  ArrowRight,
  ChevronRight,
  Clipboard,
  Brain,
  Trash2,
  Download
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { supabase } from '../../lib/supabase';

interface VisitModalProps {
  visit: any;
  onClose: () => void;
  onStatusChange: (status: 'completed' | 'in-progress') => void;
  onEdit: () => void;
  onDelete?: () => void;
}

const VisitModal: React.FC<VisitModalProps> = ({ visit, onClose, onStatusChange, onEdit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'warning';
      default:
        return 'error';
    }
  };

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
                <Calendar size={16} className="mr-2" />
                {new Date(visit.visit_date).toLocaleDateString()}
              </div>
              <div className="flex items-center">
                <Clock size={16} className="mr-2" />
                {visit.visit_time}
              </div>
              <div className="flex items-center">
                <User size={16} className="mr-2" />
                {visit.doctor_name || 'No doctor assigned'}
              </div>
            </div>
          </div>
          <Badge
            variant={getStatusColor(visit.status)}
            size="sm"
            className="uppercase tracking-wider"
          >
            {visit.status}
          </Badge>
        </div>
      </div>

      {/* Vitals Row */}
      {visit.vitals && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Activity size={18} className="mr-2 text-[#01b9d4]" />
              Vitals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {visit.vitals.blood_pressure && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Blood Pressure</div>
                  <div className="text-lg font-semibold">{visit.vitals.blood_pressure} mmHg</div>
                </div>
              )}
              {visit.vitals.temperature && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Temperature</div>
                  <div className="text-lg font-semibold">{visit.vitals.temperature}°C</div>
                </div>
              )}
              {visit.vitals.pulse_rate && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Pulse Rate</div>
                  <div className="text-lg font-semibold">{visit.vitals.pulse_rate} bpm</div>
                </div>
              )}
              {visit.vitals.respiratory_rate && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Respiratory Rate</div>
                  <div className="text-lg font-semibold">{visit.vitals.respiratory_rate} /min</div>
                </div>
              )}
              {visit.vitals.weight && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Weight</div>
                  <div className="text-lg font-semibold">{visit.vitals.weight} kg</div>
                </div>
              )}
              {visit.vitals.height && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Height</div>
                  <div className="text-lg font-semibold">{visit.vitals.height} cm</div>
                </div>
              )}
              {visit.vitals.bmi && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">BMI</div>
                  <div className="text-lg font-semibold">{visit.vitals.bmi}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
              {visit.prescription && (
                <div>
                  <h4 className="flex items-center text-sm font-semibold mb-2 text-gray-800">
                    <Pill size={18} className="mr-2 text-red-500" />
                    Prescription
                  </h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-line">
                    {visit.prescription}
                  </p>
                </div>
              )}

              {/* Additional Notes */}
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
            </CardContent>
          </Card>
        </div>

        {/* Lab Results and Media */}
        <div className="col-span-4 space-y-6">
          {/* Lab Results */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center">
                <Microscope size={24} className="mr-3 text-[#01b9d4]" />
                Lab Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visit.lab_results?.length > 0 ? (
                <div className="space-y-4">
                  {visit.lab_results.map((result: any, index: number) => (
                    <div 
                      key={index}
                      className="bg-white rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="bg-blue-50 p-2 rounded-lg mr-3">
                            <Microscope size={16} className="text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Result #{index + 1}</p>
                            <p className="text-sm text-gray-500">{new Date(result.date).toLocaleDateString()}</p>
                          </div>
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
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{result.name}</p>
                          <p className="text-sm text-gray-600">
                            {result.value} {result.unit}
                            {result.reference_range && (
                              <span className="ml-2 text-gray-400">
                                (Ref: {result.reference_range})
                              </span>
                            )}
                          </p>
                        </div>
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
              <CardTitle className="text-xl font-bold flex items-center">
                <ImageIcon size={24} className="mr-3 text-[#01b9d4]" />
                Media Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visit.media?.length > 0 ? (
                <div className="space-y-4">
                  {visit.media.map((item: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="bg-purple-50 p-2 rounded-lg mr-3">
                            <ImageIcon size={16} className="text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Media #{index + 1}</p>
                            <p className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge variant="azure" size="sm">
                          {item.type}
                        </Badge>
                      </div>
                      {item.url && (
                        <div className="relative">
                          <img
                            src={item.url}
                            alt={item.description || `Media ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2"
                          >
                            <Button size="sm" variant="outline" className="bg-white/80">
                              <Download size={14} className="mr-1" />
                              Download
                            </Button>
                          </a>
                        </div>
                      )}
                      {item.description && (
                        <p className="mt-2 text-sm text-gray-600">
                          {item.description}
                        </p>
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
    </div>
  );
};

export default VisitModal;