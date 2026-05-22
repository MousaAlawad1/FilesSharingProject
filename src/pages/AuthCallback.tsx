import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/common/PageLoader';

function getUrlError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return (
    searchParams.get('error_description') ||
    searchParams.get('error') ||
    hashParams.get('error_description') ||
    hashParams.get('error')
  );
}

function getFlowType() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return searchParams.get('type') || hashParams.get('type');
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const handleAuthCallback = async () => {
      const callbackError = getUrlError();
      if (callbackError) {
        navigate(`/auth/error?msg=${encodeURIComponent(callbackError)}`, {
          replace: true,
        });
        return;
      }

      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.getSession();
          if (error) throw error;
        }

        if (!active) return;

        if (getFlowType() === 'recovery') {
          navigate('/auth/reset-password', { replace: true });
          return;
        }

        navigate('/dashboard', { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'تعذر إكمال المصادقة';
        navigate(`/auth/error?msg=${encodeURIComponent(message)}`, {
          replace: true,
        });
      }
    };

    handleAuthCallback();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <PageLoader label="جاري معالجة المصادقة..." />;
}
