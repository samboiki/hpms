import React from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

interface Room {
  id: string;
  room_number: string;
  room_name: string;
  room_type: string;
  status: string;
  department_id?: string;
}

interface DepartmentRoomsTabProps {
  rooms: Room[];
  selectedDepartment: any;
}

const DepartmentRoomsTab: React.FC<DepartmentRoomsTabProps> = ({
  rooms,
  selectedDepartment,
}) => {
  const departmentRooms = rooms.filter(
    room => room.department_id === selectedDepartment?.id
  );

  const getRoomStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'occupied':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reserved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoomTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'consultation':
        return 'solar:stethoscope-bold-duotone';
      case 'procedure':
        return 'solar:syringe-bold-duotone';
      case 'surgery':
        return 'solar:scalpel-bold-duotone';
      case 'recovery':
        return 'solar:bed-bold-duotone';
      case 'emergency':
        return 'solar:siren-bold-duotone';
      default:
        return 'solar:door-bold-duotone';
    }
  };

  const groupedRooms = departmentRooms.reduce((acc, room) => {
    const type = room.room_type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Department Rooms</h3>
          <p className="text-sm text-gray-600">
            {departmentRooms.length} room{departmentRooms.length !== 1 ? 's' : ''} in this department
          </p>
        </div>
      </div>

      {departmentRooms.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Icon icon="solar:door-bold-duotone" className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No rooms assigned to this department</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRooms).map(([type, typeRooms]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <Icon
                  icon={getRoomTypeIcon(type)}
                  className="w-5 h-5 text-indigo-600"
                />
                <h4 className="font-semibold text-gray-800">{type} Rooms</h4>
                <span className="text-sm text-gray-500">({typeRooms.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {typeRooms.map((room, index) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-2 rounded-lg p-3 ${getRoomStatusColor(room.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{room.room_number}</p>
                        {room.room_name && (
                          <p className="text-xs opacity-75">{room.room_name}</p>
                        )}
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {room.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DepartmentRoomsTab;