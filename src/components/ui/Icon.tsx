import React from 'react';
import { Icon as IconifyIcon } from '@iconify/react';

interface IconProps {
  icon: string;
  className?: string;
  style?: React.CSSProperties;
}

const Icon: React.FC<IconProps> = ({ icon, className = '', style }) => {
  return (
    <IconifyIcon 
      icon={icon}
      className={className}
      style={style}
    />
  );
};

export default Icon;

// Solar Icon Set - Bold Duotone variants
export const SolarIcons = {
  // User & Profile
  user: 'solar:user-bold-duotone',
  userCircle: 'solar:user-circle-bold-duotone',
  users: 'solar:users-group-two-bold-duotone',
  
  // Security
  shield: 'solar:shield-bold-duotone',
  lock: 'solar:lock-keyhole-minimalistic-bold-duotone',
  key: 'solar:key-bold-duotone',
  
  // Settings & Configuration
  settings: 'solar:settings-bold-duotone',
  settingsMinimalistic: 'solar:settings-minimalistic-bold-duotone',
  tuning: 'solar:tuning-2-bold-duotone',
  
  // UI Elements
  palette: 'solar:palette-bold-duotone',
  paintbrush: 'solar:pallete-2-bold-duotone',
  sparkles: 'solar:magic-stick-2-bold-duotone',
  info: 'solar:info-circle-bold-duotone',
  
  // Communication
  bell: 'solar:bell-bold-duotone',
  mail: 'solar:letter-bold-duotone',
  phone: 'solar:phone-bold-duotone',
  
  // Location
  mapPin: 'solar:map-point-bold-duotone',
  globe: 'solar:earth-bold-duotone',
  
  // Business
  building: 'solar:buildings-bold-duotone',
  case: 'solar:case-bold-duotone',
  
  // Time
  clock: 'solar:clock-circle-bold-duotone',
  calendar: 'solar:calendar-bold-duotone',
  
  // Actions
  edit: 'solar:pen-new-square-bold-duotone',
  save: 'solar:diskette-bold-duotone',
  camera: 'solar:camera-bold-duotone',
  plus: 'solar:add-circle-bold-duotone',
  close: 'solar:close-circle-bold-duotone',
  check: 'solar:check-circle-bold-duotone',
  home: 'solar:home-bold-duotone',
  documentText: 'solar:document-text-bold-duotone',
  userCheck: 'solar:user-check-bold-duotone',
  wallet: 'solar:wallet-bold-duotone',
  cashOut: 'solar:cash-out-bold-duotone',
  listCheck: 'solar:list-check-bold-duotone',
  arrowUp: 'solar:arrow-up-bold-duotone',
  arrowDown: 'solar:alt-arrow-down-bold-duotone',
  plane: 'solar:plane-bold-duotone',
  messageText: 'solar:chat-square-text-bold-duotone',
  eye: 'solar:eye-bold-duotone',
  download: 'solar:download-bold-duotone',
  closeCircle: 'solar:close-circle-bold-duotone',
  userEdit: 'solar:user-edit-bold-duotone',
  
  // Storage & Data
  hardDrive: 'solar:server-bold-duotone',
  database: 'solar:database-bold-duotone',
  
  // Files & Documents
  document: 'solar:document-bold-duotone',
  folder: 'solar:folder-bold-duotone',
  image: 'solar:gallery-bold-duotone',
  
  // Navigation
  arrowRight: 'solar:alt-arrow-right-bold-duotone',
  
  // Status
  checkCircle: 'solar:check-circle-bold-duotone',
  infoCircle: 'solar:info-circle-bold-duotone',
  dangerCircle: 'solar:danger-circle-bold-duotone',
  
  // Additional icons for HR features
  history: 'solar:history-bold-duotone',
  award: 'solar:medal-star-bold-duotone',
  
  // Additional action icons
  trash: 'solar:trash-bin-trash-bold-duotone',
  refresh: 'solar:refresh-bold-duotone',
  logout: 'solar:logout-2-bold-duotone',
  
  // Branch management icons
  buildings: 'solar:buildings-2-bold-duotone',
  sunrise: 'solar:sunrise-bold-duotone',
  sunset: 'solar:sunset-bold-duotone',
  ambulatoryClinic: 'healthicons:ambulatory-clinic',
  usersGroupRounded: 'solar:users-group-rounded-bold-duotone',
};