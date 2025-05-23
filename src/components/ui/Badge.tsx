import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'coral' | 'lavender' | 'azure' | 'gradient' | 'glass';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'glass',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-full transition-all duration-300',
        {
          'bg-accent-coral/10 text-accent-coral': variant === 'coral',
          'bg-accent-lavender/10 text-accent-lavender': variant === 'lavender',
          'bg-accent-azure/10 text-accent-azure': variant === 'azure',
          'bg-gradient-primary from-primary-start to-primary-end text-white': variant === 'gradient',
          'glass-card text-gray-800': variant === 'glass',
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-3 py-1 text-sm': size === 'md',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge