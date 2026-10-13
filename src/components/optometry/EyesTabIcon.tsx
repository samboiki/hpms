import React from 'react';
import { Icon } from '@iconify/react';

/** The patient file's Eyes tab icon (Solar duotone, like the rest of the app); the tab bar passes its size and colour. */
const EyesTabIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Icon icon="solar:eye-bold-duotone" className={className} aria-hidden="true" />
);

export default EyesTabIcon;
