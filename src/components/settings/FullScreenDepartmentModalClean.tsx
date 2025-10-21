import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// Import tab components
import DepartmentGeneralTab from './tabs/DepartmentGeneralTab';
import DepartmentWardsTab from './tabs/DepartmentWardsTab';
import DepartmentRoomsTab from './tabs/DepartmentRoomsTab';
import DepartmentBedsTab from './tabs/DepartmentBedsTab';

interface FullScreenDepartmentModalCleanProps {
  isOpen: boolean;
  onClose: () => void;
  department: any;
  practiceId: string;
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

interface Tab {
  id: string;
  label: string;
  icon: string;
  tooltip?: string;
}

const tabs: Tab[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'solar:info-circle-bold-duotone',
    tooltip: 'Department information and contact details'
  },
  {
    id: 'wards',
    label: 'Wards',
    icon: 'solar:hospital-bold-duotone',
    tooltip: 'Manage hospital wards'
  },
  {
    id: 'rooms',
    label: 'Rooms',
    icon: 'solar:home-bold-duotone',
    tooltip: 'Manage rooms within wards'
  },
  {
    id: 'beds',
    label: 'Beds',
    icon: 'solar:bed-bold-duotone',
    tooltip: 'Manage hospital beds'
  },
];

const FullScreenDepartmentModalClean: React.FC<FullScreenDepartmentModalCleanProps> = ({
  isOpen,
  onClose,
  department,
  practiceId,
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
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['general']));

  useEffect(() => {
    if (department && isOpen) {
      setSelectedDepartment(department);
      fetchPracticeStaff();
      // Don't fetch wards/rooms/beds until needed
    }
  }, [department, isOpen]);

  // Lazy load data when tab is clicked
  useEffect(() => {
    if (!isOpen || !selectedDepartment) return;

    // Only load data if tab hasn't been loaded yet
    if (!loadedTabs.has(activeTab)) {
      if (activeTab === 'wards' || activeTab === 'rooms' || activeTab === 'beds') {
        fetchWardsAndRooms();
        setLoadedTabs(prev => new Set([...prev, 'wards', 'rooms', 'beds']));
      }
    }
  }, [activeTab, isOpen, selectedDepartment]);

  const fetchPracticeStaff = async () => {
    try {
      // Use the practiceId prop directly
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, job_title, avatar')
        .eq('practice_id', practiceId)
        .order('full_name');

      if (error) throw error;
      console.log('Fetched practice staff with avatars:', data);
      setPracticeStaff(data || []);
    } catch (error) {
      console.error('Error fetching practice staff:', error);
    }
  };

  const fetchWardsAndRooms = async () => {
    try {
      // Fetch all data in parallel for maximum speed
      const [wardsResult, roomsResult, bedsResult] = await Promise.all([
        supabase.from('wards').select('*').order('ward_name'),
        supabase.from('rooms').select('*').order('room_number'),
        supabase.from('beds').select('*').order('bed_number')
      ]);

      if (wardsResult.error) {
        console.error('Error fetching wards:', wardsResult.error);
      } else {
        setWards(wardsResult.data || []);
      }

      if (roomsResult.error) {
        console.error('Error fetching rooms:', roomsResult.error);
      } else {
        setRooms(roomsResult.data || []);
      }

      if (bedsResult.error) {
        console.error('Error fetching beds:', bedsResult.error);
      } else {
        setBeds(bedsResult.data || []);
      }
    } catch (error) {
      console.error('Error fetching wards, rooms and beds:', error);
    }
  };

  const handleEditDepartment = () => {
    setIsEditing(true);
    setEditFormData({ ...selectedDepartment });

    // Set selected head user if exists
    if (selectedDepartment?.head_user_id) {
      const headUser = practiceStaff.find(s => s.id === selectedDepartment.head_user_id);
      setSelectedHeadUser(headUser || null);
    } else {
      setSelectedHeadUser(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData(null);
    setSelectedHeadUser(null);
  };

  const handleSaveDepartment = async () => {
    if (!editFormData) {
      console.error('No edit form data available');
      return;
    }

    console.log('Saving department with data:', editFormData);
    setLoading(true);

    try {
      const updateData = {
        practice_id: practiceId, // Required field from props
        name: editFormData.name || editFormData.department_name,
        code: editFormData.code || editFormData.department_code,
        description: editFormData.description,
        is_active: editFormData.is_active !== undefined ? editFormData.is_active : true,
        color: editFormData.color,
        head_user_id: editFormData.head_user_id || null,
        contact_email: editFormData.contact_email || null,
        contact_phone: editFormData.contact_phone || null,
        updated_at: new Date().toISOString(),
      };

      console.log('Update data being sent:', updateData);
      console.log('Department ID:', selectedDepartment.id);

      const { data, error } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', selectedDepartment.id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      console.log('Department updated successfully:', data);
      toast.success('Department updated successfully');

      // Update local state with the returned data
      setSelectedDepartment(data);
      setIsEditing(false);
      setEditFormData(null);
      setSelectedHeadUser(null);

      if (onUpdate) {
        console.log('Calling onUpdate callback');
        onUpdate();
      }
    } catch (error: any) {
      console.error('Error updating department:', error);
      toast.error(error.message || 'Failed to update department');
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
            loading={loading}
            onEditFormDataChange={setEditFormData}
            onHeadUserChange={setSelectedHeadUser}
          />
        );
      case 'wards':
        console.log('🔍 Modal rendering DepartmentWardsTab with selectedDepartment:', selectedDepartment);
        return (
          <DepartmentWardsTab
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
      case 'beds':
        return (
          <DepartmentBedsTab
            beds={beds}
            selectedDepartment={selectedDepartment}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex flex-col"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Content */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative flex-1 flex flex-col bg-gray-50 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                {selectedDepartment?.color && (
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg shadow-md flex-shrink-0"
                    style={{ backgroundColor: selectedDepartment.color }}
                  />
                )}
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                    {selectedDepartment?.name || 'Department Details'}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {selectedDepartment?.code || 'No code'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tab Navigation - Matches EditVisitModal Style */}
          <div className="bg-white border-b border-gray-200 px-3 sm:px-6 flex-shrink-0">
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                const isHovered = hoveredTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      opacity: { delay: index * 0.05, duration: 0.2 },
                      y: { delay: index * 0.05, duration: 0.2 }
                    }}
                    whileHover={{
                      scale: 1.002,
                      transition: { duration: 0.2 }
                    }}
                    whileTap={{ scale: 0.998 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveTab(tab.id);
                    }}
                    onMouseEnter={() => setHoveredTab(tab.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                    className={`
                      flex-shrink-0 md:flex-1
                      flex items-center justify-center gap-2
                      px-3 sm:px-4 py-4
                      min-w-[120px] md:min-w-0
                      min-h-[48px]
                      text-xs sm:text-sm font-medium
                      border-b-2 transition-all duration-200
                      relative group cursor-pointer
                      touch-manipulation
                      ${isActive
                        ? 'text-purple-600 border-purple-600 bg-gradient-to-t from-purple-50/50 to-transparent'
                        : 'text-gray-500 border-transparent hover:text-purple-600 hover:bg-purple-50/30'
                      }
                    `}
                    aria-label={tab.label}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                  >
                    {/* Tooltip - Hidden on mobile for better UX */}
                    {tab.tooltip && isHovered && !isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none hidden sm:block"
                      >
                        {tab.tooltip}
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                      </motion.div>
                    )}

                    <Icon
                      icon={tab.icon}
                      className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-200 flex-shrink-0 ${
                        isActive ? 'text-purple-600' : ''
                      }`}
                    />

                    {/* Always show text on mobile, but make it smaller */}
                    <span className="font-medium whitespace-nowrap text-xs sm:text-sm">{tab.label}</span>

                    {/* Active indicator */}
                    {isActive && (
                      <>
                        {/* Bottom border shadow/glow */}
                        <motion.div
                          className="absolute -bottom-0.5 left-0 right-0 h-3 shadow-lg shadow-purple-500/20"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        />

                        {/* White rounded indicator */}
                        <motion.div
                          className="absolute -bottom-1.5 left-0 right-0 mx-auto w-8 h-1 bg-white rounded-full"
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 32, opacity: 1 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        />

                        {/* Simple active line indicator */}
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                          initial={{ scaleX: 0, opacity: 0 }}
                          animate={{ scaleX: 1, opacity: 1 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        />
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {renderTabContent()}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Use React Portal to render at document root level
  return createPortal(modalContent, document.body);
};

export default FullScreenDepartmentModalClean;