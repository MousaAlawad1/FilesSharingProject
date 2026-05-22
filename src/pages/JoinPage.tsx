import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserPlus,
  FolderOpen,
  LogIn,
  Users,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabaseWorkspaceService } from '@/services/api-services';
import { WorkspaceInvitePreview } from '@/types';
import { PageLoader } from '@/components/common/PageLoader';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signInAsGuest } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joiningAsGuest, setJoiningAsGuest] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('رابط غير صالح');
        setLoading(false);
        return;
      }

      try {
        const preview = await supabaseWorkspaceService.getInvitePreview(token);
        setWorkspace(preview);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل معلومات المساحة');
      }

      setLoading(false);
    };

    load();
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;

    setJoining(true);
    setError('');

    try {
      const joinedWorkspace = await supabaseWorkspaceService.joinByInviteToken(token);
      setSuccess('تم الانضمام بنجاح!');
      window.setTimeout(() => navigate(`/workspace/${joinedWorkspace.id}`), 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل الانضمام إلى المساحة');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinAsGuest = async () => {
    if (!token) return;

    setJoiningAsGuest(true);
    setError('');

    try {
      await signInAsGuest();
      const joinedWorkspace = await supabaseWorkspaceService.joinByInviteToken(token);
      setSuccess('تم الانضمام كضيف!');
      window.setTimeout(() => navigate(`/workspace/${joinedWorkspace.id}`), 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل الدخول كضيف');
    } finally {
      setJoiningAsGuest(false);
    }
  };

  if (loading || authLoading) {
    return <PageLoader label="جاري تحميل الدعوة..." />;
  }

  if (error && !workspace) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center text-fg-1 px-4" dir="rtl">
        <div className="text-center max-w-md rounded-3xl border border-line/70 bg-surface-1/80 p-8 shadow-2xl shadow-black/30">
          <p className="text-brick-soft text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-brass hover:bg-brass-hover px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center text-fg-1 p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-2/80 border border-line/70 rounded-3xl p-8 w-full max-w-md text-center shadow-2xl shadow-black/20"
      >
        <div className="w-14 h-14 bg-brass/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="w-7 h-7 text-brass" />
        </div>
        <h2 className="text-xl font-bold mb-1">انضم إلى مساحة العمل</h2>
        <p className="text-brass font-semibold text-lg mb-2">{workspace?.name}</p>
        {workspace?.description && (
          <p className="text-sm text-fg-3 mb-6 leading-7">{workspace.description}</p>
        )}

        {error && (
          <div className="bg-brick/10 border border-brick/40 rounded-xl p-3 text-brick-soft text-sm mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-sage/10 border border-sage/30 rounded-xl p-3 text-sage text-sm mb-4 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {success}
          </div>
        )}

        {user ? (
          <div>
            <p className="text-sm text-fg-3 mb-4">
              ستنضم بهذه الجلسة:{' '}
              <span className="text-fg-2">{user.email || user.user_metadata?.full_name || 'ضيف'}</span>
            </p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 bg-brass hover:bg-brass-hover disabled:opacity-50 py-3 rounded-xl font-medium transition-colors"
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الانضمام...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  الانضمام الآن
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 bg-brass hover:bg-brass-hover py-3 rounded-xl font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              تسجيل الدخول أو إنشاء حساب
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-line/60" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface-2/80 px-3 text-fg-3">أو</span>
              </div>
            </div>

            <button
              onClick={handleJoinAsGuest}
              disabled={joiningAsGuest}
              className="w-full flex items-center justify-center gap-2 bg-surface-3/60 hover:bg-surface-3 disabled:opacity-50 py-3 rounded-xl font-medium transition-colors text-sm"
            >
              {joiningAsGuest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  الدخول كضيف
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
