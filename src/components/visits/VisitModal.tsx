import React from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Activity,
  Clipboard,
  Clock,
  Edit3,
  Heart,
  ImageIcon,
  Microscope,
  Pill,
  Stethoscope,
  User,
  Brain,
  CheckCircle2,
  XCircle
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
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="relative bg-white/[0.75] backdrop-blur-md rounded-2xl shadow-2xl max-w-3xl w-full mx-auto overflow-hidden"
    >
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-[#45d2de] to-[#a999d4] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-extrabold text-white drop-shadow">
              {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} with {visit.doctor_name}
            </h3>
            <p className="mt-1 text-sm text-white/90">
              {format(new Date(visit.visit_date), 'MMM d, yyyy')} at {visit.visit_time}
            </p>
          </div>
          <Badge
            variant={getStatusColor(visit.status)}
            size="sm"
            className="uppercase tracking-wider bg-white/[0.2] text-white"
          >
            {visit.status}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Clinical Information */}
        <Card className="bg-white/[0.6] backdrop-blur-sm border border-white/[0.3] rounded-lg shadow-lg">
          <CardHeader className="border-b border-white/[0.3]">
            <CardTitle className="flex items-center text-lg text-gray-800">
              <Stethoscope size={18} className="mr-2 text-[#45d2de]" />
              Clinical Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {[
              ['Chief Complaint', visit.chief_complaint, Clipboard],
              ['Diagnosis', visit.diagnosis, Brain],
              ['Treatment Plan', visit.treatment_plan, Activity],
              ['Prescription', visit.prescription, Pill]
            ].map(([label, value, Icon], idx) =>
              value ? (
                <div key={idx} className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Icon size={14} className="mr-2 text-[#45d2de]" />
                    {label}
                  </h4>
                  {label === 'Prescription' ? (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <pre className="text-gray-700 whitespace-pre-wrap font-sans">
                        {value}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{value}</p>
                  )}
                </div>
              ) : null
            )}
          </CardContent>
        </Card>

        {/* Vitals & Labs/Media */}
        <div className="space-y-6">
          {/* Vitals */}
          <Card className="bg-white/[0.6] backdrop-blur-sm border border-white/[0.3] rounded-lg shadow-lg">
            <CardHeader className="border-b border-white/[0.3]">
              <CardTitle className="flex items-center text-lg text-gray-800">
                <Heart size={18} className="mr-2 text-[#45d2de]" />
                Vitals
            </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <VitalsDisplay vitals={visit.vitals} />
            </CardContent>
          </Card>

          {/* Lab Results */}
          {visit.lab_results?.length > 0 && (
            <Card className="bg-white/[0.6] backdrop-blur-sm border border-white/[0.3] rounded-lg shadow-lg">
              <CardHeader className="border-b border-white/[0.3]">
                <CardTitle className="flex items-center text-lg text-gray-800">
                  <Microscope size={18} className="mr-2 text-[#a999d4]" />
                  Lab Results
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {visit.lab_results.map((result: any, i: number) => (
                  <div
                    key={i}
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
                        result.status === 'normal'
                          ? 'success'
                          : result.status === 'high'
                          ? 'warning'
                          : result.status === 'low'
                          ? 'azure'
                          : 'error'
                      }
                      size="sm"
                    >
                      {result.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Media Gallery */}
          {visit.media?.length > 0 && (
            <Card className="bg-white/[0.6] backdrop-blur-sm border border-white/[0.3] rounded-lg shadow-lg">
              <CardHeader className="border-b border-white/[0.3]">
                <CardTitle className="flex items-center text-lg text-gray-800">
                  <ImageIcon size={18} className="mr-2 text-[#a999d4]" />
                  Media
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  {visit.media.map((item: any, idx: number) => (
                    <div key={idx} className="relative group">
                      <img
                        src={item.url}
                        alt={item.description}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <p className="text-white text-sm text-center p-2">{item.description}</p>
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
      <div className="flex justify-between items-center p-4 border-t border-white/[0.3] bg-white/[0.4]">
        <div className="space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-800 hover:bg-white/[0.6]"
            onClick={() => onStatusChange('completed')}
            disabled={visit.status === 'completed'}
          >
            <CheckCircle2 size={16} className="mr-2" /> Complete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-800 hover:bg-white/[0.6]"
            onClick={() => onStatusChange('in-progress')}
            disabled={visit.status === 'in-progress'}
          >
            <Clock size={16} className="mr-2" /> In Progress
          </Button>
        </div>
        <div className="space-x-2">
          <Button variant="ghost" size="sm" className="text-gray-800 hover:bg-white/[0.6]" onClick={onClose}>
            <XCircle size={16} className="mr-2" /> Close
          </Button>
          <Button size="sm" className="bg-[#45d2de] text-white hover:opacity-90" onClick={onEdit}>
            <Edit3 size={16} className="mr-2" /> Edit
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default VisitModal;
