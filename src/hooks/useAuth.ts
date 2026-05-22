import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthMode = 'login' | 'register' | 'forgot-password';

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  register: (email: string, password: string, fullName: string) => Promise<{ user: User | null; session: Session | null }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signInAsGuest: () => Promise<User | null>;
  resetPassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!active) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!active) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw mapAuthError(error);
    return { user: data.user ?? null, session: data.session ?? null };
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) throw mapAuthError(error);
      return { user: data.user ?? null, session: data.session ?? null };
    },
    []
  );

  const signInAsGuest = useCallback(async (): Promise<User | null> => {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: { full_name: 'ضيف', is_guest: true },
      },
    });

    if (error) throw mapAuthError(error);
    return data.user ?? null;
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    );

    if (error) throw mapAuthError(error);
  }, []);

  const resetPassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw mapAuthError(error);
  }, []);

  const updateProfile = useCallback(
    async (updates: { full_name?: string; avatar_url?: string }) => {
      const { error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) throw mapAuthError(error);
    },
    []
  );

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });

    if (error) throw mapAuthError(error);
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw mapAuthError(error);
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    forgotPassword,
    signInAsGuest,
    resetPassword,
    updateProfile,
    resendConfirmation,
  };
}

function mapAuthError(error: AuthError): Error {
  const messages: Record<string, string> = {
    'Anonymous sign-ins are disabled': 'تسجيل الدخول كضيف غير مفعل حالياً في إعدادات Supabase',
    'Auth session missing!': 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى',
    'Email not confirmed': 'لم يتم تأكيد البريد الإلكتروني بعد',
    'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    'Same password should be used': 'استخدم كلمة مرور مختلفة عن السابقة',
    'Too many requests': 'محاولات كثيرة جداً، حاول مرة أخرى لاحقاً',
    'User already registered': 'هذا البريد مسجل مسبقاً',
    'User not found': 'لم يتم العثور على المستخدم',
    'New password should be different from the old password.': 'يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية',
  };

  const message = messages[error.message] || error.message;
  return new Error(message);
}
