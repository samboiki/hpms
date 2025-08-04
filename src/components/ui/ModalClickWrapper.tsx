import React, { useEffect, useRef } from 'react';

interface ModalClickWrapperProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Wrapper component to ensure modal content is always clickable
 * Fixes common z-index and pointer-events issues
 */
export const ModalClickWrapper: React.FC<ModalClickWrapperProps> = ({ 
  children, 
  className = '',
  onClick
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Ensure all interactive elements are clickable
    const makeClickable = () => {
      // Set pointer events on wrapper
      wrapper.style.pointerEvents = 'auto';
      
      // Find all interactive elements
      const interactiveElements = wrapper.querySelectorAll(
        'button, a, input, textarea, select, [role="button"], [onclick], [tabindex]'
      );
      
      interactiveElements.forEach((el) => {
        const element = el as HTMLElement;
        element.style.pointerEvents = 'auto';
        element.style.cursor = 'pointer';
        
        // Add visual feedback for debugging
        if (process.env.NODE_ENV === 'development') {
          element.addEventListener('mouseenter', () => {
            element.style.outline = '2px solid blue';
            element.style.outlineOffset = '2px';
          });
          element.addEventListener('mouseleave', () => {
            element.style.outline = '';
            element.style.outlineOffset = '';
          });
        }
      });
    };

    makeClickable();

    // Re-apply on mutations
    const observer = new MutationObserver(makeClickable);
    observer.observe(wrapper, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    // Ensure click event propagates correctly
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div 
      ref={wrapperRef}
      className={`modal-click-wrapper ${className}`}
      onClick={handleClick}
      style={{
        pointerEvents: 'auto',
        position: 'relative',
        zIndex: 1
      }}
    >
      {children}
    </div>
  );
};