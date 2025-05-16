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
      <div className={`bg-gradient-to-r ${visit.status === 'in-progress' ? 'from-amber-500 to-orange-600' : 'from-[#01b9d4] to-[#0197d4]'} -mx-6 -mt-6 p-6 text-white rounded-t-xl`}>
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

      {/* Vitals Row */}
      <div className="w-full">
        <VitalsDisplay vitals={visit.vitals} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Clinical Information */}
        <div className="col-span-8">
          <Card className="bg-white shadow-xl h-full">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center text-2xl font-bold">
                <Stethoscope size={24} className="mr-3 text-[#01b9d4]" />
                Clinical Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                  <Clipboard size={18} className="mr-2 text-[#01b9d4]" />
                  Chief Complaint
                </h4>
                <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                  {visit.chief_complaint}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                  <Brain size={18} className="mr-2 text-[#01b9d4]" />
                  Diagnosis
                </h4>
                <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                  {visit.diagnosis}
                </p>
              </div>

              {visit.treatment_plan && (
                <div className="space-y-2">
                  <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                    <Activity size={18} className="mr-2 text-[#01b9d4]" />
                    Treatment Plan
                  </h4>
                  <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                    {visit.treatment_plan}
                  </p>
                </div>
              )}

              {visit.prescription && (
                <div className="space-y-2">
                  <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                    <Pill size={18} className="mr-2 text-[#01b9d4]" />
                    Prescription
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-gray-600 whitespace-pre-wrap font-sans">
                      {visit.prescription}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lab Results and Media */}
        <div className="col-span-4 space-y-6">
          {/* Lab Results Summary */}
          {visit.lab_results?.length > 0 && (
            <Card className="bg-gray-50">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center text-2xl font-bold">
                  <Microscope size={24} className="mr-3 text-[#01b9d4]" />
                  Lab Results
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {visit.lab_results.map((result: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm"
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
            <Card className="bg-gray-50">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center text-2xl font-bold">
                  <ImageIcon size={24} className="mr-3 text-[#01b9d4]" />
                  Imaging
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  {visit.media.map((item: any, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={item.url}
                        alt={item.description}
                        className="w-full h-32 object-cover rounded-lg shadow-sm"
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