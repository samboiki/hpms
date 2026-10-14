import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TestCommunication from './pages/TestCommunication';
import TestSMSSend from './pages/TestSMSSend';
import TestSMSDirectSend from './pages/TestSMSDirectSend';
import WorkingSMSTest from './pages/WorkingSMSTest';
import TestSMSWithAuth from './pages/TestSMSWithAuth';
import Layout from './components/layout/Layout';
import { lazyPage } from './components/layout/lazyScreen';
import { PAGE_LOADERS } from './pageLoaders';
import Login from './pages/auth/Login';
import SetPassword from './pages/auth/SetPassword';
import { useAuthStore } from './stores/authStore';
import NotFound from './pages/NotFound';
import { ToastLayer } from './components/ui/ToastLayer';
import { PracticeTariffsProvider } from './contexts/PracticeTariffsContext';
import { PracticeProvider } from './contexts/PracticeContext';
import ThemeProvider from './components/providers/ThemeProvider';
import UniversalCallback from './pages/oauth/UniversalCallback';
import TestCursor from './pages/TestCursor';
import { CacheWarmer } from './components/CacheWarmer';
import TestCache from './pages/TestCache';
import TestQueryProtection from './pages/TestQueryProtection';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { PATIENT_APP_PATH } from './patientPortal/portalRouting';
import { useScreenAccess } from './hooks/useScreenAccess';
import { screenGate, type GuardedScreen } from './utils/auth/screenAccess';
import { ScreenAccessNotice, type FollowingPage } from './components/access/ScreenAccessNotice';
import OptometryRedirect from './components/optometry/OptometryRedirect';

/**
 * Everything a signed-in staff member gets: the providers, the layout, the Dashboard and every staff route. App.tsx
 * loads this module only once someone is signed in (and warms it while the sign-in form is being filled in), so the
 * sign-in screen no longer downloads the Dashboard, the diary and their services first.
 */

// Screens loaded when opened (lazyScreen.tsx): if the connection fails on the way, the screen tries again and then says
// "This page could not load" with "Try again", never an empty screen
// Stock and dispensing (proposals/2026-10-07-dispensing-and-stock.sql), loaded when opened
const StockPage = lazyPage(PAGE_LOADERS['/stock']);
// Wards, beds and admitted patients (proposals/2026-10-13-inpatient-module.sql), loaded when opened
const InpatientPage = lazyPage(PAGE_LOADERS['/inpatient']);
// Every other staff page is also loaded when first opened, so a phone downloads only the sign-in screen, the layout and
// the Dashboard before the first screen shows (the installed app still keeps every page for offline start)
const Patients = lazyPage(PAGE_LOADERS['/patients']);
const Encounters = lazyPage(PAGE_LOADERS['/encounters']);
const Communications = lazyPage(PAGE_LOADERS['/communications']);
const Finance = lazyPage(PAGE_LOADERS['/finance']);
const PracticesManagement = lazyPage(PAGE_LOADERS['/admin/practices']);
const TariffManagement = lazyPage(PAGE_LOADERS['/admin/tariffs']);
const FundMaster = lazyPage(PAGE_LOADERS['/admin/funds']);
const SystemBlueprint = lazyPage(PAGE_LOADERS['/admin/blueprint']);
const Settings = lazyPage(PAGE_LOADERS['/settings']);

// Older links go to /patients/<id> (optionally ?visit=<id>) or /patients/<id>/visit/<id> (the old patient page, removed
// 13 Oct 2026: nothing linked to it); the Patients page opens a patient and a visit from its query string, so send them
// there instead of to "page not found"
const PatientLinkRedirect: React.FC = () => {
  const { patientId, visitId: visitInPath } = useParams();
  const [searchParams] = useSearchParams();
  const target = new URLSearchParams({ patientId: patientId ?? '' });
  const visitId = visitInPath ?? searchParams.get('visit');
  if (visitId) {
    target.set('visitId', visitId);
    target.set('action', 'edit-visit');
  }
  return <Navigate to={`/patients?${target.toString()}`} replace />;
};

// Route guard: admin pages need an admin (or super admin); the emergency export needs a super admin.
// Everyone else gets the standard not-found page instead of the tool. Finance and Stock (screen) open for the roles
// the practice's administrators allow (Settings > Users > Screen access, src/utils/auth/screenAccess.ts); anyone
// else, also when following a link from another screen, is told to ask their administrator. A page that follows a
// screen's access (Optometry follows Stock) says so under its own name (page).
type RequireRoleProps = { children: React.ReactElement } & ({ allow: 'admin' | 'super_admin' } | { screen: GuardedScreen; page?: FollowingPage });
const RequireRole: React.FC<RequireRoleProps> = (props) => {
  const user = useAuthStore((state) => state.user);
  const screenAccess = useScreenAccess();
  if ('screen' in props) {
    const gate = screenGate(user, props.screen, screenAccess);
    return gate === 'open' ? props.children : <ScreenAccessNotice screen={props.screen} gate={gate} onRetry={screenAccess.retry} page={props.page} />;
  }
  const allowed = !!user && (user.is_super_admin === true || (props.allow === 'admin' && user.role === 'admin'));
  return allowed ? props.children : <NotFound />;
};

export default function StaffApp() {
  const spinner = (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <PracticeProvider>
      <ThemeProvider>
        <PracticeTariffsProvider>
          <CacheWarmer />
          {/* RoutePrefetcher is no longer mounted: its cache (lib/lightningCache.ts) is a stub that keeps nothing, so on
              every Dashboard visit it read all patients and today's visits, and on Patients all patients plus one count per
              patient for 20 patients, only to throw the rows away (Oct 2026) */}
          {/* Developer tool: never shipped to clinic staff */}
          {import.meta.env.DEV && <PerformanceMonitor />}
          {/* Above every window, full-screen visit screens included */}
          <ToastLayer
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Staff invitation and "new link" emails land here, signed in by the link, to choose a password */}
            <Route path="/set-password" element={<SetPassword />} />
            {/* Test pages exist only in local development, never in the deployed app */}
            {import.meta.env.DEV && <Route path="/test-cursor" element={<TestCursor />} />}
            {import.meta.env.DEV && <Route path="/test-cache" element={<TestCache />} />}
            {import.meta.env.DEV && <Route path="/test-protection" element={<TestQueryProtection />} />}
            <Route path="/oauth/universal-callback" element={<UniversalCallback />} />
            <Route path="/api/oauth/callback" element={<UniversalCallback />} />
            {/* The patient app is for patient logins; staff opening its address get their own app */}
            <Route path={`${PATIENT_APP_PATH}/*`} element={<Navigate to="/" replace />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="patients" element={<Suspense fallback={spinner}><Patients /></Suspense>} />
              <Route path="patients/:patientId" element={<PatientLinkRedirect />} />
              <Route path="patients/:patientId/visit/:visitId" element={<PatientLinkRedirect />} />
              <Route path="encounters" element={<Suspense fallback={spinner}><Encounters /></Suspense>} />
              <Route path="communications" element={<Suspense fallback={spinner}><Communications /></Suspense>} />
              {/* SMS test pages: local development only (test-sms-direct bypasses the SMS gateway) */}
              {import.meta.env.DEV && <Route path="test-communication" element={<TestCommunication />} />}
              {import.meta.env.DEV && <Route path="test-sms-send" element={<TestSMSSend />} />}
              {import.meta.env.DEV && <Route path="test-sms-direct" element={<TestSMSDirectSend />} />}
              {import.meta.env.DEV && <Route path="working-sms-test" element={<WorkingSMSTest />} />}
              {import.meta.env.DEV && <Route path="test-sms-auth" element={<TestSMSWithAuth />} />}
              <Route path="finance" element={<RequireRole screen="finance"><Suspense fallback={spinner}><Finance /></Suspense></RequireRole>} />
              <Route path="inpatient" element={<RequireRole screen="inpatient"><Suspense fallback={spinner}><InpatientPage /></Suspense></RequireRole>} />
              <Route path="stock" element={<RequireRole screen="stock"><Suspense fallback={spinner}><StockPage /></Suspense></RequireRole>} />
              {/* The Optometry page was merged into Stock (owner, 13 Oct 2026): old addresses open the same part there */}
              <Route path="optometry" element={<OptometryRedirect />} />
              <Route path="admin/practices" element={<RequireRole allow="admin"><Suspense fallback={spinner}><PracticesManagement /></Suspense></RequireRole>} />
              <Route path="admin/tariffs" element={<RequireRole allow="admin"><Suspense fallback={spinner}><TariffManagement /></Suspense></RequireRole>} />
              {/* Medical aid funds: OneHealth support changes them, practice administrators read them and keep notes */}
              <Route path="admin/funds" element={<RequireRole allow="admin"><Suspense fallback={spinner}><FundMaster /></Suspense></RequireRole>} />
              <Route path="admin/blueprint" element={<RequireRole allow="admin"><Suspense fallback={spinner}><SystemBlueprint /></Suspense></RequireRole>} />
              <Route path="settings" element={<Suspense fallback={spinner}><Settings /></Suspense>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </PracticeTariffsProvider>
      </ThemeProvider>
    </PracticeProvider>
  );
}
