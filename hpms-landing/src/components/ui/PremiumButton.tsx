'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PremiumButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'glass';
  size?: 'small' | 'medium' | 'large';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  gradient?: string;
  className?: string;
  disabled?: boolean;
}

export default function PremiumButton({
  children,
  onClick,
  href,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'right',
  fullWidth = false,
  gradient,
  className = '',
  disabled = false
}: PremiumButtonProps) {
  const sizeClasses = {
    small: 'px-4 py-2 text-sm',
    medium: 'px-6 py-3 text-base',
    large: 'px-8 py-4 text-lg'
  };

  const baseClasses = `
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    relative
    font-semibold
    rounded-xl
    transition-all
    duration-300
    flex
    items-center
    justify-center
    gap-2
    group
    overflow-hidden
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

  const variantClasses = {
    primary: `
      text-white
      shadow-lg
      hover:shadow-2xl
      transform
      hover:-translate-y-0.5
    `,
    secondary: `
      text-gray-800
      bg-white
      shadow-md
      hover:shadow-xl
      transform
      hover:-translate-y-0.5
    `,
    outline: `
      bg-transparent
      border-2
      hover:shadow-lg
      transform
      hover:-translate-y-0.5
    `,
    glass: `
      backdrop-blur-lg
      bg-white/10
      text-white
      border
      border-white/20
      shadow-lg
      hover:shadow-2xl
      hover:bg-white/20
      transform
      hover:-translate-y-0.5
    `
  };

  const content = (
    <>
      {/* Gradient background for primary variant */}
      {variant === 'primary' && (
        <div 
          className="absolute inset-0 opacity-100 transition-opacity duration-300"
          style={{ background: gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        />
      )}

      {/* Hover effect overlay */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        initial={false}
        whileHover={{
          background: variant === 'primary' 
            ? 'radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)'
            : 'radial-gradient(circle at center, rgba(0,0,0,0.05) 0%, transparent 70%)'
        }}
      />

      {/* Ripple effect on click */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={false}
        whileTap={{
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 100%)',
          scale: [1, 1.5],
          opacity: [1, 0]
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Button content */}
      <span className="relative z-10 flex items-center gap-2">
        {icon && iconPosition === 'left' && (
          <motion.span
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            {icon}
          </motion.span>
        )}
        {children}
        {icon && iconPosition === 'right' && (
          <motion.span
            whileHover={{ x: 5 }}
            transition={{ duration: 0.3 }}
          >
            {icon}
          </motion.span>
        )}
      </span>

      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100"
        initial={{ x: '-100%', opacity: 0 }}
        whileHover={{ x: '100%', opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.6 }}
      >
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
      </motion.div>
    </>
  );

  const buttonElement = (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {content}
    </motion.button>
  );

  const linkElement = (
    <motion.a
      href={href}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {content}
    </motion.a>
  );

  return href ? linkElement : buttonElement;
}