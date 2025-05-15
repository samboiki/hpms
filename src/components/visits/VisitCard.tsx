import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Stethoscope, 
  Clock, 
  ChevronRight,
  Pill,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileSymlink,
  Download
} from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
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
  status: 'normal' | 'abnormal' | 'critical';
  date: string;
}

interface Visit {
  id: string;
  date: string;
  type: 'new' | 'follow-up';
  doctor: {
    name: string;
    specialty: string;
    avatar?: string;
  };
  chiefComplaint: string;
  diagnosis: string;
  notes: string;
  prescription?: {
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
    instructions: string;
  };
  labResults: LabResult[];
  media: VisitMedia[];
  vitals: {
    bloodPressure: string;
    temperature: number;
    heartRate: number;
    respiratoryRate: number;
    oxygenSaturation: number;
  };
  followUpDate?: string;
}

interface VisitCardProps {
  visit: Visit;
  expanded?: boolean;
}

const VisitCard: React.FC<VisitCardProps> = ({ visit, expanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [activeTab, setActiveTab] = useState<'overview' | 'labs' | 'media'>('overview');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const getStatusColor = (status: LabResult['status']) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'abnormal':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'glass';
    }
  };

  const getStatusIcon = (status: LabResult['status']) => {
    switch (status) {
      case 'normal':
        return <CheckCircle size={14} />;
      case 'abnormal':
        return <AlertCircle size={14} />;
      case 'critical':
        return <XCircle size={14} />;
      default:
        return null;
    }
  };

  return (
    <Card className={`mb-4 transition-all duration-300 ${isExpanded ? 'shadow-lg' : 'hover:shadow-md'}`}>
      <CardContent className="p-0">
        {/* Visit Header */}
        <div 
          className="p-4 cursor-pointer flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-4">
            <div className={`p-2 rounded-full ${
              visit.type === 'new' ? 'bg-brand-light text-brand-primary' : 'bg-purple-50 text-purple-600'
            }`}>
              {visit.type === 'new' ? <Stethoscope size={20} /> : <Clock size={20} />}
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-gray-900">
                  {visit.chiefComplaint}
                </h3>
                <Badge 
                  variant={visit.type === 'new' ? 'azure' : 'lavender'}
                  size="sm"
                >
                  {visit.type === 'new' ? 'New Visit' : 'Follow-up'}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {new Date(visit.date).toLocaleDateString()} • {visit.doctor.name}
              </p>
            </div>
          </div>
          
          <ChevronRight 
            size={20} 
            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
          />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-100">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'overview'
                    ? 'text-brand-primary border-b-2 border-brand-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'labs'
                    ? 'text-brand-primary border-b-2 border-brand-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('labs')}
              >
                Lab Results
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'media'
                    ? 'text-brand-primary border-b-2 border-brand-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('media')}
              >
                Media
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Vitals */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Vitals</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Blood Pressure</p>
                        <p className="text-lg font-medium">{visit.vitals.bloodPressure}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Temperature</p>
                        <p className="text-lg font-medium">{visit.vitals.temperature}°C</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Heart Rate</p>
                        <p className="text-lg font-medium">{visit.vitals.heartRate} bpm</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Respiratory Rate</p>
                        <p className="text-lg font-medium">{visit.vitals.respiratoryRate} /min</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">O2 Saturation</p>
                        <p className="text-lg font-medium">{visit.vitals.oxygenSaturation}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis & Notes */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Diagnosis & Notes</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-900 mb-2">{visit.diagnosis}</p>
                      <p className="text-gray-600 text-sm">{visit.notes}</p>
                    </div>
                  </div>

                  {/* Prescription */}
                  {visit.prescription && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Prescription</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-3">
                          {visit.prescription.medications.map((med, index) => (
                            <div key={index} className="flex items-start">
                              <Pill size={16} className="text-brand-primary mt-1 mr-2" />
                              <div>
                                <p className="font-medium text-gray-900">{med.name}</p>
                                <p className="text-sm text-gray-600">
                                  {med.dosage} • {med.frequency} • {med.duration}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-sm text-gray-600">
                          <strong>Instructions:</strong> {visit.prescription.instructions}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Follow-up */}
                  {visit.followUpDate && (
                    <div className="flex items-center justify-between bg-brand-light p-4 rounded-lg">
                      <div className="flex items-center">
                        <Clock size={20} className="text-brand-primary mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Follow-up Appointment</p>
                          <p className="text-sm text-gray-600">
                            {new Date(visit.followUpDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button size="sm">
                        Schedule
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'labs' && (
                <div className="space-y-4">
                  {visit.labResults.map((result) => (
                    <div 
                      key={result.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{result.name}</p>
                        <div className="flex items-center mt-1">
                          <span className="text-lg font-medium text-gray-900">
                            {result.value}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">
                            {result.unit}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            ({result.referenceRange})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge
                          variant={getStatusColor(result.status)}
                          size="sm"
                        >
                          <span className="flex items-center">
                            {getStatusIcon(result.status)}
                            <span className="ml-1">{result.status}</span>
                          </span>
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <FileSymlink size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'media' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {visit.media.map((item, index) => (
                    <div 
                      key={item.id}
                      className="relative group cursor-pointer"
                      onClick={() => {
                        setActiveImageIndex(index);
                        setViewerVisible(true);
                      }}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img 
                          src={item.url} 
                          alt={item.description}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                        <Download 
                          size={20} 
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{item.type.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Image Viewer */}
      <Viewer
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        images={visit.media.map(item => ({
          src: item.url,
          alt: item.description
        }))}
        activeIndex={activeImageIndex}
        zIndex={1000}
      />
    </Card>
  );
};

export default VisitCard;