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
  Brain,
} from 'lucide-react';

import Button from '../ui/Button'; // Assuming Button component path
import Badge from '../ui/Badge';   // Assuming Badge component path
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'; // Assuming Card component path

interface VisitModalProps {
  visit: any; // Consider defining a more specific type for visit
  onClose: () => void;
  onStatusChange: (status: 'completed' | 'in-progress') => void;
  onEdit: () => void;
}

const VisitModal: React.FC<VisitModalProps> = ({ visit, onClose, onStatusChange, onEdit }) => {
  const getStatusColorClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-500';
      case 'in-progress':
        return 'bg-yellow-500';
      case 'pending':
        return 'bg-orange-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getLabResultBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'normal':
        return 'success';
      case 'high':
        return 'warning';
      case 'low':
        return 'info'; // Or 'azure' if you have it, or another blueish variant
      case 'abnormal':
        return 'error';
      default:
        return 'default';
    }
  };

  // Fallback for potentially missing data
  const safeVisit = {
    vitals: {},
    lab_results: [],
    media: [],
    ...visit,
  };

  return (
    // Outer modal shell for positioning and overlay
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-auto transform transition-all duration-300 ease-in-out flex flex-col max-h-[90vh]">
        {/* Header Section */}
        <div
          className={`bg-gradient-to-r ${
            safeVisit.status === 'in-progress'
              ? 'from-amber-500 to-orange-600'
              : 'from-[#01b9d4] to-[#0197d4]'
          } p-6 text-white rounded-t-xl`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold">
                {safeVisit.visit_type
                  ? safeVisit.visit_type.charAt(0).toUpperCase() +
                    safeVisit.visit_type.slice(1)
                  : 'Visit'}{' '}
                Details
              </h2>
              <div className="flex items-center space-x-4 text-sm opacity-90 mt-1">
                {safeVisit.visit_date && (
                  <div className="flex items-center">
                    <Calendar size={16} className="mr-1.5" />
                    {format(new Date(safeVisit.visit_date), 'MMMM d, yyyy')}
                  </div>
                )}
                {safeVisit.visit_time && (
                  <div className="flex items-center">
                    <Clock size={16} className="mr-1.5" />
                    {safeVisit.visit_time}
                  </div>
                )}
              </div>
              {safeVisit.doctor_name && (
                <div className="flex items-center text-sm opacity-90 mt-1">
                  <User size={16} className="mr-1.5" /> Dr.{' '}
                  {safeVisit.doctor_name}
                </div>
              )}
            </div>
            {safeVisit.status && (
              <Badge
                variant={getStatusColor(safeVisit.status)} // Ensure your Badge accepts color class via variant or has specific variants
                size="lg"
                className={`px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusColorClass(safeVisit.status)} text-white`}
              >
                {safeVisit.status.replace('-', ' ').toUpperCase()}
              </Badge>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-grow p-6 space-y-6">
          {/* Vitals Row - Compact and on one line */}
          <div className="bg-gray-50 p-3 rounded-lg mb-6 shadow-sm">
             <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1 flex items-center">
                <Heart size={16} className="mr-2 text-[#01b9d4]" /> Vitals
             </h3>
            <div className="flex flex-nowrap items-center gap-x-4 sm:gap-x-5 overflow-x-auto pb-2 -mb-2 custom-scrollbar">
              {safeVisit.vitals?.blood_pressure ? (
                <div className="flex items-baselinewhitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">BP:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.blood_pressure} mmHg
                  </span>
                </div>
              ) : null}
              {safeVisit.vitals?.temperature ? (
                <div className="flex items-baseline whitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">Temp:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.temperature}°C
                  </span>
                </div>
              ) : null}
              {safeVisit.vitals?.pulse_rate ? (
                <div className="flex items-baseline whitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">Pulse:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.pulse_rate} bpm
                  </span>
                </div>
              ) : null}
              {safeVisit.vitals?.respiratory_rate ? (
                <div className="flex items-baseline whitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">RR:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.respiratory_rate} /min
                  </span>
                </div>
              ) : null}
              {safeVisit.vitals?.weight ? (
                <div className="flex items-baseline whitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">Wt:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.weight} kg
                  </span>
                </div>
              ) : null}
              {safeVisit.vitals?.height ? (
                <div className="flex items-baseline whitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">Ht:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.height} cm
                  </span>
                </div>
              ) : null}
              {safeVisit.vitals?.bmi ? (
                <div className="flex items-baseline whitespace-nowrap">
                  <span className="text-xs text-gray-500 mr-1">BMI:</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {safeVisit.vitals.bmi}
                  </span>
                </div>
              ) : null}
              {Object.keys(safeVisit.vitals || {}).length === 0 && (
                 <p className="text-xs text-gray-500 px-1">No vitals recorded for this visit.</p>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Clinical Information */}
            <div className="md:col-span-7"> {/* Adjusted span for potentially more space */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-[#01b9d4] flex items-center">
                    <Stethoscope size={24} className="mr-3" />
                    Clinical Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {safeVisit.chief_complaint && (
                    <div>
                      <h4 className="text-md font-semibold mb-1.5 flex items-center text-gray-700"><AlertCircle size={18} className="mr-2 text-gray-500"/>Chief Complaint</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md text-sm">
                        {safeVisit.chief_complaint}
                      </p>
                    </div>
                  )}

                  {safeVisit.diagnosis && (
                    <div>
                      <h4 className="text-md font-semibold mb-1.5 flex items-center text-gray-700"><Brain size={18} className="mr-2 text-gray-500"/>Diagnosis</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md text-sm">
                        {safeVisit.diagnosis}
                      </p>
                    </div>
                  )}

                  {safeVisit.treatment_plan && (
                    <div>
                      <h4 className="text-md font-semibold mb-1.5 flex items-center text-gray-700"><Activity size={18} className="mr-2 text-gray-500"/>Treatment Plan</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md text-sm">
                        {safeVisit.treatment_plan}
                      </p>
                    </div>
                  )}

                  {safeVisit.prescription && (
                    <div>
                      <h4 className="text-md font-semibold mb-1.5 flex items-center text-gray-700"><Pill size={18} className="mr-2 text-gray-500" />Prescription</h4>
                      <div className="text-gray-700 bg-gray-50 p-3 rounded-md text-sm">
                        <pre className="whitespace-pre-wrap font-sans">{safeVisit.prescription}</pre>
                      </div>
                    </div>
                  )}

                  {safeVisit.notes && (
                    <div>
                      <h4 className="text-md font-semibold mb-1.5 flex items-center text-gray-700"><Clipboard size={18} className="mr-2 text-gray-500" />Additional Notes</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap text-sm">
                        {safeVisit.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lab Results and Media */}
            <div className="md:col-span-5 space-y-6"> {/* Adjusted span */}
              {/* Lab Results */}
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center text-gray-800">
                    <Microscope size={20} className="mr-2 text-[#01b9d4]" />
                    Lab Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {safeVisit.lab_orders_status === 'pending' && (!safeVisit.lab_results || safeVisit.lab_results.length === 0) && (
                    <div className="text-center py-5 text-gray-500">
                      <Clock size={28} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">Lab results are pending.</p>
                    </div>
                  )}
                  {safeVisit.lab_orders_status !== 'pending' && (!safeVisit.lab_results || safeVisit.lab_results.length === 0) && (
                    <div className="text-center py-5 text-gray-500">
                      <Microscope size={28} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No lab results available.</p>
                    </div>
                  )}
                  {safeVisit.lab_results?.length > 0 && (
                    <div className="space-y-2.5">
                      {safeVisit.lab_results.map((result: any, index: number) => (
                        <div key={index} className="bg-gray-50 rounded-md p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{result.name}</p>
                              {result.status === 'pending' ? (
                                <p className="text-xs text-orange-600 italic">Status: Pending</p>
                              ) : result.status === 'unavailable' ? (
                                <p className="text-xs text-gray-500 italic">Status: Result Unavailable</p>
                              ) : (
                                <p className="text-xs text-gray-600">
                                  {result.value} {result.unit}
                                  {result.reference_range && (
                                    <span className="ml-1.5 text-gray-400">
                                      (Ref: {result.reference_range})
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            {result.status && result.status !== 'pending' && result.status !== 'unavailable' && (
                               <Badge
                                variant={getLabResultBadgeVariant(result.status)}
                                size="xs" // smaller badge
                              >
                                {result.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Media Gallery */}
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center text-gray-800">
                    <ImageIcon size={20} className="mr-2 text-[#01b9d4]" />
                    Imaging
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {safeVisit.imaging_orders_status === 'pending' && (!safeVisit.media || safeVisit.media.length === 0) && (
                     <div className="text-center py-5 text-gray-500">
                      <Clock size={28} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">Imaging results are pending.</p>
                    </div>
                  )}
                  {safeVisit.imaging_orders_status !== 'pending' && (!safeVisit.media || safeVisit.media.length === 0) && (
                    <div className="text-center py-5 text-gray-500">
                      <ImageIcon size={28} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No imaging available.</p>
                    </div>
                  )}
                  {safeVisit.media?.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {safeVisit.media.map((item: any, index: number) => (
                        <div key={index} className="relative group aspect-square">
                          <img
                            src={item.url || 'https://via.placeholder.com/150?text=No+Image'} // Fallback image
                            alt={item.description || 'Imaging result'}
                            className="w-full h-full object-cover rounded-lg shadow-sm"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 rounded-lg flex flex-col items-center justify-center p-2 text-center">
                            {item.description && (
                              <p className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                                {item.description}
                              </p>
                            )}
                            {item.status === 'pending_review' && (
                              <Badge variant="warning" size="xs" className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity delay-100">Pending Review</Badge>
                            )}
                             {item.status === 'no_result' && (
                              <Badge variant="default" size="xs" className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity delay-100">Not Available</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex justify-between items-center">
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('completed')}
                disabled={safeVisit.status === 'completed'}
                className="disabled:opacity-60"
              >
                <CheckCircle2 size={16} className="mr-2" />
                Mark as Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('in-progress')}
                disabled={safeVisit.status === 'in-progress'}
                 className="disabled:opacity-60"
              >
                <Clock size={16} className="mr-2" />
                Mark In Progress
              </Button>
            </div>
            <div className="space-x-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XCircle size={16} className="mr-2" />
                Close
              </Button>
              <Button onClick={onEdit} size="sm" className="bg-[#01b9d4] hover:bg-[#0197d4] text-white">
                <Edit3 size={16} className="mr-2" />
                Edit Visit
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* CSS for custom scrollbar (optional, Tailwind doesn't directly style scrollbars well cross-browser) */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
        /* For Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ccc #f1f1f1;
        }
      `}</style>
    </div>
  );
};

export default VisitModal;