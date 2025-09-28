import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// Import tab components
import DepartmentGeneralTab from './tabs/DepartmentGeneralTab';
import DepartmentWardsTab from './tabs/DepartmentWardsTab';
import DepartmentRoomsTab from './tabs/DepartmentRoomsTab';

interface FullScreenDepartmentModalCleanProps {
  isOpen: boolean;
  onClose: () => void;
  department: any;
  onUpdate?: () => void;
}

const departmentColors = [
  { name: 'Purple', value: '#8B5CF6', gradient: 'from-purple-400 to-purple-600' },
  { name: 'Blue', value: '#3B82F6', gradient: 'from-blue-400 to-blue-600' },
  { name: 'Green', value: '#10B981', gradient: 'from-green-400 to-green-600' },
  { name: 'Red', value: '#EF4444', gradient: 'from-red-400 to-red-600' },
  { name: 'Indigo', value: '#6366F1', gradient: 'from-indigo-400 to-indigo-600' },
  { name: 'Pink', value: '#EC4899', gradient: 'from-pink-400 to-pink-600' },
  { name: 'Teal', value: '#14B8A6', gradient: 'from-teal-400 to-teal-600' },
  { name: 'Orange', value: '#F97316', gradient: 'from-orange-400 to-orange-600' },
  { name: 'Cyan', value: '#06B6D4', gradient: 'from-cyan-400 to-cyan-600' },
  { name: 'Amber', value: '#F59E0B', gradient: 'from-amber-400 to-amber-600' },
];

const tabs = [
  { id: 'general', label: 'General', icon: 'solar:info-circle-bold-duotone' },
  { id: 'wards', label: 'Wards', icon: 'solar:hospital-bed-bold-duotone' },
  { id: 'rooms', label: 'Rooms', icon: 'solar:door-bold-duotone' },
];

const FullScreenDepartmentModalClean: React.FC<FullScreenDepartmentModalCleanProps> = ({
  isOpen,
  onClose,
  department,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [practiceStaff, setPracticeStaff] = useState<any[]>([]);
  const [selectedHeadUser, setSelectedHeadUser] = useState<any>(null);
  const [wards, setWards] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (department && isOpen) {
      setSelectedDepartment(department);
      fetchPracticeStaff();
      fetchWardsAndRooms();
    }
  }, [department, isOpen]);

  const fetchPracticeStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, job_title, role, avatar')
        .eq('status', 'active')
        .order('full_name');

      if (!error && data) {
        setPracticeStaff(data);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchWardsAndRooms = async () => {
    try {
      // Fetch wards
      const { data: wardsData } = await supabase
        .from('hospital_wards')
        .select('*')
        .order('name');

      if (wardsData) setWards(wardsData);

      // Fetch rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');

      if (roomsData) setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching wards and rooms:', error);
    }
  };

  const handleEditDepartment = () => {
    setIsEditing(true);
    setEditFormData({ ...selectedDepartment });

    // Set selected head user if exists
    if (selectedDepartment?.head_user_id) {
      const headUser = practiceStaff.find(s => s.id === selectedDepartment.head_user_id);
      setSelectedHeadUser(headUser || null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData(null);
    setSelectedHeadUser(null);
  };

  const handleSaveDepartment = async () => {
    if (!editFormData) return;

    setLoading(true);
    try {
      const updateData = {
        name: editFormData.name || editFormData.department_name,
        code: editFormData.code || editFormData.department_code,
        description: editFormData.description,
        is_active: editFormData.is_active,
        color: editFormData.color,
        head_of_department: editFormData.head_of_department,
        head_user_id: editFormData.head_user_id,
        contact_email: editFormData.contact_email,
        contact_phone: editFormData.contact_phone,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', selectedDepartment.id);

      if (error) throw error;

      toast.success('Department updated successfully');
      setSelectedDepartment({ ...selectedDepartment, ...updateData });
      setIsEditing(false);
      setEditFormData(null);

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error('Failed to update department');
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <DepartmentGeneralTab
            isEditing={isEditing}
            editFormData={editFormData}
            selectedDepartment={selectedDepartment}
            practiceStaff={practiceStaff}
            selectedHeadUser={selectedHeadUser}
            departmentColors={departmentColors}
            onEditClick={handleEditDepartment}
            onCancelClick={handleCancelEdit}
            onSaveClick={handleSaveDepartment}
            onEditFormDataChange={setEditFormData}
            onHeadUserChange={setSelectedHeadUser}
          />
        );
      case 'wards':
        return (
          <DepartmentWardsTab
            wards={wards}
            selectedDepartment={selectedDepartment}
          />
        );
      case 'rooms':
        return (
          <DepartmentRoomsTab
            rooms={rooms}
            selectedDepartment={selectedDepartment}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-4 bg-gray-50 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedDepartment?.color && (
                  <div
                    className="w-12 h-12 rounded-lg shadow-md"
                    style={{ backgroundColor: selectedDepartment.color }}
                  />
                )}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedDepartment?.name || 'Department Details'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedDepartment?.code || 'No code'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white border-b border-gray-200 px-6">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative px-4 py-3 font-medium text-sm transition-all group"
                >
                  <div className={`flex items-center gap-2 ${
                    activeTab === tab.id ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    <Icon icon={tab.icon} className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </div>
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {renderTabContent()}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FullScreenDepartmentModalClean;