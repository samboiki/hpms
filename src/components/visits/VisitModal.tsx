// src/components/visits/VisitModal.tsx
import React from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Activity,
  Clipboard,
  Clock,
  User,
  Heart,
  Stethoscope,
  Pill,
  CheckCircle2,
  XCircle,
  Edit3,
  ImageIcon,
  Microscope,
  Calendar,
  Brain
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface VisitModalProps {
  visit: {
    visit_type: string;
    visit_date: string;
    visit_time: string;
    doctor_name: string;
    status: 'completed' | 'in-progress' | string;
    chief_complaint?: string;
    diagnosis?: string;
    treatment_plan?: string;
    prescription?: string;
    notes?: string;
    vitals?: Record<string, number | string>;
    lab_results?: Array<{
      name: string;
      value: string | number;
      unit?: string;
      reference_range?: string;
      status?: 'normal' | 'high' | 'low' | string;
    }>;
    media?: Array<{ url: string; description?: string }>;
  } | null;
  onClose: () => void;
  onStatusChange: (status: 'completed' | 'in-progress') => void;
  onEdit: () => void;
}

const VisitModal: React.FC<VisitModalProps> = ({
  visit,
  onClose,
  onStatusChange,
  onEdit,
}) => {
  // 1. Never render unless we have a visit object
  if (!visit) return null;

  // 2. Safely default vitals
  const vitals = visit.vitals ?? {};

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
      className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-auto overflow-hidden"
    >
      {/* Fixed Gradient Header */}
      <div className="bg-gradient-to-r from-[#01b9d4] to-[#0197d4] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white">
              {visit.visit_type.charAt(0).toUpperCase() +
                visit.visit_type.slice(1)}{' '}
              Visit
            </h3>
            <div className="flex items-center mt-2 space-x-4 text-white/80 text-sm">
              <div className="flex items-center">
                <Calendar size={16} className="mr-1" />
                {format(new Date(visit.visit_date), 'MMMM d, yyyy')}
              </div>
              <div className="flex items-center">
                <Clock size={16} className="mr-1" />
                {visit.visit_time}
              </div>
              <div className="flex items-center">
                <User size={16} className="mr-1" />
                {visit.doctor_name}
              </div>
            </div>
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

      {/* Scrollable Body */}
      <div className="max-h-[80vh] overflow-y-auto px-6 py-4">
        {/* Vitals on one row */}
        <div className="flex divide-x divide-gray-200 bg-gray-50 p-4 rounded-lg mb-6">
          {Object.entries(vitals).map(([key, val]) => (
            val != null && (
              <div key={key} className="flex-1 px-4 text-center">
                <div className="text-xs text-gray-500 capitalize">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="text-lg font-semibold text-gray-700">
                  {val}
                  {key === 'temperature'
                    ? '°C'
                    : key === 'blood_pressure'
                    ? ' mmHg'
                    : key === 'pulse_rate'
                    ? ' bpm'
                    : key === 'respiratory_rate'
                    ? ' /min'
                    : key === 'weight'
                    ? ' kg'
                    : key === 'height'
                    ? ' cm'
                    : ''}
                </div>
              </div>
            )
          ))}
        </div>

        {/* Main grid: Clinical Info / Labs & Imaging */}
        <div className="grid grid-cols-12 gap-6">
          {/* Clinical Information */}
          <div className="col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-[#01b9d4] flex items-center">
                  <Stethoscope size={24} className="mr-3 text-[#01b9d4]" />
                  Clinical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Chief Complaint */}
                <div>
                  <h4 className="text-lg font-semibold mb-2">
                    Chief Complaint
                  </h4>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {visit.chief_complaint || 'No complaint recorded.'}
                  </p>
                </div>
                {/* Diagnosis */}
                <div>
                  <h4 className="text-lg font-semibold mb-2">Diagnosis</h4>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {visit.diagnosis || 'No diagnosis recorded.'}
                  </p>
                </div>
                {/* Treatment Plan */}
                <div>
                  <h4 className="text-lg font-semibold mb-2">
                    Treatment Plan
                  </h4>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {visit.treatment_plan || 'No treatment plan recorded.'}
                  </p>
                </div>
                {/* Prescription */}
                <div>
                  <h4 className="text-lg font-semibold mb-2">Prescription</h4>
                  <div className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap font-sans">
                      {visit.prescription || 'No prescription provided.'}
                    </pre>
                  </div>
                </div>
                {/* Additional Notes */}
                <div>
                  <h4 className="text-lg font-semibold mb-2">
                    Additional Notes
                  </h4>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {visit.notes || 'No additional notes.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lab Results & Imaging */}
          <div className="col-span-4 space-y-6">
            {/* Lab Results */}
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center text-[#01b9d4]">
                  <Microscope size={24} className="mr-3 text-[#01b9d4]" />
                  Lab Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visit.lab_results?.length ? (
                  <div className="space-y-3">
                    {visit.lab_results.map((r, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {r.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {r.value} {r.unit}
                              {r.reference_range && (
                                <span className="ml-2 text-gray-400">
                                  (Ref: {r.reference_range})
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge
                            variant={
                              r.status === 'normal'
                                ? 'success'
                                : r.status === 'high'
                                ? 'warning'
                                : r.status === 'low'
                                ? 'azure'
                                : 'error'
                            }
                            size="sm"
                          >
                            {r.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Microscope
                      size={32}
                      className="mx-auto mb-2 text-gray-400"
                    />
                    No lab results available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Imaging */}
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center text-[#01b9d4]">
                  <ImageIcon size={24} className="mr-3 text-[#01b9d4]" />
                  Imaging
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visit.media?.length ? (
                  <div className="grid grid-cols-2 gap-4">
                    {visit.media.map((m, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={m.url}
                          alt={m.description}
                          className="w-full h-32 object-cover rounded-lg shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <p className="text-white text-sm text-center p-2">
                            {m.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <ImageIcon
                      size={32}
                      className="mx-auto mb-2 text-gray-400"
                    />
                    No imaging available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-white">
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
          <Button size="sm" className="bg-[#01b9d4] text-white hover:opacity-90" onClick={onEdit}>
            <Edit3 size={16} className="mr-2" />
            Edit Visit
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default VisitModal;
