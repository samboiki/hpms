import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Mail,
  MessageSquare,
  User,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface CommunicationLog {
  id: string;
  patient_id?: string;
  type: 'EMAIL' | 'SMS';
  direction: 'OUTGOING' | 'INCOMING';
  sender_address: string;
  recipient_address: string;
  subject?: string;
  body_preview: string;
  status: string;
  status_reason?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  created_at: string;
  patient?: {
    first_name: string;
    last_name: string;
  };
}

const CommunicationHistory: React.FC = () => {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<CommunicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    direction: 'all',
    dateRange: '7days'
  });
  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, filters]);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('communications_log')
        .select(`
          *,
          patient:patients(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      // Apply date filter
      const now = new Date();
      if (filters.dateRange === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('created_at', today.toISOString());
      } else if (filters.dateRange === '7days') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', weekAgo.toISOString());
      } else if (filters.dateRange === '30days') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', monthAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = logs;

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(log => log.type === filters.type);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(log => log.status === filters.status);
    }

    // Direction filter
    if (filters.direction !== 'all') {
      filtered = filtered.filter(log => log.direction === filters.direction);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.recipient_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.body_preview.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const handleRetry = async (log: CommunicationLog) => {
    try {
      // Create a new log entry for retry
      const { error } = await supabase
        .from('communications_log')
        .insert({
          patient_id: log.patient_id,
          type: log.type,
          direction: 'OUTGOING',
          sender_address: log.sender_address,
          recipient_address: log.recipient_address,
          subject: log.subject,
          body_preview: log.body_preview,
          status: 'PENDING'
        });

      if (error) throw error;
      
      await fetchLogs();
      alert('Message queued for retry');
    } catch (error) {
      console.error('Error retrying message:', error);
      alert('Failed to retry message');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
      case 'DELIVERED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED':
      case 'UNDELIVERED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PENDING':
      case 'QUEUED':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT':
      case 'DELIVERED':
        return 'bg-green-100 text-green-700';
      case 'FAILED':
      case 'UNDELIVERED':
        return 'bg-red-100 text-red-700';
      case 'PENDING':
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Direction', 'Patient', 'Recipient', 'Subject', 'Status'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm'),
      log.type,
      log.direction,
      log.patient ? `${log.patient.first_name} ${log.patient.last_name}` : 'Unknown',
      log.recipient_address,
      log.subject || 'N/A',
      log.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communications-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Communication History</h1>
          <p className="text-gray-600 mt-1">View all sent and received messages</p>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchLogs}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportToCSV}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Types</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="SENT">Sent</option>
            <option value="DELIVERED">Delivered</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={filters.direction}
            onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Directions</option>
            <option value="OUTGOING">Outgoing</option>
            <option value="INCOMING">Incoming</option>
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedLogs.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No communication history found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject/Preview
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(log.created_at), 'MMM d, yyyy')}
                        <br />
                        <span className="text-xs text-gray-500">
                          {format(new Date(log.created_at), 'h:mm a')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {log.type === 'EMAIL' ? (
                            <Mail className="w-4 h-4 text-blue-500" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-purple-500" />
                          )}
                          <span className="text-sm font-medium text-gray-900">{log.type}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            log.direction === 'OUTGOING' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {log.direction}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.patient ? `${log.patient.first_name} ${log.patient.last_name}` : 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">{log.recipient_address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {log.subject || 'No subject'}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {log.body_preview}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                        {log.status_reason && (
                          <p className="text-xs text-gray-500 mt-1">{log.status_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedLog(log)}
                            className="p-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          {log.status === 'FAILED' && log.direction === 'OUTGOING' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRetry(log)}
                              className="p-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              title="Retry"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-700">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = currentPage - 2 + i;
                  if (pageNum > 0 && pageNum <= totalPages) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          currentPage === pageNum
                            ? 'bg-primary-500 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Message Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Type</p>
                    <p className="mt-1 text-sm text-gray-900">{selectedLog.type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Direction</p>
                    <p className="mt-1 text-sm text-gray-900">{selectedLog.direction}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      {getStatusIcon(selectedLog.status)}
                      <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(selectedLog.status)}`}>
                        {selectedLog.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Created</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(selectedLog.created_at), 'PPp')}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">From</p>
                  <p className="mt-1 text-sm text-gray-900">{selectedLog.sender_address}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">To</p>
                  <p className="mt-1 text-sm text-gray-900">{selectedLog.recipient_address}</p>
                </div>

                {selectedLog.subject && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Subject</p>
                    <p className="mt-1 text-sm text-gray-900">{selectedLog.subject}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-500">Message Preview</p>
                  <p className="mt-1 text-sm text-gray-900">{selectedLog.body_preview}</p>
                </div>

                {selectedLog.status_reason && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status Details</p>
                    <p className="mt-1 text-sm text-gray-900">{selectedLog.status_reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  {selectedLog.sent_at && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Sent At</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {format(new Date(selectedLog.sent_at), 'PPp')}
                      </p>
                    </div>
                  )}
                  {selectedLog.delivered_at && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Delivered At</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {format(new Date(selectedLog.delivered_at), 'PPp')}
                      </p>
                    </div>
                  )}
                  {selectedLog.opened_at && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Opened At</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {format(new Date(selectedLog.opened_at), 'PPp')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CommunicationHistory;