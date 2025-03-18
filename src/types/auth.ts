// src/types/auth.ts
export interface UserSession {
    id: string
    email: string
    role: 'user' | 'admin'
    user_type: 'student' | 'resident' | 'fellow' | 'attending' | 'other'
    first_name?: string
    last_name?: string
  }
  
  export interface AuthFormData {
    email: string
    password: string
  }
  
  export interface SignupFormData extends AuthFormData {
    firstName: string
    lastName: string
    userType: 'student' | 'resident' | 'fellow' | 'attending' | 'other'
  }
  
  export interface ResetPasswordFormData {
    password: string
    confirmPassword: string
  }