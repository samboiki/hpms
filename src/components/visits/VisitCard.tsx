import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  FileText, 
  Image as ImageIcon, 
  Microscope, 
  ChevronRight, 
  ArrowRight,
  Repeat,
  Calendar,
  User,
  Clock,
  FileSymlink,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Viewer from 'react-viewer';

interface VisitMedia {
  id: string;
  type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
  url: string;
  description: string;
  date: string;
}

interface LabResult {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  date: string;
}

interface Visit {
  id: string;
  date: string;
  time: string;
  type: 'new' | 'follow-up';
  doctor: {
    name: string;
    specialty: string;
  };
  chiefComplaint: string;
  diagnosis: string;
  notes: string;
  prescription?: string;
  labResults: LabResult[];
  media: VisitMedia[];
  followUpDate?: string;
}

interface Props {
  visit: Visit;
}

const VisitCard: React.FC<Props> = ({ visit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  return (
    <Card className="mb-6 overflow-hidden transition-all duration-300">
      <CardHeader 
        className={`
          ${visit.type === 'new' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100' : 
           'bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100'}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Badge 
              variant={visit.type === 'new' ? 'azure' : 'success'}
              size="sm"
            >
              {visit.type === 'new' ? 'New Visit' : 'Follow-up'}
            </Badge>
            <div className="text-sm text-gray-500">
              {format(new Date(visit.date), 'MMM d, yyyy')} at {visit.time}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'View Details'}
            <ChevronRight 
              size={16} 
              className={`ml-1 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className={`${isExpanded ? 'block' : 'hidden'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
          {/* Visit Details */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Visit Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex items-start">
                  <User size={16} className="text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{visit.doctor.name}</p>
                    <p className="text-xs text-gray-500">{visit.doctor.specialty}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <FileText size={16} className="text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Chief Complaint</p>
                    <p className="text-sm text-gray-600">{visit.chiefComplaint}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Microscope size={16} className="text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Diagnosis</p>
                    <p className="text-sm text-gray-600">{visit.diagnosis}</p>
                  </div>
                </div>

                {visit.followUpDate && (
                  <div className="flex items-start">
                    <Calendar size={16} className="text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Follow-up Date</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(visit.followUpDate), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lab Results */}
            {visit.labResults.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lab Results</h3>
                <div className="space-y-3">
                  {visit.labResults.map((result) => (
                    <div 
                      key={result.id}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{result.name}</h4>
                          <div className="flex items-center mt-1">
                            <span className="text-sm font-medium text-gray-900">{result.value}</span>
                            <span className="text-xs text-gray-500 ml-1">{result.unit}</span>
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
                      <p className="text-xs text-gray-500 mt-2">
                        Reference Range: {result.referenceRange}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Media and Notes */}
          <div className="space-y-6">
            {/* Media Gallery */}
            {visit.media.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Media</h3>
                <div className="grid grid-cols-2 gap-4">
                  {visit.media.map((media, index) => (
                    <div 
                      key={media.id}
                      className="relative group cursor-pointer"
                      onClick={() => {
                        setActiveImageIndex(index);
                        setViewerVisible(true);
                      }}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img 
                          src={media.url} 
                          alt={media.description}
                          className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                        <div className="bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon size={16} className="text-gray-600" />
                        </div>
                      </div>
                      <div className="mt-2">
                        <Badge variant="glass" size="sm">
                          {media.type.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{media.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Viewer
                  visible={viewerVisible}
                  onClose={() => setViewerVisible(false)}
                  images={visit.media.map(m => ({ src: m.url, alt: m.description }))}
                  activeIndex={activeImageIndex}
                  downloadable
                  downloadInNewWindow
                  onMaskClick={() => setViewerVisible(false)}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 whitespace-pre-line">{visit.notes}</p>
              </div>
            </div>

            {/* Prescription */}
            {visit.prescription && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Prescription</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {visit.prescription}
                  </p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Download size={14} className="mr-2" />
                    Download Prescription
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VisitCard;