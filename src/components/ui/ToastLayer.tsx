import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toaster, type ToasterProps } from 'react-hot-toast';
import { installPlainToasts } from '../../utils/plainToast';

// Error toasts never show the database's own wording (owner, 13 Oct 2026: plain words everywhere)
installPlainToasts();

// Toasts confirm what just happened ("Payment received") or why it failed, so they must show above every window.
// Full-screen visit screens and the dialogs over them use the highest z-index there is and are added to the end of
// <body> when they open; elements with the same z-index stack in page order. So the toasts get their own layer at
// that z-index, always moved back to the end of <body>. The layer has no size, so it never takes a click meant for
// the page (src/styles/modal-fix.css turns pointer events on for anything styled with this z-index).
export const TOAST_LAYER_Z_INDEX = 2147483647;

/** Moves `node` to the end of `parent` unless it is already there (so its own move does not loop). */
export function keepLast(parent: Element, node: Element): void {
  if (parent.lastElementChild !== node) parent.appendChild(node);
}

export const ToastLayer: React.FC<ToasterProps> = props => {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = document.createElement('div');
    node.setAttribute('data-toast-layer', '');
    Object.assign(node.style, { position: 'fixed', top: '0', left: '0', width: '0', height: '0', zIndex: String(TOAST_LAYER_Z_INDEX) });
    document.body.appendChild(node);
    const observer = new MutationObserver(() => keepLast(document.body, node));
    observer.observe(document.body, { childList: true });
    setLayer(node);
    return () => {
      observer.disconnect();
      node.remove();
    };
  }, []);

  return layer ? createPortal(<Toaster {...props} />, layer) : null;
};

export default ToastLayer;
