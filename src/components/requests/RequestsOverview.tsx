import React, { useState, useEffect } from 'react';
import { 
  Microscope, 
  Image as ImageIcon, 
  Clock, 
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  User,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';

interface Request {
  request_type: 'lab' | 'media';
  id: string;
  visit_id: string;
  description: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  requesting_doctor_id: string;
  requested_at: string;
  expected_completion_date: string;
  patient_id: string;
  patient_name: string;
  doctor_name: string;
}

const RequestsOverview: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lab' | 'media'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'routine' | 'urgent' | 'stat'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('pending_requests_view')
        .select('*');

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedRequests = requests
    .filter(request => {
      if (filterType !== 'all' && request.request_type !== filterType) return false;
      if (filterPriority !== 'all' && request.priority !== filterPriority) return false;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        request.description.toLowerCase().includes(searchLower) ||
        request.patient_name.toLowerCase().includes(searchLower) ||
        request.doctor_name.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.requested_at).getTime();
        const dateB = new Date(b.requested_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        const priorityOrder = { stat: 3, urgent: 2, routine: 1 };
        const priorityA = priorityOrder[a.priority];
        const priorityB = priorityOrder[b.priority];
        return sortOrder === 'desc' ? priorityB - priorityA : priorityA - priorityB;
      }
    });

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'stat': return 'error';
      case 'urgent': return 'warning';
      case 'routine': return 'success';
      default: return 'glass';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'warning';
      case 'pending': return 'azure';
      case 'cancelled': return 'error';
      default: return 'glass';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <Clock size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {requests.filter(r => r.status === 'pending').length}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <Microscope size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Lab Tests</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {requests.filter(r => r.request_type === 'lab').length}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <ImageIcon size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Imaging</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {requests.filter(r => r.request_type === 'media').length}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Urgent/STAT</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {requests.filter(r => ['urgent', 'stat'].includes(r.priority)).length}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by patient, doctor, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'lab' | 'media')}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Types</option>
                <option value="lab">Lab Tests</option>
                <option value="media">Imaging</option>
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as 'all' | 'routine' | 'urgent' | 'stat')}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Priorities</option>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
              <Button
                variant="outline"
                onClick={() => {
                  if (sortBy === 'date') {
                    setSortOrder(order => order === 'desc' ? 'asc' : 'desc');
                  } else {
                    setSortBy('date');
                    setSortOrder('desc');
                  }
                }}
              >
                <Calendar size={16} className="mr-2" />
                {sortBy === 'date' ? (sortOrder === 'desc' ? 'Newest First' : 'Oldest First') : 'Sort by Date'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-6 py-3 text-left">Request</th>
                  <th className="px-6 py-3 text-left">Patient</th>
                  <th className="px-6 py-3 text-left">Doctor</th>
                  <th className="px-6 py-3 text-left">Priority</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Requested</th>
                  <th className="px-6 py-3 text-left">Expected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-full ${
                          request.request_type === 'lab' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {request.request_type === 'lab' ? (
                            <Microscope size={16} />
                          ) : (
                            <ImageIcon size={16} />
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{request.description}</p>
                          <p className="text-xs text-gray-500">
                            {request.request_type === 'lab' ? 'Lab Test' : 'Imaging'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <User size={14} className="text-gray-500" />
                        </div>
                        <span className="ml-2 text-sm text-gray-900">{request.patient_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{request.doctor_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={getPriorityBadgeVariant(request.priority)}
                        size="sm"
                      >
                        {request.priority.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={getStatusBadgeVariant(request.status)}
                        size="sm"
                      >
                        {request.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {format(new Date(request.requested_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {format(new Date(request.expected_completion_date), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(request.expected_completion_date), { addSuffix: true })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAndSortedRequests.length === 0 && (
              <div className="text-center py-12">
                <Clock size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No pending requests found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequestsOverview;