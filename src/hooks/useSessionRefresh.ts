import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const MIN_DELAY_MS = 30 * 1000;

export function useSessionRefresh(session: Session | null, enabled = true) {
  useEffect(() => {
    if (!enabled || !session?.expires_at) {
      return;
    }

    let cancelled = false;
    const expiresAtMs = session.expires_at * 1000;
    const delay = Math.max(expiresAtMs - Date.now() - REFRESH_BUFFER_MS, MIN_DELAY_MS);

    const timer = window.setTimeout(async () => {
      if (cancelled) {
        return;
      }

      try {
        await supabase.auth.refreshSession();
      } catch (error) {
        console.warn('تعذر تجديد الجلسة تلقائياً', error);
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, session?.access_token, session?.expires_at]);
}
