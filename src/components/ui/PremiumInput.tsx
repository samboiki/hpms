import React from 'react';
import { Icon } from '@iconify/react';

interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  iconColor?: string;
}

export const PremiumInput = React.forwardRef<HTMLInputElement, PremiumInputProps>(({ 
  icon, 
  iconColor = 'text-gray-600',
  className = '',
  ...props 
}, ref) => {
  return (
    <div className="flex-1 relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <Icon 
              icon={icon} 
              className={`w-5 h-5 transition-colors duration-300 ${iconColor} group-hover:text-gray-700`}
            />
          </div>
        )}
        <input
          ref={ref}
          {...props}
          className={`relative w-full ${icon ? 'pl-12' : 'pl-4'} pr-4 py-3.5 bg-transparent text-base text-gray-800 placeholder-gray-600 focus:outline-none focus:placeholder-gray-500 transition-colors duration-300 ${className}`}
        />
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
});

interface PremiumTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: string;
  iconColor?: string;
}

export const PremiumTextarea = React.forwardRef<HTMLTextAreaElement, PremiumTextareaProps>(({ 
  icon, 
  iconColor = 'text-gray-600',
  className = '',
  ...props 
}, ref) => {
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
        {icon && (
          <div className="absolute left-4 top-4 z-10 pointer-events-none">
            <Icon 
              icon={icon} 
              className={`w-5 h-5 transition-colors duration-300 ${iconColor} group-hover:text-gray-700`}
            />
          </div>
        )}
        <textarea
          ref={ref}
          {...props}
          className={`relative w-full ${icon ? 'pl-12' : 'pl-4'} pr-4 py-3.5 bg-transparent text-base text-gray-800 placeholder-gray-600 focus:outline-none focus:placeholder-gray-500 transition-colors duration-300 resize-none ${className}`}
        />
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
});

interface PremiumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
}

export const PremiumSelect = React.forwardRef<HTMLSelectElement, PremiumSelectProps>(({ 
  icon, 
  iconColor = 'text-gray-600',
  className = '',
  children,
  ...props 
}, ref) => {
  return (
    <div className="flex-1 relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <Icon 
              icon={icon} 
              className={`w-5 h-5 transition-colors duration-300 ${iconColor} group-hover:text-gray-700`}
            />
          </div>
        )}
        <select
          ref={ref}
          {...props}
          className={`relative w-full ${icon ? 'pl-12' : 'pl-4'} pr-10 py-3.5 bg-transparent text-base text-gray-800 focus:outline-none transition-colors duration-300 appearance-none cursor-pointer ${className}`}
        >
          {children}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon 
            icon="solar:alt-arrow-down-bold-duotone" 
            className="w-5 h-5 text-gray-600"
          />
        </div>
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
});