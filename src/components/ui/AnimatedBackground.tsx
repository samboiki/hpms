import React from 'react';

interface AnimatedBackgroundProps {
  variant?: 'default' | 'header' | 'sidebar' | 'main';
  children?: React.ReactNode;
  className?: string;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ 
  variant = 'default', 
  children, 
  className = '' 
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'header':
        return 'bg-gradient-to-br from-gray-100 via-gray-100/80 to-gray-50';
      case 'sidebar':
        return 'bg-gradient-to-br from-gray-50 via-gray-100/40 to-gray-50';
      case 'main':
        return 'bg-gradient-to-br from-white via-gray-50/30 to-gray-100/20';
      default:
        return 'bg-gradient-to-br from-gray-50 via-gray-100/50 to-gray-50';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Base animated gradient */}
      <div className={`absolute inset-0 ${getVariantClasses()} animate-gradient-shift`} />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export const AnimatedPageBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen relative">
      {/* Main background gradient - light grey */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-gray-100/50 to-gray-50 animate-gradient-shift" />
      
      {/* Secondary moving gradient - subtle grey */}
      <div className="fixed inset-0 bg-gradient-to-tr from-transparent via-gray-200/10 to-transparent animate-gradient-diagonal" />
      
      {/* Noise texture */}
      <div 
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};