import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import PortalProvider from './PortalProvider';
import { usePortal } from './portalContext';
import { PATIENT_APP_PATH, redirectForSession } from './portalRouting';
import PortalLayout from './components/PortalLayout';
import { Card, LoadingBlock, SecondaryButton } from './components/PortalUi';
import HomePage from './pages/HomePage';
import AppointmentsPage from './pages/AppointmentsPage';
import { InvoiceDetailPage, InvoicesPage } from './pages/InvoicesPage';
import ResultsPage from './pages/ResultsPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import ProfilePage from './pages/ProfilePage';
import LinkPage from './pages/LinkPage';

/** A whole-screen message before anything can be shown (not switched on, could not load). */
const FullScreenMessage: React.FC<{ icon: string; title: string; text: string; onRetry?: () => void }> = ({ icon, title, text, onRetry }) => {
  const { signOut } = usePortal();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center px-4">
      <Card className="max-w-md mx-auto w-full text-center space-y-4 py-8">
        <Icon icon={icon} className="w-14 h-14 mx-auto text-cyan-600" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600">{text}</p>
        {onRetry && (
          <SecondaryButton icon="solar:refresh-bold-duotone" onClick={onRetry} className="w-full">
            Try again
          </SecondaryButton>
        )}
        <SecondaryButton icon="solar:logout-2-bold-duotone" onClick={() => void signOut()} className="w-full">
          Sign out
        </SecondaryButton>
      </Card>
    </div>
  );
};

const PortalRoutes: React.FC = () => {
  const location = useLocation();
  const { loadState, patients, reload } = usePortal();

  // Route guard: a patient only ever sees /me screens (staff addresses lead here)
  const redirect = redirectForSession('patient', location.pathname);
  if (redirect) return <Navigate to={redirect} replace />;

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (loadState === 'not_enabled') {
    return (
      <FullScreenMessage
        icon="solar:hourglass-bold-duotone"
        title="The patient app is not switched on yet"
        text="Your practice will tell you when you can use it. Until then, please phone the practice."
      />
    );
  }
  if (loadState === 'error') {
    return (
      <FullScreenMessage
        icon="solar:cloud-cross-bold-duotone"
        title="Could not load your records"
        text="Check your internet connection and try again."
        onRetry={() => void reload()}
      />
    );
  }

  // First sign-in (or every link revoked): confirm who you are before anything is shown
  if (patients.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-lg mx-auto px-4 py-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <LinkPage firstTime />
        </main>
      </div>
    );
  }

  return (
    <PortalLayout>
      <Routes>
        <Route path={PATIENT_APP_PATH} element={<HomePage />} />
        <Route path={`${PATIENT_APP_PATH}/appointments`} element={<AppointmentsPage />} />
        <Route path={`${PATIENT_APP_PATH}/invoices`} element={<InvoicesPage />} />
        <Route path={`${PATIENT_APP_PATH}/invoices/:invoiceId`} element={<InvoiceDetailPage />} />
        <Route path={`${PATIENT_APP_PATH}/results`} element={<ResultsPage />} />
        <Route path={`${PATIENT_APP_PATH}/prescriptions`} element={<PrescriptionsPage />} />
        <Route path={`${PATIENT_APP_PATH}/profile`} element={<ProfilePage />} />
        <Route path={`${PATIENT_APP_PATH}/link`} element={<LinkPage />} />
        <Route path="*" element={<Navigate to={PATIENT_APP_PATH} replace />} />
      </Routes>
    </PortalLayout>
  );
};

/**
 * The patient app: everything a patient sees after signing in with their cell number. App.tsx renders it
 * instead of the staff app for patient sessions, so no staff screen, layout or data loader is mounted.
 */
const PatientPortalApp: React.FC = () => (
  <PortalProvider>
    <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    <PortalRoutes />
  </PortalProvider>
);

export default PatientPortalApp;
