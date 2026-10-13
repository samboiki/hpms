// Testing automatic deployment for onehealth-practice - 2025-08-05
import { Suspense, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { lazyPage, lazyPatientScreen } from './components/layout/lazyScreen';
import Login from './pages/auth/Login';
import { useAuthStore } from './stores/authStore';
import { isPrevisitLocation } from './utils/clinical/previsitQuestions';

// The signed-in staff app (providers, layout, Dashboard and every staff route) is its own download, so the sign-in
// screen opens without first fetching the Dashboard and the diary. It is warmed while the sign-in form is in use.
const loadStaffApp = () => import('./StaffApp');
const StaffApp = lazyPage(loadStaffApp);

// Screens loaded when opened (lazyScreen.tsx): if the connection fails on the way, the screen tries again and then says
// "This page could not load" with "Try again", never an empty screen
// The patient app (cell number + SMS code logins) is loaded only when a patient signs in
const PatientPortalApp = lazyPatientScreen(() => import('./patientPortal/PatientPortalApp'));
// A patient's questions before a visit, opened from an SMS link without signing in (parity B17)
const PrevisitQuestionnairePage = lazyPatientScreen(() => import('./pages/PrevisitQuestionnairePage'));

/** Starts downloading the staff app once the sign-in form is in use (or after a short pause), so signing in is instant */
function useWarmStaffApp(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      loadStaffApp().catch(() => undefined); // a failed warm-up is retried when the staff app is opened
    };
    const timer = window.setTimeout(warm, 2500);
    document.addEventListener('focusin', warm, { once: true });
    document.addEventListener('pointerdown', warm, { once: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', warm);
      document.removeEventListener('pointerdown', warm);
    };
  }, [active]);
}

function App() {
  const { isAuthenticated, login, sessionKind } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Keep the spinner until the saved session is restored, so the login form doesn't flash on every reload
        login(session.user.email!, '').finally(() => setIsLoading(false));
        // Automations are sent by the server's sender (supabase/functions/process-automation-queue), never by a browser
      } else {
        // A patient whose session ended (signed out, expired) goes back to the sign-in screen
        useAuthStore.setState({ sessionKind: null });
        setIsLoading(false);
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Download the staff app while the saved session is restored, not after
        loadStaffApp().catch(() => undefined);
        login(session.user.email!, '').finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(error => {
      console.error('Error getting session:', error);
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [login]);

  useWarmStaffApp(!isLoading && !isAuthenticated && sessionKind !== 'patient');

  const spinner = (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );

  // #/q/<link code>: a patient answers their booking's questions without signing in, whoever is signed in on this device.
  // The page talks only to previsit_questionnaire(), which shows that booking's questions and nothing else
  if (isPrevisitLocation(window.location)) {
    return (
      <Suspense fallback={spinner}>
        <PrevisitQuestionnairePage />
      </Suspense>
    );
  }

  if (isLoading) {
    return spinner;
  }

  // A patient (cell number + SMS code) only ever gets the patient app: no staff route, layout or data loader
  // below is mounted for them, and every address outside /me leads to the patient app (portalRouting.ts)
  if (sessionKind === 'patient') {
    return (
      <Suspense fallback={spinner}>
        <PatientPortalApp />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Suspense fallback={spinner}>
      <StaffApp />
    </Suspense>
  );
}

export default App;