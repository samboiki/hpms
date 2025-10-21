import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInpatientStore } from '../../stores/inpatientStore';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'react-hot-toast';

const AdmissionsManagement: React.FC = () => {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const { user } = useAuthStore();
  const {
    admissions,
    activeAdmissions,
    isLoading,
    fetchAdmissions,
    dischargePatient,
  } = useInpatientStore();

  const [filter, setFilter] = useState<'active' | 'discharged' | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeData, setDischargeData] = useState({
    discharge_type: 'home' as 'home' | 'transfer' | 'expired' | 'ama' | 'hospice' | 'rehab',
    discharge_disposition: '',
    discharge_instructions: '',
    follow_up_required: false,
    follow_up_date: '',
  });

  useEffect(() => {
    if (practiceId) {
      loadAdmissions();
    }
  }, [practiceId, filter]);

  const loadAdmissions = async () => {
    if (!practiceId) return;
    await fetchAdmissions(practiceId, filter === 'all' ? 'all' : 'active');
  };

  const getFilteredAdmissions = () => {
    let filtered = filter === 'active' ? activeAdmissions :
                  filter === 'discharged' ? admissions.filter(a => a.admission_status === 'discharged') :
                  admissions;

    if (searchTerm) {
      filtered = filtered.filter(admission =>
        admission.patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admission.patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admission.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const handleDischarge = async () => {
    if (!selectedAdmission) return;

    await dischargePatient(selectedAdmission.id, dischargeData);
    setShowDischargeModal(false);
    setSelectedAdmission(null);
    toast.success('Patient discharged successfully');
    loadAdmissions();
  };

  const getLengthOfStay = (admission: any) => {
    const start = new Date(admission.admission_date);
    const end = admission.actual_discharge_date ? new Date(admission.actual_discharge_date) : new Date();
    return differenceInDays(end, start) || 0;
  };

  const getConditionColor = (condition?: string) => {
    switch (condition) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'serious': return 'text-orange-600 bg-orange-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'stable': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Active</span>;
      case 'discharged':
        return <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">Discharged</span>;
      case 'transferred':
        return <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">Transferred</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">{status}</span>;
    }
  };

  const filteredAdmissions = getFilteredAdmissions();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admissions Management</h1>
          <p className="text-gray-600 mt-1">Manage patient admissions and discharges</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/inpatient/admissions/new')}
          className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
          New Admission
        </motion.button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'active'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({activeAdmissions.length})
            </button>
            <button
              onClick={() => setFilter('discharged')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'discharged'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Discharged
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>

          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name or admission number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Admissions Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <div className="text-center py-12">
            <Icon icon="solar:hospital-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No admissions found</h3>
            <p className="text-gray-600 mt-1">
              {searchTerm ? 'Try adjusting your search criteria' : 'Click "New Admission" to admit a patient'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admission #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bed/Ward
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admission Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LOS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doctor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredAdmissions.map((admission, index) => (
                    <motion.tr
                      key={admission.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/inpatient/admissions/${admission.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{admission.admission_number}</div>
                        <div className="text-xs text-gray-500">{admission.admission_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${
                            admission.patient_condition === 'critical' ? 'bg-red-500' :
                            admission.patient_condition === 'serious' ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}>
                            {admission.patient?.first_name?.[0]}{admission.patient?.last_name?.[0]}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {admission.patient?.first_name} {admission.patient?.last_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {admission.patient?.gender} • {admission.patient?.date_of_birth ?
                                `${new Date().getFullYear() - new Date(admission.patient.date_of_birth).getFullYear()} yrs` :
                                'Age N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {admission.current_bed ? (
                          <div>
                            <div className="text-sm text-gray-900">Bed {admission.current_bed.bed_number}</div>
                            <div className="text-xs text-gray-500">{admission.current_bed.ward_name}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No bed assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(admission.admission_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(admission.admission_date), 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getLengthOfStay(admission)} days
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConditionColor(admission.patient_condition)}`}>
                          {admission.patient_condition || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(admission.admission_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{admission.attending_doctor?.name || 'Not assigned'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/inpatient/admissions/${admission.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Icon icon="solar:eye-bold-duotone" className="w-5 h-5" />
                          </button>
                          {admission.admission_status === 'active' && (
                            <>
                              <button
                                onClick={() => navigate(`/inpatient/transfer/${admission.id}`)}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                <Icon icon="solar:transfer-horizontal-bold-duotone" className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAdmission(admission);
                                  setShowDischargeModal(true);
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Icon icon="solar:logout-3-bold-duotone" className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discharge Modal */}
      <AnimatePresence>
        {showDischargeModal && selectedAdmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDischargeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Discharge Patient</h3>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Discharging: <span className="font-medium">
                    {selectedAdmission.patient?.first_name} {selectedAdmission.patient?.last_name}
                  </span>
                </p>
                <p className="text-xs text-gray-500">Admission #{selectedAdmission.admission_number}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discharge Type
                  </label>
                  <select
                    value={dischargeData.discharge_type}
                    onChange={(e) => setDischargeData({ ...dischargeData, discharge_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="home">Home</option>
                    <option value="transfer">Transfer to Another Facility</option>
                    <option value="rehab">Rehabilitation</option>
                    <option value="hospice">Hospice</option>
                    <option value="ama">Against Medical Advice</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discharge Instructions
                  </label>
                  <textarea
                    value={dischargeData.discharge_instructions}
                    onChange={(e) => setDischargeData({ ...dischargeData, discharge_instructions: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter discharge instructions..."
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={dischargeData.follow_up_required}
                      onChange={(e) => setDischargeData({ ...dischargeData, follow_up_required: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Follow-up Required</span>
                  </label>
                </div>

                {dischargeData.follow_up_required && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={dischargeData.follow_up_date}
                      onChange={(e) => setDischargeData({ ...dischargeData, follow_up_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDischargeModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDischarge}
                  className="px-4 py-2 text-white bg-gradient-to-r from-green-500 to-green-600 rounded-lg hover:shadow-lg"
                >
                  Confirm Discharge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdmissionsManagement;