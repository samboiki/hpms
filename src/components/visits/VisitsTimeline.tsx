import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Clock, Activity, FileText, Image } from 'lucide-react';
import { format } from 'date-fns';

interface Visit {
  id: string;
  date: string;
  time: string;
  type: string;
  doctor: {
    name: string;
    specialty: string;
  };
  chiefComplaint: string;
  diagnosis?: string;
  notes?: string;
  prescription?: string;
  labResults?: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
    referenceRange: string;
    status: string;
    date: string;
  }>;
  media?: Array<{
    id: string;
    type: string;
    url: string;
    description: string;
    date: string;
  }>;
  followUpDate?: string;
}

interface VisitsTimelineProps {
  visits: Visit[];
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ visits }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity size={20} className="mr-2" />
          Visit History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {visits.map((visit, index) => (
            <motion.div
              key={visit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-8 pb-8 last:pb-0"
            >
              {/* Timeline connector */}
              {index < visits.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />
              )}
              
              {/* Timeline dot */}
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[#01b9d4] flex items-center justify-center">
                <Clock size={14} className="text-white" />
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {visit.type.charAt(0).toUpperCase() + visit.type.slice(1)} Visit
                    </h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(visit.date), 'MMMM d, yyyy')} at {visit.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{visit.doctor.name}</p>
                    <p className="text-xs text-gray-500">{visit.doctor.specialty}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Chief Complaint</h4>
                    <p className="text-gray-600">{visit.chiefComplaint}</p>
                  </div>

                  {visit.diagnosis && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Diagnosis</h4>
                      <p className="text-gray-600">{visit.diagnosis}</p>
                    </div>
                  )}

                  {visit.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Notes</h4>
                      <p className="text-gray-600 whitespace-pre-line">{visit.notes}</p>
                    </div>
                  )}

                  {visit.prescription && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Prescription</h4>
                      <p className="text-gray-600 whitespace-pre-line">{visit.prescription}</p>
                    </div>
                  )}

                  {visit.labResults && visit.labResults.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Lab Results</h4>
                      <div className="space-y-2">
                        {visit.labResults.map(result => (
                          <div key={result.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{result.name}</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(result.date), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {result.value} {result.unit}
                              </p>
                              <p className="text-xs text-gray-500">
                                Range: {result.referenceRange}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {visit.media && visit.media.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Media</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {visit.media.map(item => (
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
                    </div>
                  )}

                  {visit.followUpDate && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-600">
                        Follow-up scheduled for {format(new Date(visit.followUpDate), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default VisitsTimeline;