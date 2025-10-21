import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useInpatientStore } from '../../stores/inpatientStore';
import { usePractice } from '../../contexts/PracticeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const BedManagement: React.FC = () => {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const {
    wards,
    beds,
    activeAdmissions,
    isLoading,
    fetchWards,
    fetchAllBedsWithStatus,
    fetchAdmissions,
    updateBedStatus,
  } = useInpatientStore();

  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    if (practiceId) {
      loadData();
    }
  }, [practiceId]);

  const loadData = async () => {
    if (!practiceId) return;

    try {
      await Promise.all([
        fetchWards(practiceId),
        fetchAllBedsWithStatus(practiceId),
        fetchAdmissions(practiceId, 'active'),
      ]);
    } catch (error) {
      console.error('Error loading bed data:', error);
      toast.error('Failed to load bed data');
    }
  };

  const getBedStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 border-green-500 text-green-700';
      case 'occupied': return 'bg-red-100 border-red-500 text-red-700';
      case 'maintenance': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'cleaning': return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'reserved': return 'bg-purple-100 border-purple-500 text-purple-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getBedStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'cleaning': return 'bg-blue-500';
      case 'reserved': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getBedIcon = (status: string) => {
    switch (status) {
      case 'available': return 'solar:check-circle-bold-duotone';
      case 'occupied': return 'solar:user-bold-duotone';
      case 'maintenance': return 'solar:settings-bold-duotone';
      case 'cleaning': return 'solar:broom-bold-duotone';
      case 'reserved': return 'solar:clock-circle-bold-duotone';
      default: return 'solar:bed-bold-duotone';
    }
  };

  const filteredBeds = useMemo(() => {
    return beds.filter(bed => {
      const matchesWard = selectedWard === 'all' || bed.ward_id === selectedWard;
      const matchesStatus = selectedStatus === 'all' || bed.status === selectedStatus;
      const matchesSearch = searchTerm === '' ||
        bed.bed_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bed.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bed.ward_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bed.current_patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bed.current_patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesWard && matchesStatus && matchesSearch;
    });
  }, [beds, selectedWard, selectedStatus, searchTerm]);

  const handleBedStatusChange = async (bedId: string, newStatus: string) => {
    try {
      await updateBedStatus(bedId, newStatus);
      toast.success('Bed status updated successfully');
      await loadData(); // Reload to get latest data
    } catch (error) {
      console.error('Error updating bed status:', error);
      toast.error('Failed to update bed status');
    }
  };

  const handleQuickAction = (bed: any, action: string) => {
    switch (action) {
      case 'allocate':
        navigate(`/inpatient/admissions/new?bedId=${bed.id}`);
        break;
      case 'view_patient':
        if (bed.current_patient) {
          navigate(`/patients/${bed.current_patient.id}/view`);
        }
        break;
      case 'discharge':
        if (bed.current_admission_id) {
          navigate(`/inpatient/admissions?discharge=${bed.current_admission_id}`);
        }
        break;
      default:
        break;
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = beds.length;
    const available = beds.filter(b => b.status === 'available').length;
    const occupied = beds.filter(b => b.status === 'occupied').length;
    const maintenance = beds.filter(b => b.status === 'maintenance').length;
    const cleaning = beds.filter(b => b.status === 'cleaning').length;
    const reserved = beds.filter(b => b.status === 'reserved').length;
    const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;

    return { total, available, occupied, maintenance, cleaning, reserved, occupancyRate };
  }, [beds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bed Management</h1>
          <p className="text-gray-600 mt-1">Manage hospital bed allocation and status</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/inpatient/admissions/new')}
            className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
            New Admission
          </button>
          <button
            onClick={() => navigate('/inpatient')}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 flex items-center gap-2"
          >
            <Icon icon="solar:arrow-left-bold-duotone" className="w-5 h-5" />
            Back
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:hospital-bed-bold-duotone" className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600">Available</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:user-bold-duotone" className="w-5 h-5 text-red-600" />
            <p className="text-sm text-gray-600">Occupied</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.occupied}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-gray-600">Maintenance</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:broom-bold-duotone" className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-gray-600">Cleaning</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.cleaning}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-purple-600" />
            <p className="text-sm text-gray-600">Reserved</p>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats.reserved}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-indigo-600" />
            <p className="text-sm text-gray-600">Occupancy</p>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{Math.round(stats.occupancyRate)}%</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by bed number, room, ward, or patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Wards</option>
            {wards.map(ward => (
              <option key={ward.id} value={ward.id}>{ward.ward_name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="cleaning">Cleaning</option>
            <option value="reserved">Reserved</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Icon icon="solar:widget-bold-duotone" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bed Display */}
      {filteredBeds.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Icon icon="solar:hospital-bed-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No beds found</h3>
          <p className="text-gray-600 mt-1">Try adjusting your filters or search term</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ward
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admission Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBeds.map((bed) => {
                  const admission = activeAdmissions.find(a => a.current_bed_id === bed.id);
                  return (
                    <motion.tr
                      key={bed.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ backgroundColor: '#f9fafb' }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Icon icon={getBedIcon(bed.status)} className="w-5 h-5 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              Bed {bed.bed_number}
                            </div>
                            {bed.room_number && (
                              <div className="text-sm text-gray-500">
                                Room {bed.room_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bed.ward_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {bed.bed_type || 'Standard'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBedStatusColor(bed.status)}`}>
                          {bed.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bed.current_patient ? (
                          <button
                            onClick={() => handleQuickAction(bed, 'view_patient')}
                            className="text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {bed.current_patient.first_name} {bed.current_patient.last_name}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {admission ? format(new Date(admission.admission_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {bed.status === 'available' && (
                            <button
                              onClick={() => handleQuickAction(bed, 'allocate')}
                              className="text-green-600 hover:text-green-700"
                              title="Allocate bed"
                            >
                              <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                            </button>
                          )}
                          {bed.status === 'occupied' && (
                            <button
                              onClick={() => handleQuickAction(bed, 'discharge')}
                              className="text-red-600 hover:text-red-700"
                              title="Discharge patient"
                            >
                              <Icon icon="solar:logout-3-bold-duotone" className="w-5 h-5" />
                            </button>
                          )}
                          <select
                            value={bed.status}
                            onChange={(e) => handleBedStatusChange(bed.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-rose-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="available">Available</option>
                            <option value="occupied" disabled={bed.status !== 'occupied'}>Occupied</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="cleaning">Cleaning</option>
                            <option value="reserved">Reserved</option>
                          </select>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredBeds.map((bed) => (
            <motion.div
              key={bed.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all ${getBedStatusColor(bed.status)}`}
              onClick={() => {
                if (bed.status === 'available') {
                  handleQuickAction(bed, 'allocate');
                } else if (bed.status === 'occupied' && bed.current_patient) {
                  handleQuickAction(bed, 'view_patient');
                }
              }}
            >
              <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${getBedStatusBadge(bed.status)}`} />
              <Icon icon={getBedIcon(bed.status)} className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-bold text-center">Bed {bed.bed_number}</p>
              {bed.room_number && (
                <p className="text-xs text-center opacity-75">Room {bed.room_number}</p>
              )}
              <p className="text-xs text-center mt-1">{bed.ward_name}</p>
              {bed.current_patient && (
                <p className="text-xs text-center mt-1 font-medium">
                  {bed.current_patient.first_name[0]}. {bed.current_patient.last_name}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BedManagement;