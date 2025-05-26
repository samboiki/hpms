'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackGradient?: string;
  fallbackIcon?: React.ComponentType<any>;
}

export default function ImageWithFallback({ 
  src, 
  alt, 
  className = '', 
  fallbackGradient = 'from-gray-200 to-gray-300',
  fallbackIcon: FallbackIcon = ImageIcon
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (hasError) {
    return (
      <div className={`bg-gradient-to-br ${fallbackGradient} flex items-center justify-center ${className}`}>
        <div className="text-center">
          <FallbackIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-600 text-sm">{alt}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className={`absolute inset-0 bg-gradient-to-br ${fallbackGradient} flex items-center justify-center`}>
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
}