import React from 'react';
import { Practice } from '@/lib/tenants';
import LocationMap from './LocationMap';

interface NewCharmContactProps {
  practice: Practice;
}

const NewCharmContact: React.FC<NewCharmContactProps> = () => {
  return (
    <>
      {/* Location Map Section - Full Width */}
      <section id="contact" className="w-full">
        <LocationMap />
      </section>
    </>
  );
};

export default NewCharmContact;