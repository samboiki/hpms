import React, { useState } from 'react';
import { 
  Search,
  Filter,
  Calendar,
  SortAsc,
  SortDesc
} from 'lucide-react';
import VisitCard from './VisitCard';
import Button from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

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
  labResults: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
    referenceRange: string;
    status: 'normal' | 'abnormal' | 'critical';
    date: string;
  }>;
  media: Array<{
    id: string;
    type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
    url: string;
    description: string;
    date: string;
  }>;
  vitals: {
    bloodPressure: string;
    temperature: number;
    heartRate: number;
    respiratoryRate: number;
    oxygenSaturation: number;
  };
  followUpDate?: string;
}

interface VisitsTimelineProps {
  visits: Visit[];
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ visits }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedType, setSelectedType] = useState<'all' | 'new' | 'follow-up'>('all');

  const filteredVisits = visits
    .filter(visit => {
      const matchesSearch = 
        visit.chiefComplaint.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.doctor.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = 
        selectedType === 'all' || 
        visit.type === selectedType;
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search 
                size={18} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                placeholder="Search by complaint, diagnosis, or doctor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as 'all' | 'new' | 'follow-up')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Visits</option>
                <option value="new">New Visits</option>
                <option value="follow-up">Follow-ups</option>
              </select>
              
              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? (
                  <SortAsc size={16} className="mr-2" />
                ) : (
                  <SortDesc size={16} className="mr-2" />
                )}
                Date
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredVisits.map((visit) => (
          <VisitCard key={visit.id} visit={visit} />
        ))}

        {filteredVisits.length === 0 && (
          <div className="text-center py-12">
            <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No visits found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitsTimeline;