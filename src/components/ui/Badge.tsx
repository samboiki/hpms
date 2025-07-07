import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'coral' | 'lavender' | 'azure' | 'gradient' | 'glass' | 'emerald' | 'amber' | 'slate' | 'orange' | 'rose';
  size?: 'sm' | 'md' | 'lg';
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
          'bg-emerald-100 text-emerald-800': variant === 'emerald',
          'bg-amber-100 text-amber-800': variant === 'amber',
          'bg-slate-100 text-slate-800': variant === 'slate',
          'bg-orange-100 text-orange-800': variant === 'orange',
          'bg-rose-100 text-rose-800': variant === 'rose',
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-3 py-1 text-sm': size === 'md',
          'px-4 py-1.5 text-base': size === 'lg',
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