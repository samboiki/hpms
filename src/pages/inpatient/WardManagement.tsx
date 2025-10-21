import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useInpatientStore } from '../../stores/inpatientStore';
import { usePractice } from '../../contexts/PracticeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const WardManagement: React.FC = () => {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const {
    wards,
    beds,
    isLoading,
    fetchWards,
    fetchAllBedsWithStatus,
    updateBedStatus,
  } = useInpatientStore();

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
      ]);
    } catch (error) {
      console.error('Error loading ward data:', error);
      toast.error('Failed to load ward data');
    }
  };

  const getWardBeds = (wardId: string) => {
    return beds.filter(bed => bed.ward_id === wardId);
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

  const handleBedStatusChange = async (bedId: string, newStatus: any) => {
    try {
      await updateBedStatus(bedId, newStatus);
      toast.success('Bed status updated');
    } catch (error) {
      console.error('Error updating bed status:', error);
      toast.error('Failed to update bed status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const filteredWards = selectedWard ? wards.filter(w => w.id === selectedWard) : wards;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ward Management</h1>
          <p className="text-gray-600 mt-1">Manage hospital wards and bed allocation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/inpatient')}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 flex items-center gap-2"
          >
            <Icon icon="solar:arrow-left-bold-duotone" className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
              <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{wards.length}</p>
              <p className="text-sm text-gray-600">Total Wards</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
              <Icon icon="solar:bed-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{beds.length}</p>
              <p className="text-sm text-gray-600">Total Beds</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {beds.filter(b => b.status === 'available').length}
              </p>
              <p className="text-sm text-gray-600">Available</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
              <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {beds.filter(b => b.status === 'occupied').length}
              </p>
              <p className="text-sm text-gray-600">Occupied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedWard || ''}
            onChange={(e) => setSelectedWard(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Wards</option>
            {wards.map(ward => (
              <option key={ward.id} value={ward.id}>{ward.ward_name}</option>
            ))}
          </select>

          <div className="flex gap-2 ml-auto">
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
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Ward Display */}
      <div className="space-y-6">
        {filteredWards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Icon icon="solar:hospital-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No wards found</h3>
            <p className="text-gray-600 mt-1">Create wards to start managing beds</p>
          </div>
        ) : (
          filteredWards.map(ward => {
            const wardBeds = getWardBeds(ward.id);
            const occupiedCount = wardBeds.filter(b => b.status === 'occupied').length;
            const availableCount = wardBeds.filter(b => b.status === 'available').length;
            const occupancyRate = wardBeds.length > 0 ? (occupiedCount / wardBeds.length) * 100 : 0;

            return (
              <motion.div
                key={ward.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-6"
              >
                {/* Ward Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{ward.ward_name}</h2>
                    <p className="text-sm text-gray-600 capitalize">
                      {ward.ward_type} • Floor {ward.floor_number || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {occupiedCount}/{wardBeds.length}
                    </div>
                    <div className="text-sm text-gray-600">Occupied</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            occupancyRate > 80 ? 'bg-red-500' :
                            occupancyRate > 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${occupancyRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(occupancyRate)}%</span>
                    </div>
                  </div>
                </div>

                {/* Ward Features */}
                {ward.features && ward.features.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ward.features.map((feature, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bed Grid */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {wardBeds.map(bed => (
                      <motion.div
                        key={bed.id}
                        whileHover={{ scale: 1.05 }}
                        className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all ${getBedStatusColor(bed.status)}`}
                        onClick={() => {
                          if (bed.status === 'available') {
                            // Could open allocation modal
                            toast.info(`Bed ${bed.bed_number} is available for allocation`);
                          } else if (bed.status === 'occupied' && bed.current_patient) {
                            toast.info(`Bed occupied by ${bed.current_patient.first_name} ${bed.current_patient.last_name}`);
                          }
                        }}
                      >
                        <Icon icon={getBedIcon(bed.status)} className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs font-medium text-center">{bed.bed_number}</p>
                        {bed.room_number && (
                          <p className="text-xs text-center opacity-75">R{bed.room_number}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wardBeds.map(bed => (
                      <div
                        key={bed.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${getBedStatusColor(bed.status)}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon icon={getBedIcon(bed.status)} className="w-5 h-5" />
                          <div>
                            <span className="font-medium">Bed {bed.bed_number}</span>
                            {bed.room_number && <span className="text-sm ml-2">Room {bed.room_number}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {bed.current_patient && (
                            <span className="text-sm">
                              {bed.current_patient.first_name} {bed.current_patient.last_name}
                            </span>
                          )}
                          <select
                            value={bed.status}
                            onChange={(e) => handleBedStatusChange(bed.id, e.target.value)}
                            className="px-2 py-1 text-sm border rounded"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="available">Available</option>
                            <option value="occupied">Occupied</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="cleaning">Cleaning</option>
                            <option value="reserved">Reserved</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WardManagement;