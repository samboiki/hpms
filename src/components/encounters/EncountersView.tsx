import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface EncounterRecord {
  visit_id: string;
  sequential_number: number;
  system_sequence_visit_number: number;
  visit_status: string;
  template_name: string;
  visit_date: string;
  schedule_date: string;
  practice: string;
  patient_name: string;
  patient_id: string;
  medical_aid_name: string;
  medical_aid_number: string;
  visit_type: string;
  chief_complaint: string;
  total_bill: number;
  invoice_number: string;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  duration_minutes: number | null;
  is_scheduled: boolean;
  is_confirmed: boolean;
  is_checked_in: boolean;
  is_cancelled: boolean;
  doctor_id: string | null;
  practice_id: string;
  branch_id: string | null;
  branch_name: string | null;
  pending_lab_requests: number;
  pending_imaging_requests: number;
}

export const EncountersView: React.FC = () => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const { practiceId } = usePractice();
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [sortField, setSortField] = useState<keyof EncounterRecord>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (practiceId) {
      fetchEncounters();
      fetchBranches();
    }
  }, [practiceId, statusFilter, branchFilter]);

  const fetchEncounters = async () => {
    try {
      setIsLoading(true);
      setLoading(true);
      
      let query = supabase
        .from('encounters_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (practiceId) {
        query = query.eq('practice_id', practiceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching encounters:', error);
        return;
      }

      setEncounters(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching branches:', error);
        return;
      }

      setBranches(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };


  const getPaymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return { text: 'Paid', class: 'bg-green-100 text-green-700' };
      case 'pending':
        return { text: 'Pending', class: 'bg-yellow-100 text-yellow-700' };
      case 'overdue':
        return { text: 'Overdue', class: 'bg-red-100 text-red-700' };
      default:
        return { text: 'N/A', class: 'bg-gray-100 text-gray-600' };
    }
  };

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === paginatedEncounters.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedEncounters.map(e => e.visit_id)));
    }
  };

  const filteredAndSortedEncounters = useMemo(() => {
    let filtered = encounters;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((encounter) =>
        encounter.patient_name.toLowerCase().includes(search) ||
        encounter.medical_aid_name.toLowerCase().includes(search) ||
        encounter.medical_aid_number.toLowerCase().includes(search) ||
        encounter.chief_complaint.toLowerCase().includes(search) ||
        encounter.template_name.toLowerCase().includes(search) ||
        encounter.system_sequence_visit_number.toString().includes(search) ||
        encounter.visit_type.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((encounter) => encounter.visit_status === statusFilter);
    }

    // Apply branch filter
    if (branchFilter !== 'all') {
      if (branchFilter === 'main') {
        filtered = filtered.filter((encounter) => !encounter.branch_id);
      } else {
        filtered = filtered.filter((encounter) => encounter.branch_id === branchFilter);
      }
    }

    // Sort with proper type handling
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      
      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // Case-insensitive string comparison
        const compareResult = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortDirection === 'asc' ? compareResult : -compareResult;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        // Numeric comparison
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        // Date comparison
        return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      } else {
        // Default comparison
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      }
    });

    return filtered;
  }, [encounters, searchTerm, statusFilter, sortField, sortDirection]);

  const paginatedEncounters = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedEncounters.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedEncounters, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedEncounters.length / itemsPerPage);

  const handleSort = (field: keyof EncounterRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRowClick = (visitId: string, patientId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or action buttons
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button')) {
      return;
    }
    
    // Navigate to patient modal with visit edit action
    navigate(`/patients?patientId=${patientId}&visitId=${visitId}&action=edit-visit`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading encounters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Modern Header with Search */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100"
      >
        <div className="p-6">
          <div className="flex flex-col space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Icon
                  icon="solar:magnifer-linear"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by patient name, medical aid, complaint, or visit number..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
              </div>
              <button
                onClick={fetchEncounters}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
              >
                <Icon icon="solar:refresh-linear" className="w-5 h-5" />
              </button>
            </div>

            {/* Modern Filter Pills */}
            <div className="flex flex-wrap gap-6">
              {/* Status Filter */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All', color: 'gray' },
                    { value: 'scheduled', label: 'Scheduled', color: 'purple' },
                    { value: 'in-progress', label: 'In Progress', color: 'blue' },
                    { value: 'completed', label: 'Completed', color: 'green' },
                    { value: 'cancelled', label: 'Cancelled', color: 'red' }
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => {
                        setStatusFilter(status.value);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        statusFilter === status.value
                          ? status.color === 'gray' ? 'bg-gray-900 text-white' :
                            status.color === 'purple' ? 'bg-purple-500 text-white' :
                            status.color === 'blue' ? 'bg-blue-500 text-white' :
                            status.color === 'green' ? 'bg-green-500 text-white' :
                            'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status.label}
                      {statusFilter === status.value && (
                        <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                          {status.value === 'all' ? encounters.length : encounters.filter(e => e.visit_status === status.value).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch Filter */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Branch</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setBranchFilter('all');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      branchFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Branches
                    {branchFilter === 'all' && (
                      <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                        {encounters.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setBranchFilter('main');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      branchFilter === 'main'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon icon="solar:home-2-linear" className="inline w-3 h-3 mr-1" />
                    Main
                    {branchFilter === 'main' && (
                      <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                        {encounters.filter(e => !e.branch_id).length}
                      </span>
                    )}
                  </button>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setBranchFilter(branch.id);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        branchFilter === branch.id
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon icon="solar:map-point-linear" className="inline w-3 h-3 mr-1" />
                      {branch.name}
                      {branchFilter === branch.id && (
                        <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                          {encounters.filter(e => e.branch_id === branch.id).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="ml-auto flex items-center gap-4 text-sm">
                <div className="text-gray-500">
                  <span className="font-semibold text-gray-900">{filteredAndSortedEncounters.length}</span> results
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Modern Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="pl-4 pr-2 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedEncounters.length && paginatedEncounters.length > 0}
                    onChange={toggleAllRows}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-2 py-3 text-left">
                  <button
                    onClick={() => handleSort('sequential_number')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    #
                    <Icon icon={sortField === 'sequential_number' ? (sortDirection === 'asc' ? 'solar:sort-from-bottom-to-top-linear' : 'solar:sort-from-top-to-bottom-linear') : 'solar:sort-linear'} className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-2 py-3 text-left">
                  <button
                    onClick={() => handleSort('visit_date')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Date
                    <Icon icon={sortField === 'visit_date' ? (sortDirection === 'asc' ? 'solar:sort-from-bottom-to-top-linear' : 'solar:sort-from-top-to-bottom-linear') : 'solar:sort-linear'} className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-2 py-3 text-left">Status</th>
                <th className="px-2 py-3 text-left">
                  <button
                    onClick={() => handleSort('patient_name')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Patient
                    <Icon icon={sortField === 'patient_name' ? (sortDirection === 'asc' ? 'solar:sort-from-bottom-to-top-linear' : 'solar:sort-from-top-to-bottom-linear') : 'solar:sort-linear'} className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-2 py-3 text-left">Type</th>
                <th className="px-2 py-3 text-left">Chief Complaint</th>
                <th className="px-2 py-3 text-center">
                  <button
                    onClick={() => handleSort('pending_lab_requests')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors mx-auto"
                  >
                    <Icon icon="solar:test-tube-minimalistic-linear" className="w-3 h-3" />
                    Labs
                    <Icon icon={sortField === 'pending_lab_requests' ? (sortDirection === 'asc' ? 'solar:sort-from-bottom-to-top-linear' : 'solar:sort-from-top-to-bottom-linear') : 'solar:sort-linear'} className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-2 py-3 text-center">
                  <button
                    onClick={() => handleSort('pending_imaging_requests')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors mx-auto"
                  >
                    <Icon icon="solar:monitor-camera-linear" className="w-3 h-3" />
                    Imaging
                    <Icon icon={sortField === 'pending_imaging_requests' ? (sortDirection === 'asc' ? 'solar:sort-from-bottom-to-top-linear' : 'solar:sort-from-top-to-bottom-linear') : 'solar:sort-linear'} className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-2 py-3 text-left">Medical Aid</th>
                <th className="px-2 py-3 text-right">
                  <button
                    onClick={() => handleSort('total_bill')}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors ml-auto"
                  >
                    Amount
                    <Icon icon={sortField === 'total_bill' ? (sortDirection === 'asc' ? 'solar:sort-from-bottom-to-top-linear' : 'solar:sort-from-top-to-bottom-linear') : 'solar:sort-linear'} className="w-3 h-3" />
                  </button>
                </th>
                <th className="pl-2 pr-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                      <p className="text-sm text-gray-500">Loading encounters...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedEncounters.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8">
                    <Icon icon="solar:document-text-linear" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No encounters found</p>
                  </td>
                </tr>
              ) : null}
              {paginatedEncounters.map((encounter, index) => {
                const paymentInfo = getPaymentStatusBadge(encounter.payment_status);
                return (
                  <motion.tr
                    key={encounter.visit_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={(e) => handleRowClick(encounter.visit_id, encounter.patient_id, e)}
                    className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${selectedRows.has(encounter.visit_id) ? 'bg-blue-50/30' : ''}`}
                  >
                    <td className="pl-4 pr-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(encounter.visit_id)}
                        onChange={() => toggleRowSelection(encounter.visit_id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-xs font-medium text-gray-900">
                        {filteredAndSortedEncounters.length - 
                         (filteredAndSortedEncounters.findIndex(e => e.visit_id === encounter.visit_id))}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">
                          {encounter.visit_date ? format(new Date(encounter.visit_date), 'dd MMM') : '-'}
                        </div>
                        {encounter.schedule_date && encounter.schedule_date !== encounter.visit_date && (
                          <div className="text-gray-500">
                            <Icon icon="solar:calendar-linear" className="inline w-3 h-3 mr-0.5" />
                            {format(new Date(encounter.schedule_date), 'dd MMM')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          encounter.visit_status === 'completed' ? 'bg-green-500' :
                          encounter.visit_status === 'in-progress' ? 'bg-blue-500' :
                          encounter.visit_status === 'scheduled' ? 'bg-purple-500' :
                          encounter.visit_status === 'cancelled' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                        <span className="text-xs font-medium text-gray-700 capitalize">
                          {encounter.visit_status.replace('-', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs">
                        <div className="font-medium text-gray-900 truncate max-w-[150px]">
                          {encounter.patient_name}
                        </div>
                        <div className="text-gray-500">Visit #{encounter.system_sequence_visit_number}</div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        encounter.visit_type === 'consultation' ? 'bg-blue-100 text-blue-700' :
                        encounter.visit_type === 'follow-up' ? 'bg-purple-100 text-purple-700' :
                        encounter.visit_type === 'procedure' ? 'bg-orange-100 text-orange-700' :
                        encounter.visit_type === 'emergency' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {encounter.visit_type}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs text-gray-600 truncate max-w-[200px]" title={encounter.chief_complaint}>
                        {encounter.chief_complaint || <span className="text-gray-400">No complaint</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {encounter.pending_lab_requests > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                          {encounter.pending_lab_requests}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {encounter.pending_imaging_requests > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                          {encounter.pending_imaging_requests}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs">
                        {encounter.medical_aid_name !== 'No Medical Aid' ? (
                          <>
                            <div className="font-medium text-gray-700 truncate max-w-[120px]">
                              {encounter.medical_aid_name}
                            </div>
                            <div className="text-gray-500">{encounter.medical_aid_number}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">Cash</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="text-xs">
                        {encounter.total_bill > 0 ? (
                          <div className="font-semibold text-gray-900">
                            R{encounter.total_bill >= 1000 ? 
                              `${(encounter.total_bill / 1000).toFixed(1)}k` : 
                              encounter.total_bill.toFixed(0)
                            }
                          </div>
                        ) : (
                          <div className="text-gray-400">-</div>
                        )}
                        {encounter.payment_status && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${paymentInfo.class}`}>
                            {paymentInfo.text}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="pl-2 pr-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="View Details"
                        >
                          <Icon icon="solar:eye-linear" className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                          title="More Options"
                        >
                          <Icon icon="solar:menu-dots-linear" className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </motion.div>

        {/* Modern Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                  {' '}-{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, filteredAndSortedEncounters.length)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{filteredAndSortedEncounters.length}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
                  </button>
                  
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1;
                    if (
                      pageNumber === 1 ||
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`relative inline-flex items-center px-3 py-1 border text-sm font-medium rounded-md mx-0.5 ${
                            currentPage === pageNumber
                              ? 'z-10 bg-blue-500 border-blue-500 text-white'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    } else if (
                      pageNumber === currentPage - 2 ||
                      pageNumber === currentPage + 2
                    ) {
                      return (
                        <span
                          key={pageNumber}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon icon="solar:alt-arrow-right-linear" className="h-4 w-4" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};