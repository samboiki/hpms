import React from 'react';
import { format } from 'date-fns';
import { 
  Activity,
  FileText, 
  Clock,
  User,
  Heart,
  Thermometer,
  Stethoscope,
  Pill,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
  ImageIcon,
  Microscope
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface VisitModalProps {
  visit: any;
  onClose: () => void;
  onStatusChange: (status: 'completed' | 'in-progress') => void;
  onEdit: () => void;
}

const VisitModal: React.FC<VisitModalProps> = ({ visit, onClose, onStatusChange, onEdit }) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
          </h2>
          <p className="text-gray-500">
            {format(new Date(visit.visit_date), 'MMMM d, yyyy')} at {visit.visit_time}
          </p>
        </div>
        <Badge variant={getStatusColor(visit.status)} size="sm">
          {visit.status}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('completed')}
            disabled={visit.status === 'completed'}
          >
            <CheckCircle size={14} className="mr-2" />
            Complete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('in-progress')}
            disabled={visit.status === 'in-progress'}
          >
            <Clock size={14} className="mr-2" />
            In Progress
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
        >
          <Edit3 size={14} className="mr-2" />
          Edit Visit
        </Button>
      </div>

      {/* Visit Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Stethoscope size={18} className="mr-2" />
              Clinical Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Chief Complaint</h4>
              <p className="mt-1 text-gray-900">{visit.chief_complaint}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Diagnosis</h4>
              <p className="mt-1 text-gray-900">{visit.diagnosis}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700">Treatment Plan</h4>
              <p className="mt-1 text-gray-900">{visit.treatment_plan}</p>
            </div>

            {visit.prescription && (
              <div>
                <h4 className="text-sm font-medium text-gray-700">Prescription</h4>
                <p className="mt-1 text-gray-900">{visit.prescription}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vitals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Heart size={18} className="mr-2" />
              Vitals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {visit.vitals?.blood_pressure && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Blood Pressure</p>
                  <p className="text-lg font-medium">{visit.vitals.blood_pressure}</p>
                </div>
              )}
              
              {visit.vitals?.temperature && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Temperature</p>
                  <p className="text-lg font-medium">{visit.vitals.temperature}°C</p>
                </div>
              )}
              
              {visit.vitals?.pulse_rate && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Pulse Rate</p>
                  <p className="text-lg font-medium">{visit.vitals.pulse_rate} bpm</p>
                </div>
              )}
              
              {visit.vitals?.respiratory_rate && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Respiratory Rate</p>
                  <p className="text-lg font-medium">{visit.vitals.respiratory_rate} /min</p>
                </div>
              )}
              
              {visit.vitals?.weight && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Weight</p>
                  <p className="text-lg font-medium">{visit.vitals.weight} kg</p>
                </div>
              )}
              
              {visit.vitals?.height && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Height</p>
                  <p className="text-lg font-medium">{visit.vitals.height} cm</p>
                </div>
              )}
              
              {visit.vitals?.bmi && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">BMI</p>
                  <p className="text-lg font-medium">{visit.vitals.bmi}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lab Results */}
        {visit.lab_results && visit.lab_results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Microscope size={18} className="mr-2" />
                Lab Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {visit.lab_results.map((result: any) => (
                  <div key={result.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{result.name}</h4>
                        <p className="text-sm text-gray-500">
                          {format(new Date(result.date), 'MMM d, yyyy')}
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
                    <div className="mt-2">
                      <p className="text-sm">
                        <span className="font-medium">{result.value}</span> {result.unit}
                      </p>
                      <p className="text-xs text-gray-500">
                        Reference Range: {result.reference_range}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Media */}
        {visit.media && visit.media.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon size={18} className="mr-2" />
                Media
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {visit.media.map((item: any) => (
                  <div key={item.id} className="relative">
                    <img
                      src={item.url}
                      alt={item.description}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs">{format(new Date(item.date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default VisitModal;