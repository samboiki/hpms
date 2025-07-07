import React from 'react';
import { cn } from '../../utils/cn';

interface NotificationBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  animate?: boolean;
  className?: string;
  offset?: { top?: string; right?: string; bottom?: string; left?: string };
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  size = 'md',
  position = 'top-right',
  animate = true,
  className,
  offset
}) => {
  if (count <= 0) return null;

  const sizeClasses = {
    sm: 'min-w-[20px] h-[20px] text-[10px]',
    md: 'min-w-[22px] h-[22px] text-[11px]',
    lg: 'min-w-[24px] h-[24px] text-xs'
  };

  const defaultPositionClasses = {
    'top-right': '-top-1 -right-1',
    'top-left': '-top-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
    'bottom-left': '-bottom-1 -left-1'
  };

  const displayCount = count > 99 ? '99+' : count.toString();

  // Apply custom offset or use default position
  const positionStyle = offset ? {
    ...(offset.top && { top: offset.top }),
    ...(offset.right && { right: offset.right }),
    ...(offset.bottom && { bottom: offset.bottom }),
    ...(offset.left && { left: offset.left })
  } : {};

  const isAbsolute = !className?.includes('absolute') && !className?.includes('relative');

  return (
    <div 
      className={cn(isAbsolute && 'absolute', isAbsolute && !offset && defaultPositionClasses[position], className)}
      style={positionStyle}
    >
      {/* Main badge - no complex animations for better browser support */}
      <div
        className={cn(
          'relative flex items-center justify-center',
          'bg-red-500 text-white font-bold rounded-full',
          'px-1.5 shadow-md border-2 border-white',
          'transform transition-transform duration-200',
          animate && 'hover:scale-110',
          sizeClasses[size]
        )}
        style={{
          // Ensure badge is always visible with high z-index
          zIndex: 50,
          // Force GPU acceleration for smoother rendering
          transform: 'translateZ(0)',
          // Ensure text doesn't get cut off
          minWidth: size === 'sm' ? '18px' : size === 'md' ? '22px' : '24px'
        }}
      >
        <span 
          className="relative z-10"
          style={{
            // Ensure text is always readable
            lineHeight: 1,
            letterSpacing: count > 99 ? '-0.5px' : '0'
          }}
        >
          {displayCount}
        </span>
        
        {/* Simple pulse effect - only on hover for better performance */}
        {animate && (
          <div 
            className="absolute inset-0 bg-red-500 rounded-full opacity-0 group-hover:animate-ping"
          />
        )}
      </div>

    </div>
  );
};

// Export a simple static badge for maximum compatibility
export const StaticBadge: React.FC<{ count: number; className?: string }> = ({ count, className }) => {
  if (count <= 0) return null;
  
  return (
    <span 
      className={cn(
        'inline-flex items-center justify-center',
        'px-2 py-0.5 text-xs font-bold',
        'bg-red-500 text-white rounded-full',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};