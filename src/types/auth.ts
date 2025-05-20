// src/types/auth.ts
import type { User, Session } from '@supabase/supabase-js';

export interface SignupFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  error: Error | null;
}

export interface AuthService {
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (values: SignupFormData) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  resendVerification: (email: string) => Promise<boolean>;
  checkAuth: () => Promise<{ isAuthenticated: boolean; user: User | null; session: Session | null }>;
  getUserRole: () => Promise<string | null>;
  isLoading: boolean;
  isConnected?: boolean;
}