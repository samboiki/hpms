import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { usePortal } from '../portalContext';
import type { LinkedPatient } from '../portalModel';

const NAV_ITEMS = [
  { to: '/me', label: 'Home', icon: 'solar:home-smile-bold-duotone', end: true },
  { to: '/me/appointments', label: 'Visits', icon: 'solar:calendar-bold-duotone', end: false },
  { to: '/me/invoices', label: 'Invoices', icon: 'solar:bill-list-bold-duotone', end: false },
  { to: '/me/results', label: 'Results', icon: 'solar:test-tube-bold-duotone', end: false },
  { to: '/me/prescriptions', label: 'Medicines', icon: 'solar:pills-bold-duotone', end: false },
];

/** "Maria", or "Maria (Dr Shikongo's practice)" when the same name appears at two practices. */
const switcherLabel = (patient: LinkedPatient, all: LinkedPatient[]): string => {
  const sameName = all.filter((other) => other.firstName === patient.firstName).length > 1;
  const name = patient.firstName || 'Patient';
  return sameName && patient.practiceName ? `${name}, ${patient.practiceName}` : name;
};

/** Whose records are shown: one chip per linked person (a parent and their children). */
const PatientSwitcher: React.FC = () => {
  const { patients, selected, selectPatient } = usePortal();
  if (patients.length < 2) return null;
  return (
    <div className="max-w-lg mx-auto px-4 pb-3 -mt-1 flex gap-2 overflow-x-auto" role="tablist" aria-label="Whose records to show">
      {patients.map((patient) => {
        const active = patient.patientId === selected?.patientId;
        return (
          <button
            key={patient.patientId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => selectPatient(patient.patientId)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
              active ? 'bg-cyan-600 text-white ring-cyan-600' : 'bg-white text-gray-700 ring-gray-200'
            }`}
          >
            <Icon icon={patient.relationship === 'child' ? 'solar:smile-circle-bold-duotone' : 'solar:user-bold-duotone'} className="w-4 h-4" aria-hidden="true" />
            {switcherLabel(patient, patients)}
          </button>
        );
      })}
    </div>
  );
};

const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#01b9d4] to-[#0197d4] flex items-center justify-center">
              <Icon icon="solar:health-bold-duotone" className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="font-semibold text-gray-900">OneHealth</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/me/profile')}
            className="p-2 rounded-xl text-gray-600 hover:bg-white"
            aria-label="My details"
            title="My details"
          >
            <Icon icon="solar:user-circle-bold-duotone" className="w-7 h-7" aria-hidden="true" />
          </button>
        </div>
        <PatientSwitcher />
      </header>

      <main className="max-w-lg mx-auto px-4 pt-2 pb-28">{children}</main>

      <nav
        className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)]"
        aria-label="Patient app"
      >
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-cyan-700' : 'text-gray-500'}`
              }
            >
              <Icon icon={item.icon} className="w-6 h-6" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default PortalLayout;
