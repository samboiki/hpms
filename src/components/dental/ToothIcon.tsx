import React from 'react';

/** A tooth outline in the Solar duotone style (Solar has no tooth): the patient file's Teeth tab and the Teeth links. */
const ToothIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
    <path
      d="M7.5 3C5 3 3.5 5 3.5 7.5c0 2.2.9 3.6 1.6 5.2.6 1.4.8 3 1.1 4.8.3 2 .9 3.5 2.1 3.5 1.4 0 1.7-1.8 2-3.6.2-1.2.6-2.4 1.7-2.4s1.5 1.2 1.7 2.4c.3 1.8.6 3.6 2 3.6 1.2 0 1.8-1.5 2.1-3.5.3-1.8.5-3.4 1.1-4.8.7-1.6 1.6-3 1.6-5.2C20.5 5 19 3 16.5 3c-1.9 0-2.9 1-4.5 1S9.4 3 7.5 3z"
      fill="currentColor"
      fillOpacity={0.25}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </svg>
);

export default ToothIcon;
