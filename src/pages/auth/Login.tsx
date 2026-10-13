import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, AccountDeactivatedError } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import { Building2, Lock, Mail, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import PatientSignIn from './PatientSignIn';

type SignInMode = 'staff' | 'patient';
// One sign-in screen for everyone: staff use email and password, patients their cell number and an SMS code.
// The choice is remembered on this device (a patient's phone opens on "Patient" next time).
const SIGN_IN_MODE_KEY = 'hpms-sign-in-mode';

const savedSignInMode = (): SignInMode => {
  try {
    return localStorage.getItem(SIGN_IN_MODE_KEY) === 'patient' ? 'patient' : 'staff';
  } catch {
    return 'staff';
  }
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<SignInMode>(savedSignInMode);
  
  const chooseMode = (next: SignInMode) => {
    setMode(next);
    setError('');
    try {
      localStorage.setItem(SIGN_IN_MODE_KEY, next);
    } catch {
      // Private browsing: the choice is simply not remembered
    }
  };

  const { login } = useAuthStore();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err instanceof AccountDeactivatedError
          ? err.message
          : 'An error occurred during login. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] rounded-2xl flex items-center justify-center shadow-lg">
                <Building2 size={32} className="text-white" />
              </div>
            </div>
            <h2 className="text-[30px] font-bold font-heading text-[#494c61]">
              {mode === 'patient' ? 'Patient sign-in' : 'Welcome Back'}
            </h2>
            <p className="mt-2 text-gray-600">
              {mode === 'patient' ? 'Your appointments, invoices and results' : 'Sign in to access your account'}
            </p>
          </div>
          
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Who is signing in">
            {(['staff', 'patient'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                onClick={() => chooseMode(option)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  mode === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon
                  icon={option === 'staff' ? 'solar:stethoscope-bold-duotone' : 'solar:user-heart-bold-duotone'}
                  className="w-5 h-5"
                  aria-hidden="true"
                />
                {option === 'staff' ? 'Staff' : 'Patient'}
              </button>
            ))}
          </div>

          {mode === 'patient' ? <PatientSignIn /> : (<>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-center"
            >
              <AlertCircle size={20} className="mr-2 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={20} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* No "Remember me": Supabase always keeps the session. There is no self-service password reset,
                so the link goes to support */}
            <div className="flex items-center justify-end">
              <div className="text-sm">
                <a
                  href="mailto:support@onehealthsystems.com?subject=Password%20reset"
                  className="font-medium text-brand-primary hover:text-brand-dark"
                >
                  Forgot password? Email support
                </a>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#01b9d4] to-[#0197d4] hover:from-[#0197d4] hover:to-[#01b9d4] transition-all duration-300"
              isLoading={isLoading}
            >
              Sign in
            </Button>
          </form>

          {/* Demo account shortcuts are for local development only, like the test routes in App.tsx */}
          {import.meta.env.DEV && (
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Demo Accounts</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@example.com');
                  setPassword('password123');
                }}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Admin Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('doctor@example.com');
                  setPassword('password123');
                }}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Doctor Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('nurse@example.com');
                  setPassword('password123');
                }}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Nurse Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('receptionist@example.com');
                  setPassword('password123');
                }}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Receptionist Login
              </button>
            </div>
          </div>
          )}
          </>)}
        </motion.div>
      </div>
    </div>
  );
};

export default Login;