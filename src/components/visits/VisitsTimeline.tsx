import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Filter,
  Search,
  Calendar,
  ArrowDownUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import VisitCard from './VisitCard';

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
  labResults: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
    referenceRange: string;
    status: 'normal' | 'high' | 'low' | 'critical';
    date: string;
  }>;
  media: Array<{
    id: string;
    type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
    url: string;
    description: string;
    date: string;
  }>;
  followUpDate?: string;
}

interface Props {
  visits: Visit[];
}

const VisitsTimeline: React.FC<Props> = ({ visits }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<'all' | 'new' | 'follow-up'>('all');

  const filteredAndSortedVisits = visits
    .filter(visit => {
      if (filterType !== 'all' && visit.type !== filterType) return false;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        visit.chiefComplaint.toLowerCase().includes(searchLower) ||
        visit.diagnosis.toLowerCase().includes(searchLower) ||
        visit.doctor.name.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time}`).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Visit History</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search visits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
                />
              </div>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'new' | 'follow-up')}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Visits</option>
                <option value="new">New Visits</option>
                <option value="follow-up">Follow-ups</option>
              </select>
              
              <Button
                variant="outline"
                onClick={() => setSortOrder(order => order === 'desc' ? 'asc' : 'desc')}
              >
                <Calendar size={16} className="mr-2" />
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredAndSortedVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
            
            {filteredAndSortedVisits.length === 0 && (
              <div className="text-center py-12">
                <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No visits found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisitsTimeline;