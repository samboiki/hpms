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
  <div className="flex divide-x divide-gray-200 bg-gray-50 p-4 rounded-lg">
    {[
      {
        key: 'blood_pressure',
        label: 'Blood Pressure',
        value: visit.vitals.blood_pressure,
        unit: 'mmHg',
        isGood: (val: string) => {
          // parse “120/80”
          const [systolic, diastolic] = val?.split('/').map(Number) ?? [];
          return systolic < 120 && diastolic < 80;
        },
      },
      {
        key: 'temperature',
        label: 'Temperature',
        value: visit.vitals.temperature,
        unit: '°C',
        isGood: (val: number) => val >= 36.5 && val <= 37.5,
      },
      {
        key: 'pulse_rate',
        label: 'Pulse Rate',
        value: visit.vitals.pulse_rate,
        unit: 'bpm',
        isGood: (val: number) => val >= 60 && val <= 100,
      },
      {
        key: 'weight',
        label: 'Weight',
        value: visit.vitals.weight,
        unit: 'kg',
        isGood: () => true,   // no “bad” weight coloring here
      },
      {
        key: 'height',
        label: 'Height',
        value: visit.vitals.height,
        unit: 'cm',
        isGood: () => true,
      },
      {
        key: 'bmi',
        label: 'BMI',
        value: visit.vitals.bmi,
        unit: '',
        isGood: (val: number) => val >= 18.5 && val <= 24.9,
      },
    ].map(({ key, label, value, unit, isGood }) =>
      value != null ? (
        <div
          key={key}
          className={`flex-1 px-4 text-center ${
            isGood(value)
              ? 'text-emerald-600'
              : 'text-rose-600'
          }`}
        >
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-lg font-semibold">
            {value}
            {unit}
          </div>
        </div>
      ) : null
    )}
  </div>
)}


      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Clinical Information */}
        <div className="col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-[#01b9d4] flex items-center">
                <Stethoscope size={24} className="mr-3" />
                Clinical Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-2">Chief Complaint</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.chief_complaint}
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-2">Diagnosis</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.diagnosis}
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-2">Treatment Plan</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.treatment_plan}
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-2">Prescription</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {visit.prescription}
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-2">Additional Notes</h4>
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
                Imaging
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visit.media?.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {visit.media.map((item: any, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={item.url || 'https://via.placeholder.com/150'}
                        alt={item.description || 'Medical image'}
                        className="w-full h-32 object-cover rounded-lg shadow-sm"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <p className="text-white text-sm text-center p-2">
                          {item.description || item.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <ImageIcon size={32} className="mx-auto mb-2 text-gray-400" />
                  No images available
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