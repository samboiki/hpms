import { useEffect } from 'react';

/**
 * Custom hook to fix modal click issues
 * Ensures modals are always clickable and handles z-index conflicts
 */
export const useModalClickFix = (isOpen: boolean, modalId?: string) => {
  useEffect(() => {
    if (!isOpen) return;

    // Add debug mode check (remove in production)
    const debugMode = localStorage.getItem('modalDebugMode') === 'true';
    
    // Ensure modal portal root exists and has correct styles
    const ensurePortalRoot = () => {
      let portalRoot = document.getElementById('modal-portal-root');
      if (!portalRoot) {
        portalRoot = document.createElement('div');
        portalRoot.id = 'modal-portal-root';
        document.body.appendChild(portalRoot);
      }
      
      // Apply critical styles directly
      portalRoot.style.position = 'fixed';
      portalRoot.style.inset = '0';
      portalRoot.style.zIndex = '9999';
      portalRoot.style.pointerEvents = 'none';
      
      // Ensure children can receive events
      const children = portalRoot.children;
      for (let i = 0; i < children.length; i++) {
        (children[i] as HTMLElement).style.pointerEvents = 'auto';
      }
    };

    // Fix for competing z-index elements
    const fixZIndexConflicts = () => {
      // Find all high z-index elements that might interfere
      const highZIndexElements = document.querySelectorAll('[style*="z-index"]');
      highZIndexElements.forEach((el) => {
        const element = el as HTMLElement;
        const zIndex = parseInt(window.getComputedStyle(element).zIndex || '0');
        
        // If element has very high z-index and is not a modal, reduce it
        if (zIndex > 9000 && !element.closest('[role="dialog"]') && !element.closest('#modal-portal-root')) {
          element.dataset.originalZIndex = String(zIndex);
          element.style.zIndex = '8999';
        }
      });
    };

    // Ensure click events propagate correctly
    const fixClickPropagation = () => {
      const modalElements = document.querySelectorAll('[role="dialog"], [data-fullscreen-modal="true"]');
      modalElements.forEach((modal) => {
        const element = modal as HTMLElement;
        
        // Remove any pointer-events: none from modal children
        const allChildren = element.querySelectorAll('*');
        allChildren.forEach((child) => {
          const childElement = child as HTMLElement;
          if (window.getComputedStyle(childElement).pointerEvents === 'none') {
            childElement.style.pointerEvents = 'auto';
          }
        });
      });
    };

    // Add debug overlay if in debug mode
    const addDebugOverlay = () => {
      if (!debugMode) return;
      
      const debugOverlay = document.createElement('div');
      debugOverlay.className = 'modal-debug-overlay';
      debugOverlay.innerHTML = `
        <div>Modal Debug Info:</div>
        <div>Modal ID: ${modalId || 'unknown'}</div>
        <div>Portal Children: ${document.getElementById('modal-portal-root')?.children.length || 0}</div>
      `;
      document.body.appendChild(debugOverlay);
      
      return debugOverlay;
    };

    // Apply fixes
    ensurePortalRoot();
    fixZIndexConflicts();
    fixClickPropagation();
    const debugOverlay = addDebugOverlay();

    // Re-apply fixes on DOM mutations (for dynamic content)
    const observer = new MutationObserver(() => {
      ensurePortalRoot();
      fixClickPropagation();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Cleanup
    return () => {
      observer.disconnect();
      
      // Restore original z-index values
      const elementsWithOriginalZIndex = document.querySelectorAll('[data-original-z-index]');
      elementsWithOriginalZIndex.forEach((el) => {
        const element = el as HTMLElement;
        element.style.zIndex = element.dataset.originalZIndex || '';
        delete element.dataset.originalZIndex;
      });
      
      // Remove debug overlay
      if (debugOverlay) {
        debugOverlay.remove();
      }
    };
  }, [isOpen, modalId]);

  // Utility function to ensure an element is clickable
  const ensureClickable = (element: HTMLElement | null) => {
    if (!element) return;
    
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'pointer';
    element.style.userSelect = 'auto';
    
    // Ensure element is not covered by invisible elements
    const rect = element.getBoundingClientRect();
    const elementAtPoint = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    
    if (elementAtPoint && elementAtPoint !== element && !element.contains(elementAtPoint)) {
      console.warn('Element might be covered by:', elementAtPoint);
    }
  };

  return { ensureClickable };
};