import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  ArrowRight,
  Users,
  FileText,
  Activity,
  Settings,
  Trash2,
  Download,
  Eye,
  Copy,
  RefreshCw,
  FolderOpen,
  X,
  Link2,
  HardDrive,
  Loader2,
  Search,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  History,
  MessageSquareText,
  SendHorizontal,
  UploadCloud,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabaseWorkspaceService } from '@/services/api-services';
import { fileService, realtimeService } from '@/services/supabase-services';
import {
  Workspace,
  WorkspaceFile,
  WorkspaceMember,
  AuditLog,
  PaginationMeta,
  StorageInfo,
  FileComment,
  FileVersion,
  Role,
} from '@/types';
import { PageLoader } from '@/components/common/PageLoader';
import { NotificationBell } from '@/components/common/NotificationBell';

type Tab = 'files' | 'members' | 'activity' | 'settings';
type FileViewMode = 'list' | 'grid';

const FILES_LIMIT = 12;
const ACTIVITY_LIMIT = 10;
const FILE_COMMENTS_LIMIT = 20;

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: 1,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};


function isOwnerWorkspaceRole(workspace: Workspace | null, userId?: string) {
  return Boolean(workspace && userId && workspace.owner_id === userId);
}

function roleLabel(role: Role) {
  if (role === 'owner') return 'مالك';
  if (role === 'admin') return 'مشرف';
  if (role === 'viewer') return 'مشاهد';
  if (role === 'guest') return 'ضيف';
  return 'عضو';
}

function roleBadgeClass(role: Role) {
  if (role === 'owner') return 'bg-brass/15 text-brass-ring';
  if (role === 'admin') return 'bg-brass/15 text-brass-ring';
  if (role === 'viewer') return 'bg-steel-soft text-steel';
  if (role === 'guest') return 'bg-surface-3 text-fg-2';
  return 'bg-sage/15 text-sage';
}

function stopPropagation<T extends (...args: never[]) => void>(handler: T) {
  return (event: MouseEvent) => {
    event.stopPropagation();
    handler();
  };
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tab, setTab] = useState<Tab>('files');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkspaceFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ used: 0, max: 0, percentage: 0 });
  const [filesPagination, setFilesPagination] = useState<PaginationMeta>(emptyPagination);
  const [activityPagination, setActivityPagination] = useState<PaginationMeta>(emptyPagination);
  const [filesPage, setFilesPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [error, setError] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [versionUploading, setVersionUploading] = useState(false);
  const [versionUploadProgress, setVersionUploadProgress] = useState(0);
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [fileComments, setFileComments] = useState<FileComment[]>([]);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsStorageMb, setSettingsStorageMb] = useState('500');
  const [savingSettings, setSavingSettings] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | Role>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'image' | 'document' | 'media' | 'text' | 'other'>('all');
  const [fileSortBy, setFileSortBy] = useState<'newest' | 'oldest' | 'name' | 'size_desc' | 'size_asc'>('newest');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState('all');
  const [inviteCopied, setInviteCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  const loadOverview = useCallback(async () => {
    if (!id) return;

    setOverviewLoading(true);
    setError('');

    try {
      const [workspaceData, membersData, storageData] = await Promise.all([
        supabaseWorkspaceService.getById(id),
        supabaseWorkspaceService.getMembers(id),
        supabaseWorkspaceService.getStorage(id),
      ]);

      setWorkspace(workspaceData);
      setMembers(membersData);
      setStorageInfo(storageData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل بيانات المساحة';
      setError(message);
      navigate('/dashboard');
    } finally {
      setOverviewLoading(false);
    }
  }, [id, navigate]);

  const loadFiles = useCallback(async () => {
    if (!id) return;

    setFilesLoading(true);

    try {
      const result = await supabaseWorkspaceService.getFiles(id, {
        page: filesPage,
        limit: FILES_LIMIT,
        search: searchQuery.trim() || undefined,
      });

      setFiles(result.data);
      setFilesPagination(result.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الملفات');
    } finally {
      setFilesLoading(false);
    }
  }, [id, filesPage, searchQuery]);

  const loadActivity = useCallback(async () => {
    if (!id) return;

    setActivityLoading(true);

    try {
      const result = await supabaseWorkspaceService.getActivity(id, {
        page: activityPage,
        limit: ACTIVITY_LIMIT,
      });

      setLogs(result.data);
      setActivityPagination(result.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل سجل النشاط');
    } finally {
      setActivityLoading(false);
    }
  }, [id, activityPage]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadFiles(), loadActivity()]);
  }, [loadOverview, loadFiles, loadActivity]);

  const loadFileDetails = useCallback(
    async (selectedFile: WorkspaceFile) => {
      if (!id) return;

      setDetailLoading(true);
      setError('');
      setPreviewFile(selectedFile);
      setCommentInput('');

      try {
        const [versions, comments, signedUrl] = await Promise.all([
          supabaseWorkspaceService.getFileVersions(id, selectedFile.id),
          supabaseWorkspaceService.getFileComments(id, selectedFile.id, {
            page: 1,
            limit: FILE_COMMENTS_LIMIT,
          }),
          fileService.canPreview(selectedFile.mime_type)
            ? fileService.getDownloadUrl(selectedFile.storage_path)
            : Promise.resolve(''),
        ]);

        setFileVersions(versions);
        setFileComments(comments.data);
        setPreviewUrl(signedUrl || null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الملف');
      } finally {
        setDetailLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (user) {
      loadOverview();
    }
  }, [loadOverview, user]);

  useEffect(() => {
    if (!workspace) return;
    setSettingsName(workspace.name || '');
    setSettingsDescription(workspace.description || '');
    setSettingsStorageMb(String(workspace.max_storage_mb || 500));
  }, [workspace]);


  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [loadFiles, user]);

  useEffect(() => {
    if (user) {
      loadActivity();
    }
  }, [loadActivity, user]);

  useEffect(() => {
    setFilesPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (!id) return;
    realtimeService.subscribeToWorkspace(id, refreshAll, refreshAll);
    return () => realtimeService.unsubscribe();
  }, [id, refreshAll]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || !id || !user) return;

    setUploading(true);
    setError('');

    const progressMap: Record<string, number> = {};
    let usedBytes = storageInfo.used;
    const maxBytes = storageInfo.max;

    for (let index = 0; index < fileList.length; index += 1) {
      progressMap[fileList[index].name] = 0;
    }
    setUploadProgress(progressMap);

    for (let index = 0; index < fileList.length; index += 1) {
      const file = fileList[index];

      try {
        if (maxBytes > 0 && usedBytes + file.size > maxBytes) {
          throw new Error(`المساحة المتبقية لا تكفي لرفع الملف: ${file.name}`);
        }

        progressMap[file.name] = 5;
        setUploadProgress({ ...progressMap });

        const uploadedFile = await supabaseWorkspaceService.uploadFile(id, file, (progress) => {
          progressMap[file.name] = progress;
          setUploadProgress({ ...progressMap });
        });

        usedBytes += uploadedFile.size;
        progressMap[file.name] = 100;
        setUploadProgress({ ...progressMap });
      } catch (err: unknown) {
        progressMap[file.name] = -1;
        setUploadProgress({ ...progressMap });
        setError(err instanceof Error ? err.message : `تعذر رفع الملف: ${file.name}`);
      }
    }

    setUploading(false);
    window.setTimeout(() => setUploadProgress({}), 3000);
    await refreshAll();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleUpload(event.dataTransfer.files);
  };

  const handleDeleteFile = async (file: WorkspaceFile) => {
    if (!id) return;

    setDeleting(true);

    try {
      await supabaseWorkspaceService.deleteFile(id, file.id);
      setDeleteConfirm(null);
      setPreviewFile((current) => (current?.id === file.id ? null : current));
      setPreviewUrl((current) => (previewFile?.id === file.id ? null : current));
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الملف');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (file: { storage_path: string }) => {
    const url = await fileService.getDownloadUrl(file.storage_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleOpenFileDetails = async (file: WorkspaceFile) => {
    await loadFileDetails(file);
  };

  const handleAddComment = async () => {
    if (!id || !previewFile || !commentInput.trim()) return;

    setCommentSubmitting(true);
    setError('');

    try {
      const comment = await supabaseWorkspaceService.addFileComment(
        id,
        previewFile.id,
        commentInput.trim()
      );
      setFileComments((current) => [comment, ...current]);
      setCommentInput('');
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة التعليق');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleVersionFileSelected = async (fileList: FileList | null) => {
    if (!id || !previewFile || !fileList?.length) return;

    const file = fileList[0];
    setVersionUploading(true);
    setVersionUploadProgress(0);
    setError('');

    try {
      const updatedFile = await supabaseWorkspaceService.uploadFileVersion(
        id,
        previewFile.id,
        file,
        setVersionUploadProgress
      );

      setPreviewFile(updatedFile);
      await Promise.all([refreshAll(), loadFileDetails(updatedFile)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر رفع النسخة الجديدة');
    } finally {
      setVersionUploading(false);
      setVersionUploadProgress(0);
      if (versionInputRef.current) {
        versionInputRef.current.value = '';
      }
    }
  };

  const copyInviteLink = () => {
    if (!workspace) return;
    const link = `${window.location.origin}/join/${workspace.invite_token}`;
    navigator.clipboard.writeText(link);
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 1800);
  };

  const handleRegenerate = async () => {
    if (!id) return;

    try {
      const result = await supabaseWorkspaceService.regenerateInvite(id);
      setWorkspace((current) => (current ? { ...current, invite_token: result.invite_token } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إعادة توليد رابط الدعوة');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!id || !window.confirm('هل أنت متأكد من حذف هذه المساحة؟')) return;

    try {
      await supabaseWorkspaceService.deleteWorkspace(id);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف مساحة العمل');
    }
  };

  const currentUserRole = isOwnerWorkspaceRole(workspace, user?.id)
    ? 'owner'
    : members.find((member) => member.user_id === user?.id)?.role;

  const canManageMember = (member: WorkspaceMember) => {
    if (!user || !currentUserRole) return false;
    if (member.role === 'owner') return false;
    if (member.user_id === user.id) return false;
    if (currentUserRole === 'owner') return true;
    if (currentUserRole === 'admin') {
      return member.role !== 'admin';
    }
    return false;
  };

  const getAvailableRoles = (member: WorkspaceMember): Role[] => {
    if (!currentUserRole || !canManageMember(member)) return [] as Role[];
    if (currentUserRole === 'owner') return ['admin', 'member', 'viewer'];
    if (currentUserRole === 'admin') return ['member', 'viewer'];
    return [] as Role[];
  };

  const handleRoleChange = async (member: WorkspaceMember, role: Role) => {
    if (!id || member.role === role) return;

    try {
      setError('');
      await supabaseWorkspaceService.updateMemberRole(id, member.id, role);
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, role } : item))
      );
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث دور العضو');
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!id) return;
    if (!window.confirm(`هل تريد إزالة ${member.display_name || member.guest_name || 'هذا العضو'} من المساحة؟`)) {
      return;
    }

    try {
      setError('');
      await supabaseWorkspaceService.removeMember(id, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إزالة العضو');
    }
  };

  const handleSaveSettings = async () => {
    if (!id) return;

    const parsedStorage = Number(settingsStorageMb);
    if (!settingsName.trim()) {
      setError('اسم المساحة مطلوب');
      return;
    }
    if (!Number.isFinite(parsedStorage) || parsedStorage < 1) {
      setError('حد التخزين يجب أن يكون أكبر من صفر');
      return;
    }

    setSavingSettings(true);
    setError('');

    try {
      const updatedWorkspace = await supabaseWorkspaceService.updateWorkspace(id, {
        name: settingsName.trim(),
        description: settingsDescription.trim(),
        max_storage_mb: isOwner ? parsedStorage : workspace?.max_storage_mb || parsedStorage,
      });
      setWorkspace(updatedWorkspace);
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ إعدادات المساحة');
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading || overviewLoading) {
    return <PageLoader label="جاري تحميل مساحة العمل..." />;
  }

  if (!workspace) return null;

  const isOwner = Boolean(user && workspace.owner_id === user.id);
  const storagePercentage = storageInfo.percentage;
  const storageColor =
    storagePercentage > 90 ? 'text-brick-soft' : storagePercentage > 70 ? 'text-brass-ring' : 'text-sage';
  const storageBgColor =
    storagePercentage > 90 ? 'bg-brick' : storagePercentage > 70 ? 'bg-brass' : 'bg-sage';

  const tabs: { key: Tab; icon: typeof FileText; label: string }[] = [
    { key: 'files', icon: FileText, label: 'الملفات' },
    { key: 'members', icon: Users, label: 'الأعضاء' },
    { key: 'activity', icon: Activity, label: 'السجل' },
    { key: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  const filteredMembers = members.filter((member) => {
    const matchesRole = memberRoleFilter === 'all' ? true : member.role === memberRoleFilter;
    const searchTarget = `${member.display_name || ''} ${member.email || ''} ${member.role}`.toLowerCase();
    const matchesSearch = searchTarget.includes(memberSearchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const visibleFiles = [...files]
    .filter((file) => {
      if (fileTypeFilter === 'all') return true;
      if (fileTypeFilter === 'image') return file.mime_type.startsWith('image/');
      if (fileTypeFilter === 'media') return file.mime_type.startsWith('video/') || file.mime_type.startsWith('audio/');
      if (fileTypeFilter === 'text') return file.mime_type.startsWith('text/') || file.mime_type === 'application/json';
      if (fileTypeFilter === 'document') {
        return file.mime_type === 'application/pdf' || file.mime_type.includes('document') || file.mime_type.includes('sheet') || file.mime_type.includes('presentation');
      }
      return !(file.mime_type.startsWith('image/') || file.mime_type.startsWith('video/') || file.mime_type.startsWith('audio/') || file.mime_type.startsWith('text/') || file.mime_type === 'application/json' || file.mime_type === 'application/pdf');
    })
    .sort((a, b) => {
      if (fileSortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (fileSortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      if (fileSortBy === 'size_desc') return b.size - a.size;
      if (fileSortBy === 'size_asc') return a.size - b.size;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const activityActions = Array.from(new Set(logs.map((log) => log.action))).sort((a, b) => a.localeCompare(b, 'ar'));
  const filteredActivityLogs = logs.filter((log) => {
    const matchesAction = activityActionFilter === 'all' ? true : log.action === activityActionFilter;
    const searchTarget = `${log.action} ${log.details || ''} ${log.user_name}`.toLowerCase();
    const matchesSearch = searchTarget.includes(activitySearchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-ink text-fg-1" dir="rtl">
      <header className="glass-header">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/dashboard')} className="text-fg-3 hover:text-fg-1 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 bg-brass/15 rounded-lg flex items-center justify-center shrink-0">
              <FolderOpen className="w-4 h-4 text-brass" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold truncate">{workspace.name}</h1>
              {workspace.description && <p className="text-xs text-fg-3 truncate">{workspace.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-surface-2/70 rounded-xl px-3 py-1.5">
              <HardDrive className="w-4 h-4 text-fg-3" />
              <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${storageBgColor}`} style={{ width: `${Math.min(storagePercentage, 100)}%` }} />
              </div>
              <span className={`text-xs font-medium ${storageColor}`}>{storagePercentage.toFixed(0)}%</span>
            </div>

            <NotificationBell compact />

            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 bg-brass hover:bg-brass-hover px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Link2 className="w-4 h-4" />
              دعوة
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 pt-4">
        <div className="flex gap-1 bg-surface-2/70 rounded-xl p-1 w-fit flex-wrap">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === tabItem.key ? 'bg-brass text-fg-1' : 'text-fg-3 hover:text-fg-1'
              }`}
            >
              <tabItem.icon className="w-4 h-4" />
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      <main className="container mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick-soft">
            {error}
          </div>
        )}

        {tab === 'files' && (
          <div>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all mb-6 ${
                dragOver ? 'border-brass bg-brass/15' : 'border-line-strong hover:border-line-strong'
              }`}
            >
              <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-brass' : 'text-fg-4'}`} />
              <p className="text-fg-2 font-medium">{uploading ? 'جاري الرفع...' : 'اسحب الملفات هنا أو انقر للاختيار'}</p>
              <p className="text-xs text-fg-4 mt-1">الرفع يعمل الآن مباشرة عبر Supabase مع دعم النسخ والتعليقات والإشعارات</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => handleUpload(event.target.files)} />
            </div>

            <AnimatePresence>
              {Object.keys(uploadProgress).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 space-y-2"
                >
                  {Object.entries(uploadProgress).map(([name, progress]) => (
                    <div key={name} className="bg-surface-2/80 border border-line/70 rounded-xl p-3 flex items-center gap-3">
                      {progress === 100 ? (
                        <CheckCircle2 className="w-5 h-5 text-sage shrink-0" />
                      ) : progress === -1 ? (
                        <AlertTriangle className="w-5 h-5 text-brick-soft shrink-0" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-brass animate-spin shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {progress >= 0 && progress < 100 && (
                          <div className="w-full h-1 bg-surface-3 rounded-full mt-1">
                            <div className="h-full bg-brass rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                      <span className={`text-xs ${progress === 100 ? 'text-sage' : progress === -1 ? 'text-brick-soft' : 'text-fg-3'}`}>
                        {progress === 100 ? 'تم' : progress === -1 ? 'خطأ' : `${progress}%`}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3" />
                <input
                  type="text"
                  placeholder="بحث في الملفات..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-surface-3/60 border border-line-strong rounded-xl py-2 pr-10 pl-4 text-sm text-fg-1 placeholder:text-fg-4 focus:outline-none focus:border-brass-ring/70"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-3 py-2 text-xs text-fg-2">
                  <Filter className="w-3.5 h-3.5" />
                  <select value={fileTypeFilter} onChange={(event) => setFileTypeFilter(event.target.value as typeof fileTypeFilter)} className="bg-transparent outline-none text-xs">
                    <option value="all" className="bg-surface-1">كل الأنواع</option>
                    <option value="image" className="bg-surface-1">صور</option>
                    <option value="document" className="bg-surface-1">مستندات</option>
                    <option value="media" className="bg-surface-1">وسائط</option>
                    <option value="text" className="bg-surface-1">نصوص</option>
                    <option value="other" className="bg-surface-1">أخرى</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-3 py-2 text-xs text-fg-2">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <select value={fileSortBy} onChange={(event) => setFileSortBy(event.target.value as typeof fileSortBy)} className="bg-transparent outline-none text-xs">
                    <option value="newest" className="bg-surface-1">الأحدث</option>
                    <option value="oldest" className="bg-surface-1">الأقدم</option>
                    <option value="name" className="bg-surface-1">الاسم</option>
                    <option value="size_desc" className="bg-surface-1">الحجم الأكبر</option>
                    <option value="size_asc" className="bg-surface-1">الحجم الأصغر</option>
                  </select>
                </div>
                <div className="flex bg-surface-3/60 rounded-xl p-1">
                  <button
                    onClick={() => setFileViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${fileViewMode === 'list' ? 'bg-brass text-fg-1' : 'text-fg-3 hover:text-fg-1'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setFileViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${fileViewMode === 'grid' ? 'bg-brass text-fg-1' : 'text-fg-3 hover:text-fg-1'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-fg-3">عرض {visibleFiles.length} من أصل {filesPagination.total} ملف</div>
              </div>
            </div>

            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="bg-surface-2/80 border border-line/70 rounded-xl p-4 animate-pulse">
                    <div className="w-12 h-12 bg-surface-3 rounded-xl mx-auto mb-2" />
                    <div className="h-4 bg-surface-3 rounded mb-2" />
                    <div className="h-3 bg-surface-3 rounded w-2/3 mx-auto" />
                  </div>
                ))}
              </div>
            ) : visibleFiles.length === 0 ? (
              <div className="text-center py-12 text-fg-4">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{searchQuery ? 'لا توجد نتائج' : 'لا توجد ملفات بعد'}</p>
                {!searchQuery && <p className="text-xs mt-1">ابدأ برفع أول ملف داخل مساحة العمل</p>}
              </div>
            ) : fileViewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {visibleFiles.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleOpenFileDetails(file)}
                    className="bg-surface-2/80 border border-line/70 rounded-xl p-4 text-center group hover:border-brass/40 transition-all relative cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="rounded-full bg-surface-2/60 px-2 py-1 text-[10px] text-fg-2 flex items-center gap-1">
                        <History className="w-3 h-3" />
                        نسخ
                      </span>
                    </div>

                    <div className="w-12 h-12 bg-brass/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <FileText className="w-6 h-6 text-brass" />
                    </div>
                    <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-fg-4 mt-0.5">{fileService.formatSize(file.size)}</p>

                    <div className="flex items-center justify-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {fileService.canPreview(file.mime_type) && (
                        <button onClick={stopPropagation(() => handleOpenFileDetails(file))} className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors" title="معاينة">
                          <Eye className="w-3.5 h-3.5 text-fg-2" />
                        </button>
                      )}
                      <button onClick={stopPropagation(() => handleDownload(file))} className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors" title="تحميل">
                        <Download className="w-3.5 h-3.5 text-fg-2" />
                      </button>
                      <button onClick={stopPropagation(() => handleOpenFileDetails(file))} className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors" title="التعليقات والنسخ">
                        <MessageSquareText className="w-3.5 h-3.5 text-fg-2" />
                      </button>
                      {isOwner && (
                        <button onClick={stopPropagation(() => setDeleteConfirm(file))} className="p-1.5 hover:bg-brick/20 rounded-lg transition-colors" title="حذف">
                          <Trash2 className="w-3.5 h-3.5 text-brick-soft" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {visibleFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleOpenFileDetails(file)}
                    className="bg-surface-2/80 border border-line/70 rounded-xl p-4 flex items-center justify-between group hover:border-brass/40 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-brass/15 rounded-xl flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-brass" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-fg-4">{fileService.formatSize(file.size)} • {file.uploaded_by_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {fileService.canPreview(file.mime_type) && (
                        <button onClick={stopPropagation(() => handleOpenFileDetails(file))} className="p-2 hover:bg-surface-3 rounded-lg transition-colors">
                          <Eye className="w-4 h-4 text-fg-2" />
                        </button>
                      )}
                      <button onClick={stopPropagation(() => handleDownload(file))} className="p-2 hover:bg-surface-3 rounded-lg transition-colors">
                        <Download className="w-4 h-4 text-fg-2" />
                      </button>
                      <button onClick={stopPropagation(() => handleOpenFileDetails(file))} className="p-2 hover:bg-surface-3 rounded-lg transition-colors">
                        <History className="w-4 h-4 text-fg-2" />
                      </button>
                      {isOwner && (
                        <button onClick={stopPropagation(() => setDeleteConfirm(file))} className="p-2 hover:bg-brick/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4 text-brick-soft" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-6 flex-wrap">
              <div className="text-xs text-fg-3">الصفحة {filesPagination.page} من {filesPagination.totalPages}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilesPage((page) => Math.max(1, page - 1))}
                  disabled={!filesPagination.hasPrev}
                  className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-4 py-2 text-sm disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </button>
                <button
                  onClick={() => setFilesPage((page) => page + 1)}
                  disabled={!filesPagination.hasNext}
                  className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-4 py-2 text-sm disabled:opacity-40"
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-line/70 bg-surface-2/60 p-4 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3" />
                  <input
                    value={memberSearchQuery}
                    onChange={(event) => setMemberSearchQuery(event.target.value)}
                    placeholder="بحث عن عضو..."
                    className="w-64 rounded-xl border border-line-strong bg-surface-1/80 py-2 pr-10 pl-4 text-sm text-fg-1 placeholder:text-fg-4/80 focus:outline-none focus:border-brass-ring/70"
                  />
                </div>
                <select
                  value={memberRoleFilter}
                  onChange={(event) => setMemberRoleFilter(event.target.value as 'all' | Role)}
                  className="rounded-xl border border-line-strong bg-surface-1/80 px-3 py-2 text-sm text-fg-1 focus:outline-none focus:border-brass-ring/70"
                >
                  <option value="all">كل الأدوار</option>
                  <option value="owner">مالك</option>
                  <option value="admin">مشرف</option>
                  <option value="member">عضو</option>
                  <option value="viewer">مشاهد</option>
                  <option value="guest">ضيف</option>
                </select>
              </div>
              <p className="text-xs text-fg-3">عرض {filteredMembers.length} من أصل {members.length} عضو</p>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-12 text-fg-4">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد أعضاء بعد</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-fg-4">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد نتائج مطابقة للفلترة الحالية</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const availableRoles = getAvailableRoles(member);
                const manageable = canManageMember(member);

                return (
                  <div key={member.id} className="bg-surface-2/80 border border-line/70 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-brass/15 rounded-full flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-brass" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-fg-1 truncate">{member.display_name || member.guest_name || member.user_id?.slice(0, 8) || 'عضو'}</p>
                          {member.is_current_user && (
                            <span className="rounded-full bg-surface-2/60 px-2 py-0.5 text-[10px] text-fg-2">أنت</span>
                          )}
                        </div>
                        <p className="text-xs text-fg-4 truncate">
                          {member.email || new Date(member.joined_at).toLocaleDateString('ar')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${roleBadgeClass(member.role)}`}>
                        {roleLabel(member.role)}
                      </span>

                      {manageable && availableRoles.length > 0 && (
                        <select
                          value={member.role}
                          onChange={(event) => handleRoleChange(member, event.target.value as Role)}
                          className="rounded-xl border border-line-strong bg-surface-1 px-3 py-2 text-xs text-fg-1 focus:outline-none focus:border-brass-ring/70"
                        >
                          {availableRoles.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                      )}

                      {manageable && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="inline-flex items-center gap-2 rounded-xl border border-brick/40 bg-brick/10 px-3 py-2 text-xs text-brick-soft hover:bg-brick/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          إزالة
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-line/70 bg-surface-2/60 p-4 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3" />
                  <input
                    value={activitySearchQuery}
                    onChange={(event) => setActivitySearchQuery(event.target.value)}
                    placeholder="ابحث في السجل..."
                    className="w-64 rounded-xl border border-line-strong bg-surface-1/80 py-2 pr-10 pl-4 text-sm text-fg-1 placeholder:text-fg-4/80 focus:outline-none focus:border-brass-ring/70"
                  />
                </div>
                <select
                  value={activityActionFilter}
                  onChange={(event) => setActivityActionFilter(event.target.value)}
                  className="rounded-xl border border-line-strong bg-surface-1/80 px-3 py-2 text-sm text-fg-1 focus:outline-none focus:border-brass-ring/70"
                >
                  <option value="all">كل الأنشطة</option>
                  {activityActions.map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-fg-3">عرض {filteredActivityLogs.length} من أصل {logs.length} نشاط</p>
            </div>
            {activityLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-surface-2/80 border border-line/70 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-surface-3 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-surface-3 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-surface-3 rounded w-1/4" />
                </div>
              ))
            ) : filteredActivityLogs.length === 0 ? (
              <div className="text-center py-12 text-fg-4">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد نشاط بعد</p>
              </div>
            ) : (
              <>
                {filteredActivityLogs.map((log) => (
                  <div key={log.id} className="bg-surface-2/80 border border-line/70 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{log.action}</p>
                        {log.details && <p className="text-xs text-fg-3 mt-0.5">{log.details}</p>}
                        <p className="text-xs text-fg-4/70 mt-0.5">{log.user_name}</p>
                      </div>
                      <span className="text-xs text-fg-4 shrink-0">{new Date(log.created_at).toLocaleDateString('ar')}</span>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                  <div className="text-xs text-fg-3">الصفحة {activityPagination.page} من {activityPagination.totalPages}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                      disabled={!activityPagination.hasPrev}
                      className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-4 py-2 text-sm disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                      السابق
                    </button>
                    <button
                      onClick={() => setActivityPage((page) => page + 1)}
                      disabled={!activityPagination.hasNext}
                      className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-4 py-2 text-sm disabled:opacity-40"
                    >
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-surface-2/80 border border-line/70 rounded-xl p-5">
              <h3 className="font-semibold mb-4">إعدادات المساحة</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm text-fg-2 mb-2">اسم المساحة</label>
                  <input
                    value={settingsName}
                    onChange={(event) => setSettingsName(event.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-surface-1/80 px-4 py-3 text-sm text-fg-1 focus:border-brass-ring/70 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-fg-2 mb-2">الوصف</label>
                  <textarea
                    value={settingsDescription}
                    onChange={(event) => setSettingsDescription(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-line-strong bg-surface-1/80 px-4 py-3 text-sm text-fg-1 focus:border-brass-ring/70 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-fg-2 mb-2">حد التخزين (MB)</label>
                  <input
                    type="number"
                    min={1}
                    value={settingsStorageMb}
                    onChange={(event) => setSettingsStorageMb(event.target.value)}
                    disabled={!isOwner}
                    className="w-full rounded-xl border border-line-strong bg-surface-1/80 px-4 py-3 text-sm text-fg-1 focus:border-brass-ring/70 focus:outline-none disabled:opacity-60"
                  />
                  <p className="text-xs text-fg-4 mt-2">تعديل حد التخزين متاح للمالك فقط.</p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-brass px-4 py-2.5 text-sm font-medium hover:bg-brass-hover transition-colors disabled:opacity-60"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      حفظ الإعدادات
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-surface-2/80 border border-line/70 rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                التخزين
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-fg-3">المستخدم</span>
                  <span className="text-fg-1">{fileService.formatSize(storageInfo.used)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-fg-3">الحد الأقصى</span>
                  <span className="text-fg-1">{fileService.formatSize(storageInfo.max)}</span>
                </div>
                <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full transition-all ${storageBgColor}`} style={{ width: `${Math.min(storagePercentage, 100)}%` }} />
                </div>
                <p className={`text-xs ${storageColor}`}>{storagePercentage.toFixed(1)}% مستخدم</p>
              </div>
            </div>

            <div className="bg-surface-2/80 border border-line/70 rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                رابط الدعوة
              </h3>
              <div className="flex gap-2">
                <input readOnly value={`${window.location.origin}/join/${workspace.invite_token}`} className="flex-1 bg-surface-3/60 border border-line-strong rounded-lg py-2 px-3 text-sm text-fg-2" />
                <button onClick={copyInviteLink} className="p-2 bg-brass hover:bg-brass-hover rounded-lg transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
                {isOwner && (
                  <button onClick={handleRegenerate} className="p-2 bg-surface-3 hover:bg-surface-4 rounded-lg transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
              {inviteCopied && <p className="text-xs text-sage mt-3">تم نسخ رابط الدعوة بنجاح</p>}
            </div>

            {isOwner && (
              <div className="bg-red-500/5 border border-brick/30 rounded-xl p-5">
                <h3 className="font-semibold text-brick-soft mb-2">منطقة الخطر</h3>
                <p className="text-sm text-fg-3 mb-3">حذف المساحة سيؤدي لحذف جميع الملفات والبيانات نهائياً.</p>
                <button onClick={handleDeleteWorkspace} className="bg-brick hover:bg-brick/90 text-fg-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  حذف المساحة
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowInvite(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-2 border border-line-strong rounded-2xl p-6 w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">دعوة أعضاء</h3>
                <button onClick={() => setShowInvite(false)} className="text-fg-3 hover:text-fg-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-fg-3 mb-4">شارك هذا الرابط مع من تريد دعوتهم:</p>
              <div className="flex gap-2">
                <input readOnly value={`${window.location.origin}/join/${workspace.invite_token}`} className="flex-1 bg-surface-3/60 border border-line-strong rounded-lg py-2.5 px-3 text-sm text-fg-2" />
                <button
                  onClick={() => {
                    copyInviteLink();
                    setShowInvite(false);
                  }}
                  className="bg-brass hover:bg-brass-hover px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  نسخ
                </button>
              </div>
              {inviteCopied && <p className="text-xs text-sage mt-3">تم نسخ رابط الدعوة بنجاح</p>}
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
              className="bg-surface-2 border border-brick/40 rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-brick/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-6 h-6 text-brick-soft" />
                </div>
                <h3 className="text-lg font-bold text-fg-1">حذف الملف</h3>
                <p className="text-sm text-fg-3 mt-1">هل أنت متأكد من حذف "{deleteConfirm.name}"؟</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteFile(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 bg-brick hover:bg-brick/90 disabled:opacity-50 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
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
                <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="flex-1 bg-surface-3 hover:bg-surface-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setPreviewFile(null);
              setPreviewUrl(null);
              setFileComments([]);
              setFileVersions([]);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl border border-line/70 bg-surface-1/95 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{previewFile.name}</h3>
                  <p className="text-xs text-fg-4 mt-1">{fileService.formatSize(previewFile.size)} • {previewFile.uploaded_by_name}</p>
                </div>
                <button
                  onClick={() => {
                    setPreviewFile(null);
                    setPreviewUrl(null);
                    setFileComments([]);
                    setFileVersions([]);
                  }}
                  className="text-fg-3 hover:text-fg-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="p-10">
                  <PageLoader label="جاري تحميل تفاصيل الملف..." />
                </div>
              ) : (
                <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,420px)] max-h-[calc(90vh-73px)] overflow-hidden">
                  <div className="overflow-auto border-b lg:border-b-0 lg:border-l border-line p-6">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <button onClick={() => handleDownload(previewFile)} className="inline-flex items-center gap-2 rounded-xl bg-brass px-4 py-2 text-sm font-medium hover:bg-brass-hover transition-colors">
                        <Download className="w-4 h-4" />
                        تحميل الملف
                      </button>
                      <button onClick={() => versionInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/90 px-4 py-2 text-sm font-medium hover:bg-surface-2 transition-colors">
                        <UploadCloud className="w-4 h-4" />
                        رفع نسخة جديدة
                      </button>
                      <input ref={versionInputRef} type="file" className="hidden" onChange={(event) => handleVersionFileSelected(event.target.files)} />
                    </div>

                    {versionUploading && (
                      <div className="mb-4 rounded-2xl border border-brass-ring/20 bg-brass/10 p-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span>جاري رفع النسخة الجديدة...</span>
                          <span>{versionUploadProgress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full bg-brass transition-all" style={{ width: `${versionUploadProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {previewUrl && previewFile.mime_type.startsWith('image/') ? (
                      <img src={previewUrl} alt="preview" className="max-w-full rounded-2xl" />
                    ) : previewUrl && previewFile.mime_type === 'application/pdf' ? (
                      <iframe src={previewUrl} className="w-full h-[70vh] rounded-2xl bg-white" />
                    ) : (
                      <div className="bg-surface-1 rounded-2xl border border-line p-10 text-center">
                        <FileText className="w-16 h-16 text-fg-4 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold mb-2">لا توجد معاينة مباشرة لهذا النوع</h4>
                        <p className="text-sm text-fg-3 leading-7 mb-5">لكن ما زال بإمكانك تحميل الملف، مراجعة النسخ السابقة، وقراءة التعليقات أو إضافة تعليق جديد.</p>
                        <button onClick={() => handleDownload(previewFile)} className="inline-flex items-center gap-2 rounded-xl bg-brass px-4 py-2 text-sm font-medium hover:bg-brass-hover transition-colors">
                          <Download className="w-4 h-4" />
                          تحميل الملف الآن
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="overflow-auto p-6 space-y-6">
                    <section className="rounded-2xl border border-line bg-surface-1/70 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-brass-ring" />
                          <h4 className="font-semibold">سجل النسخ</h4>
                        </div>
                        <span className="text-xs text-fg-4">{fileVersions.length} سجل</span>
                      </div>

                      <div className="space-y-2">
                        {fileVersions.length === 0 ? (
                          <p className="text-sm text-fg-4">لا توجد نسخ محفوظة لهذا الملف حتى الآن.</p>
                        ) : (
                          fileVersions.map((version) => (
                            <div key={`${version.id}-${version.version_number}`} className="rounded-xl border border-line bg-surface-1/60 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium">الإصدار {version.version_number}</p>
                                    {version.is_current && (
                                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] text-sage">الحالي</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-fg-3 mt-1">{version.uploaded_by_name} • {new Date(version.created_at).toLocaleString('ar')}</p>
                                  <p className="text-xs text-fg-4 mt-1">{fileService.formatSize(version.size)}</p>
                                </div>
                                <button onClick={() => handleDownload(version)} className="p-2 rounded-lg hover:bg-surface-2 transition-colors">
                                  <Download className="w-4 h-4 text-fg-2" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-line bg-surface-1/70 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquareText className="w-4 h-4 text-brass-ring" />
                        <h4 className="font-semibold">التعليقات</h4>
                      </div>

                      <div className="space-y-3 mb-4">
                        <textarea
                          value={commentInput}
                          onChange={(event) => setCommentInput(event.target.value)}
                          placeholder="اكتب تعليقك هنا..."
                          rows={3}
                          className="w-full rounded-xl border border-line-strong bg-surface-1/70 px-4 py-3 text-sm text-fg-1 placeholder:text-fg-4/80 focus:border-brass-ring/70 focus:outline-none resize-none"
                        />
                        <button
                          onClick={handleAddComment}
                          disabled={commentSubmitting || !commentInput.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-brass px-4 py-2 text-sm font-medium hover:bg-brass-hover transition-colors disabled:opacity-60"
                        >
                          {commentSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              جاري الإرسال...
                            </>
                          ) : (
                            <>
                              <SendHorizontal className="w-4 h-4" />
                              إضافة تعليق
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-3">
                        {fileComments.length === 0 ? (
                          <p className="text-sm text-fg-4">لا توجد تعليقات بعد على هذا الملف.</p>
                        ) : (
                          fileComments.map((comment) => (
                            <div key={comment.id} className="rounded-xl border border-line bg-surface-1/60 p-3">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-sm font-medium text-fg-2">{comment.user_name}</p>
                                <span className="text-[11px] text-fg-4">{new Date(comment.created_at).toLocaleString('ar')}</span>
                              </div>
                              <p className="text-sm leading-7 text-fg-2 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
