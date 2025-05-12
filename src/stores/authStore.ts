import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  avatar?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// For demo purposes, we're using a mock user
const mockUser: User = {
  id: '1',
  name: 'Dr. Jane Smith',
  email: 'jane.smith@example.com',
  role: 'doctor',
  avatar: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=200',
};

export const useAuthStore = create<AuthState>((set) => ({
  // For demo purposes, we're setting isAuthenticated to true by default
  isAuthenticated: true,
  user: mockUser,
  login: async (email: string, password: string) => {
    // Simulating a login API call
    if (email && password) {
      set({ isAuthenticated: true, user: mockUser });
      return true;
    }
    return false;
  },
  logout: () => {
    set({ isAuthenticated: false, user: null });
  },
}));