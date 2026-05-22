import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FolderOpen,
  Users,
  HardDrive,
  LogOut,
  Upload,
  Loader2,
  Search,
  LayoutGrid,
  List,
  User,
  CheckCircle2,
  Trash2,
  Activity,
  ShieldCheck,
  Layers3,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabaseWorkspaceService } from '@/services/api-services';
import { fileService } from '@/services/supabase-services';
import { NotificationBell } from '@/components/common/NotificationBell';
import { Workspace, WorkspaceActivity } from '@/types';

type ViewMode = 'grid' | 'list';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [storageMap, setStorageMap] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [recentActivity, setRecentActivity] = useState<WorkspaceActivity[]>([]);

  const loadWorkspaces = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const workspaceList = await supabaseWorkspaceService.listForCurrentUser();
      setWorkspaces(workspaceList);

      const [storageEntries, recentLogs] = await Promise.all([
        Promise.all(
          workspaceList.map(async (workspace) => {
            const storage = await supabaseWorkspaceService.getStorage(workspace.id);
            return [workspace.id, storage.used] as const;
          })
        ),
        supabaseWorkspaceService.getRecentActivity(6),
      ]);

      setStorageMap(Object.fromEntries(storageEntries));
      setRecentActivity(recentLogs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مساحات العمل');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setError('');

    try {
      await supabaseWorkspaceService.create(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await loadWorkspaces();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء مساحة العمل');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    if (deleting) return;

    setDeleting(true);
    setError('');

    try {
      await supabaseWorkspaceService.deleteWorkspace(workspaceId);
      setDeleteConfirm(null);
      await loadWorkspaces();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف مساحة العمل');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workspace.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName = user?.user_metadata?.full_name || user?.email || 'مستخدم';
  const ownedWorkspacesCount = workspaces.filter((workspace) => workspace.owner_id === user?.id).length;
  const totalUsedStorage = Object.values(storageMap).reduce((sum, value) => sum + value, 0);
  const totalStorageQuota = workspaces.reduce((sum, workspace) => sum + workspace.max_storage_mb * 1024 * 1024, 0);
  const overallStoragePercentage = totalStorageQuota > 0 ? (totalUsedStorage / totalStorageQuota) * 100 : 0;
  const stats = [
    {
      title: 'إجمالي المساحات',
      value: String(workspaces.length),
      hint: 'كل المساحات التي تنتمي إليها حالياً',
      icon: Layers3,
    },
    {
      title: 'المساحات التي تملكها',
      value: String(ownedWorkspacesCount),
      hint: 'المساحات التي يمكنك التحكم الكامل بها',
      icon: ShieldCheck,
    },
    {
      title: 'التخزين المستخدم',
      value: fileService.formatSize(totalUsedStorage),
      hint: `${overallStoragePercentage.toFixed(1)}% من إجمالي السعات المجمعة`,
      icon: HardDrive,
    },
  ];

  return (
    <div className="min-h-screen bg-ink text-fg-1" dir="rtl">
      <header className="glass-header sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-brass/30"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--brass) / 0.25), hsl(var(--brass) / 0.05))',
                boxShadow: 'inset 0 1px 0 0 hsl(var(--sheen) / 0.20), 0 2px 6px -2px hsl(var(--brass) / 0.4)',
              }}
            >
              <Upload className="h-4 w-4 text-brass-ring" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Shairley <span className="font-normal text-fg-3">· شيّرلي</span></h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-fg-4">Workspace console</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden items-center gap-2 rounded-xl border border-line/70 bg-surface-2/70 px-3 py-2 text-xs text-fg-2 sm:flex">
              <User className="h-3.5 w-3.5 text-fg-3" />
              <span className="max-w-[140px] truncate">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost h-10 w-10 rounded-xl border border-line/70 bg-surface-2/60 !p-0"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {stats.map((stat) => (
            <div key={stat.title} className="surface-elevated accent-top relative overflow-hidden p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-fg-4">{stat.title}</p>
                  <p className="metric mt-3">{stat.value}</p>
                  <p className="mt-2 text-xs leading-5 text-fg-3">{stat.hint}</p>
                </div>
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brass/25"
                  style={{
                    background: 'linear-gradient(180deg, hsl(var(--brass) / 0.18), hsl(var(--brass) / 0.04))',
                    boxShadow: 'inset 0 1px 0 0 hsl(var(--sheen) / 0.10)',
                  }}
                >
                  <stat.icon className="h-5 w-5 text-brass-ring" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <span className="kicker">Workspaces</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">مساحات العمل</h2>
            <p className="mt-1 max-w-xl text-sm text-fg-3">
              كل مساحاتك في مكان واحد — منظّمة، آمنة، ومتزامنة لحظياً مع فريقك.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface-3/60 border border-line-strong rounded-xl py-2 pr-10 pl-10 text-sm text-fg-1 placeholder:text-fg-4 focus:outline-none focus:border-brass-ring w-56"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={loadWorkspaces}
              className="btn-secondary text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث
            </button>

            <div className="flex rounded-xl border border-line/70 bg-surface-1/70 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-surface-3 text-brass-ring shadow-depth-1' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-surface-3 text-brass-ring shadow-depth-1' : 'text-fg-3 hover:text-fg-1'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" />
              مساحة جديدة
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick-soft">
            {error}
          </div>
        )}

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => !creating && setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="surface-floating w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <span className="kicker">New workspace</span>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">إنشاء مساحة عمل</h3>
                    <p className="mt-1 text-xs text-fg-3">مساحة جديدة لفريق أو مشروع. يمكنك دعوة الأعضاء لاحقاً.</p>
                  </div>
                  <button
                    onClick={() => !creating && setShowCreate(false)}
                    className="btn-ghost h-8 w-8 rounded-lg border border-line/60 !p-0 text-fg-3"
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-fg-4">اسم المساحة</label>
                    <input
                      type="text"
                      placeholder="مثال: مشروع التصميم"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      disabled={creating}
                      className="field disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-fg-4">الوصف (اختياري)</label>
                    <textarea
                      placeholder="وصف مختصر لمساحة العمل..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={3}
                      disabled={creating}
                      className="field resize-none disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={creating}
                      className="btn-primary flex-1 py-2.5"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جاري الإنشاء...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          إنشاء
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      disabled={creating}
                      className="btn-secondary flex-1 py-2.5"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="surface-floating w-full max-w-sm border-brick/40 p-6"
              >
                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-brick/40 bg-brick/15 text-brick-soft">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-fg-1">حذف مساحة العمل</h3>
                  <p className="text-sm text-fg-3 mt-1">سيتم حذف جميع الملفات والبيانات نهائياً</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={deleting}
                    className="btn-danger flex-1 py-2.5"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري الحذف...
                      </>
                    ) : (
                      'حذف'
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="btn-secondary flex-1 py-2.5"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="surface-elevated mb-8 p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brass" />
              <h3 className="text-sm font-semibold tracking-tight text-fg-1">آخر النشاطات</h3>
            </div>
            <span className="text-[11px] uppercase tracking-[0.18em] text-fg-4">Audit feed</span>
          </div>

          {recentActivity.length === 0 ? (
            <p className="text-sm text-fg-4">لا توجد نشاطات حديثة بعد.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="surface rounded-xl p-4 transition-colors duration-200 hover:border-line-strong">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-fg-1">{activity.action}</p>
                    <span className="text-[11px] text-fg-4 shrink-0">{new Date(activity.created_at).toLocaleString('ar')}</span>
                  </div>
                  {activity.details && <p className="text-xs text-fg-3 mt-2 leading-6">{activity.details}</p>}
                  <div className="flex items-center gap-2 mt-3 text-[11px] text-fg-4">
                    <span>{activity.user_name}</span>
                    {activity.workspace_name && (
                      <>
                        <span>•</span>
                        <span>{activity.workspace_name}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-surface-2/80 rounded-2xl p-5 animate-pulse">
                <div className="w-10 h-10 bg-surface-3 rounded-xl mb-3" />
                <div className="h-5 bg-surface-3 rounded w-3/4 mb-2" />
                <div className="h-4 bg-surface-3 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-20">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="w-20 h-20 bg-surface-2/70 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-10 h-10 text-fg-4/70" />
              </div>
              {searchQuery ? (
                <>
                  <p className="text-fg-3 text-lg">لا توجد نتائج لـ "{searchQuery}"</p>
                  <p className="text-fg-4 text-sm mt-1">جرب كلمة بحث مختلفة</p>
                </>
              ) : (
                <>
                  <p className="text-fg-3 text-lg">لا توجد مساحات عمل بعد</p>
                  <p className="text-fg-4 text-sm mt-1">أنشئ مساحة عمل جديدة للبدء</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary mt-6 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    إنشاء مساحة عمل
                  </button>
                </>
              )}
            </motion.div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkspaces.map((workspace, index) => (
              <motion.div
                key={workspace.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/workspace/${workspace.id}`)}
                className="card-3d group relative cursor-pointer p-5"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(workspace.id);
                  }}
                  className="absolute top-3 left-3 p-1.5 bg-brick/10 hover:bg-brick/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4 text-brick-soft" />
                </button>

                <div className="w-10 h-10 bg-brass/15 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brass/25 transition-colors">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-fg-1 mb-1">{workspace.name}</h3>
                {workspace.description && (
                  <p className="text-sm text-fg-3 line-clamp-2 mb-3">{workspace.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-fg-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    مساحة مشتركة
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    {fileService.formatSize(storageMap[workspace.id] || 0)}
                  </span>
                  <span className="flex-1" />
                  <span className="text-fg-4/70">{new Date(workspace.created_at).toLocaleDateString('ar')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredWorkspaces.map((workspace, index) => (
              <motion.div
                key={workspace.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="surface flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4 transition-all duration-200 ease-smooth hover:-translate-y-px hover:border-line-strong hover:bg-surface-2 group"
                onClick={() => navigate(`/workspace/${workspace.id}`)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-brass/15 rounded-xl flex items-center justify-center shrink-0">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-fg-1 truncate">{workspace.name}</h3>
                    {workspace.description && <p className="text-xs text-fg-3 line-clamp-1">{workspace.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-fg-4 shrink-0">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    {fileService.formatSize(storageMap[workspace.id] || 0)}
                  </span>
                  <span>{new Date(workspace.created_at).toLocaleDateString('ar')}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(workspace.id);
                    }}
                    className="p-1.5 hover:bg-brick/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-brick-soft" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
