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
  Brain
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import VitalsDisplay from '../patients/VitalsDisplay';

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
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#01b9d4] to-[#0197d4] -mx-6 -mt-6 p-6 text-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">
              {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
            </h3>
            <div className="flex items-center mt-2 space-x-4 text-white/80">
              <div className="flex items-center">
                <Calendar size={16} className="mr-2" />
                {format(new Date(visit.visit_date), 'MMMM d, yyyy')}
              </div>
              <div className="flex items-center">
                <Clock size={16} className="mr-2" />
                {visit.visit_time}
              </div>
              <div className="flex items-center">
                <User size={16} className="mr-2" />
                {visit.doctor_name}
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

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clinical Information */}
        <Card className="bg-white/[0.75] backdrop-blur-md shadow-xl">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center text-lg">
              <Stethoscope size={18} className="mr-2 text-[#01b9d4]" />
              Clinical Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                <Clipboard size={14} className="mr-2 text-[#01b9d4]" />
                Chief Complaint
              </h4>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                {visit.chief_complaint}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                <Brain size={14} className="mr-2 text-[#01b9d4]" />
                Diagnosis
              </h4>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                {visit.diagnosis}
              </p>
            </div>

            {visit.treatment_plan && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <Activity size={14} className="mr-2 text-[#01b9d4]" />
                  Treatment Plan
                </h4>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {visit.treatment_plan}
                </p>
              </div>
            )}

            {visit.prescription && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <Pill size={14} className="mr-2 text-[#01b9d4]" />
                  Prescription
                </h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <pre className="text-gray-600 whitespace-pre-wrap font-sans">
                    {visit.prescription}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vitals */}
        <div className="space-y-6">
          <Card className="bg-white/[0.75] backdrop-blur-md shadow-xl">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center text-lg">
                <Heart size={18} className="mr-2 text-[#01b9d4]" />
                Vitals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <VitalsDisplay vitals={visit.vitals} />
            </CardContent>
          </Card>

          {/* Lab Results Summary */}
          {visit.lab_results?.length > 0 && (
            <Card className="bg-white/[0.75] backdrop-blur-md shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center text-lg">
                  <Microscope size={18} className="mr-2 text-[#01b9d4]" />
                  Lab Results
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {visit.lab_results.map((result: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{result.name}</p>
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
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Media Gallery */}
          {visit.media?.length > 0 && (
            <Card className="bg-white/[0.75] backdrop-blur-md shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center text-lg">
                  <ImageIcon size={18} className="mr-2 text-[#01b9d4]" />
                  Media
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  {visit.media.map((item: any, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={item.url}
                        alt={item.description}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <p className="text-white text-sm text-center p-2">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('completed')}
            disabled={visit.status === 'completed'}
          >
            <CheckCircle2 size={16} className="mr-2" />
            Complete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('in-progress')}
            disabled={visit.status === 'in-progress'}
          >
            <Clock size={16} className="mr-2" />
            In Progress
          </Button>
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <XCircle size={16} className="mr-2" />
            Close
          </Button>
          <Button onClick={onEdit}>
            <Edit3 size={16} className="mr-2" />
            Edit Visit
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VisitModal;