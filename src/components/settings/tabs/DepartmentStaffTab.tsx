import React from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

interface Staff {
  id: string;
  full_name: string;
  email?: string;
  job_title?: string;
  role?: string;
  avatar?: string;
}

interface DepartmentStaffTabProps {
  practiceStaff: Staff[];
  selectedDepartment: any;
}

const DepartmentStaffTab: React.FC<DepartmentStaffTabProps> = ({
  practiceStaff,
  selectedDepartment,
}) => {
  // Filter staff by department if needed (for now showing all practice staff)
  const departmentStaff = practiceStaff;

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Department Staff</h3>
          <p className="text-sm text-gray-600">
            {departmentStaff.length} staff member{departmentStaff.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {departmentStaff.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Icon icon="solar:users-group-rounded-bold-duotone" className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No staff members found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentStaff.map((staff, index) => (
            <motion.div
              key={staff.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                {staff.avatar ? (
                  <img
                    src={staff.avatar}
                    alt={staff.full_name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <Icon icon="solar:user-bold-duotone" className="w-7 h-7 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 truncate">{staff.full_name}</h4>
                  {(staff.job_title || staff.role) && (
                    <p className="text-sm text-gray-600 truncate">
                      {staff.job_title || staff.role}
                    </p>
                  )}
                  {staff.email && (
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {staff.email}
                    </p>
                  )}
                  {staff.id === selectedDepartment?.head_user_id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-2">
                      <Icon icon="solar:crown-bold" className="w-3 h-3" />
                      Department Head
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DepartmentStaffTab;