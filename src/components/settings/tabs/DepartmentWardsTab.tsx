import React from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

interface Ward {
  id: string;
  name: string;
  ward_type: string;
  total_beds: number;
  occupied_beds: number;
  department_id?: string;
}

interface DepartmentWardsTabProps {
  wards: Ward[];
  selectedDepartment: any;
}

const DepartmentWardsTab: React.FC<DepartmentWardsTabProps> = ({
  wards,
  selectedDepartment,
}) => {
  const departmentWards = wards.filter(
    ward => ward.department_id === selectedDepartment?.id
  );

  const getOccupancyColor = (occupancyRate: number) => {
    if (occupancyRate >= 90) return 'text-red-600 bg-red-50';
    if (occupancyRate >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getWardTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'general':
        return 'solar:home-hospital-bold-duotone';
      case 'icu':
        return 'solar:heart-pulse-bold-duotone';
      case 'emergency':
        return 'solar:siren-bold-duotone';
      case 'pediatric':
        return 'solar:baby-bold-duotone';
      case 'maternity':
        return 'solar:mother-bold-duotone';
      default:
        return 'solar:hospital-bed-bold-duotone';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Associated Wards</h3>
          <p className="text-sm text-gray-600">
            {departmentWards.length} ward{departmentWards.length !== 1 ? 's' : ''} in this department
          </p>
        </div>
      </div>

      {departmentWards.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Icon icon="solar:hospital-bed-bold-duotone" className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No wards assigned to this department</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentWards.map((ward, index) => {
            const occupancyRate = ward.total_beds > 0
              ? Math.round((ward.occupied_beds / ward.total_beds) * 100)
              : 0;

            return (
              <motion.div
                key={ward.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                      <Icon
                        icon={getWardTypeIcon(ward.ward_type)}
                        className="w-5 h-5 text-white"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{ward.name}</h4>
                      <p className="text-xs text-gray-500 capitalize">{ward.ward_type || 'General'} Ward</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Occupancy</span>
                    <span className={`text-sm font-semibold px-2 py-1 rounded-full ${getOccupancyColor(occupancyRate)}`}>
                      {occupancyRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Beds</span>
                    <span className="text-sm font-medium text-gray-800">
                      {ward.occupied_beds}/{ward.total_beds}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        occupancyRate >= 90
                          ? 'bg-red-500'
                          : occupancyRate >= 70
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DepartmentWardsTab;