import React from 'react';
import { Icon } from '@iconify/react';

interface DuotoneIconProps {
  icon: string;
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

// Map of lucide icon names to Solar duotone equivalents
export const iconMap: Record<string, string> = {
  // Dashboard & Navigation
  'activity': 'solar:pulse-bold-duotone',
  'layout-dashboard': 'solar:widget-bold-duotone',
  'users': 'solar:users-group-rounded-bold-duotone',
  'user-round': 'solar:user-circle-bold-duotone',
  'user-check': 'solar:user-check-bold-duotone',
  
  // UI Controls
  'chevron-left': 'solar:alt-arrow-left-bold-duotone',
  'chevron-right': 'solar:alt-arrow-right-bold-duotone',
  'chevron-up': 'solar:alt-arrow-up-bold-duotone',
  'chevron-down': 'solar:alt-arrow-down-bold-duotone',
  'x': 'solar:close-circle-bold-duotone',
  'x-circle': 'solar:close-circle-bold-duotone',
  'plus': 'solar:add-circle-bold-duotone',
  'expand': 'solar:maximize-square-bold-duotone',
  'minimize': 'solar:minimize-square-bold-duotone',
  
  // Status & Alerts
  'alert-circle': 'solar:danger-circle-bold-duotone',
  'check-circle-2': 'solar:check-circle-bold-duotone',
  'check-circle': 'solar:check-circle-bold-duotone',
  'bell': 'solar:bell-bold-duotone',
  'clock': 'solar:clock-circle-bold-duotone',
  
  // Medical & Health
  'microscope': 'solar:test-tube-bold-duotone',
  'stethoscope': 'solar:stethoscope-bold-duotone',
  'pill': 'solar:pills-bold-duotone',
  'flask-conical': 'solar:test-tube-minimalistic-bold-duotone',
  
  // Business & Finance
  'dollar-sign': 'solar:dollar-bold-duotone',
  'building-2': 'solar:buildings-bold-duotone',
  'crown': 'solar:crown-bold-duotone',
  
  // Communication
  'message-square': 'solar:chat-square-bold-duotone',
  'file-text': 'solar:document-text-bold-duotone',
  
  // Calendar & Time
  'calendar': 'solar:calendar-bold-duotone',
  
  // Settings & System
  'cog': 'solar:settings-bold-duotone',
  'log-out': 'solar:logout-bold-duotone',
  'moon': 'solar:moon-bold-duotone',
  'sun': 'solar:sun-bold-duotone',
  
  // Stats & Analytics
  'trending-up': 'solar:graph-up-bold-duotone',
  'sparkles': 'solar:star-shine-bold-duotone',
};

const DuotoneIcon: React.FC<DuotoneIconProps> = ({ 
  icon,
  className = "w-5 h-5",
  primaryColor,
  secondaryColor
}) => {
  const iconName = iconMap[icon.toLowerCase()] || icon;
  
  // Custom style for duotone colors if provided
  const style = (primaryColor || secondaryColor) ? {
    color: primaryColor || 'currentColor',
    '--svg-secondary-color': secondaryColor || primaryColor || 'currentColor'
  } as React.CSSProperties : undefined;

  return (
    <Icon 
      icon={iconName} 
      className={className}
      style={style}
    />
  );
};

export default DuotoneIcon;