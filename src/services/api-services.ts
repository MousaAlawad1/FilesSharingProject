import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import {
  AuditLog,
  FileComment,
  FileVersion,
  NotificationItem,
  PaginatedResult,
  Role,
  StorageInfo,
  Workspace,
  WorkspaceActivity,
  WorkspaceFile,
  WorkspaceInvitePreview,
  WorkspaceMember,
} from '@/types';

export interface NotificationListResult extends PaginatedResult<NotificationItem> {
  unreadCount: number;
}

function createError(message: string) {
  return new Error(message);
}

async function getCurrentUserOrThrow() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw createError('يجب تسجيل الدخول أولاً');
  }

  return user;
}

function getActorName(user: Awaited<ReturnType<typeof getCurrentUserOrThrow>>) {
  return user.user_metadata?.full_name || user.email || 'مستخدم';
}

async function logAudit(
  workspaceId: string,
  userId: string | null,
  userName: string,
  action: string,
  details?: string
) {
  await supabase.from('audit_logs').insert({
    workspace_id: workspaceId,
    user_id: userId,
    user_name: userName,
    action,
    details,
  });
}

function buildPagination(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

async function getStorageInfoDirect(workspaceId: string): Promise<StorageInfo> {
  const { data, error } = await supabase.rpc('get_workspace_storage_usage', {
    ws_id: workspaceId,
  });

  if (error) {
    throw createError('تعذر حساب معلومات التخزين');
  }

  const firstRow = data?.[0];
  return {
    used: firstRow?.used_bytes || 0,
    max: firstRow?.max_bytes || 0,
    percentage: firstRow?.used_percentage || 0,
  };
}

async function getWorkspaceFileOrThrow(workspaceId: string, fileId: string): Promise<WorkspaceFile> {
  const { data, error } = await supabase
    .from('workspace_files')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', fileId)
    .maybeSingle();

  if (error || !data) {
    throw createError('الملف غير موجود');
  }

  return data;
}

async function getHighestVersionNumber(fileId: string) {
  const { data } = await supabase
    .from('file_versions')
    .select('version_number')
    .eq('file_id', fileId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.version_number || 0;
}

async function uploadToStorage(workspaceId: string, file: File) {
  const ext = file.name.split('.').pop() || '';
  const storagePath = `${workspaceId}/${uuidv4()}${ext ? `.${ext}` : ''}`;

  const { error } = await supabase.storage
    .from('workspace-files')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw createError(error.message || 'تعذر رفع الملف');
  }

  return storagePath;
}

async function getCurrentUserMembershipRole(workspaceId: string) {
  const user = await getCurrentUserOrThrow();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw createError('تعذر التحقق من صلاحياتك داخل المساحة');
  }

  return data?.role as Role | undefined;
}

async function getWorkspaceIdsForCurrentUser() {
  const user = await getCurrentUserOrThrow();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id);

  if (error) {
    throw createError('تعذر جلب عضويات المستخدم');
  }

  return [...new Set((data || []).map((item) => item.workspace_id))];
}

export const supabaseWorkspaceService = {
  async listForCurrentUser(): Promise<Workspace[]> {
    const workspaceIds = await getWorkspaceIdsForCurrentUser();
    if (workspaceIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw createError('تعذر جلب مساحات العمل');
    }

    return data || [];
  },

  async getRecentActivity(limit = 10): Promise<WorkspaceActivity[]> {
    const workspaceIds = await getWorkspaceIdsForCurrentUser();
    if (workspaceIds.length === 0) {
      return [];
    }

    const { data: logs, error: logsError } = await supabase
      .from('audit_logs')
      .select('*')
      .in('workspace_id', workspaceIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      throw createError('تعذر تحميل النشاط الأخير');
    }

    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds);

    if (workspacesError) {
      throw createError('تعذر تحميل أسماء المساحات');
    }

    const workspaceNameMap = new Map((workspaces || []).map((workspace) => [workspace.id, workspace.name]));

    return (logs || []).map((log) => ({
      ...(log as AuditLog),
      workspace_name: workspaceNameMap.get(log.workspace_id),
    }));
  },

  async create(name: string, description: string): Promise<Workspace> {
    // Use the SECURITY DEFINER RPC so the workspace + owner member + audit log
    // are created atomically and we never hit RLS edge-cases on the client.
    const { data, error } = await supabase.rpc('create_workspace', {
      p_name: name,
      p_description: description ?? '',
      p_invite_token: null,
    });

    if (error || !data) {
      throw createError(error?.message || 'تعذر إنشاء مساحة العمل');
    }

    // rpc returns the workspaces row (single object since RETURNS workspaces)
    return data as Workspace;
  },

  async getById(id: string): Promise<Workspace> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw createError('تعذر تحميل مساحة العمل');
    }

    return data;
  },

  async getInvitePreview(token: string): Promise<WorkspaceInvitePreview> {
    const { data, error } = await supabase.rpc('get_workspace_invite_preview', {
      p_token: token,
    });

    const preview = Array.isArray(data) ? data[0] : data;

    if (error || !preview) {
      throw createError('رابط الدعوة غير صالح أو منتهي الصلاحية');
    }

    return preview as WorkspaceInvitePreview;
  },

  async joinByInviteToken(token: string): Promise<Workspace> {
    const { data, error } = await supabase.rpc('join_workspace_by_invite', {
      p_token: token,
    });

    const workspace = Array.isArray(data) ? data[0] : data;

    if (error || !workspace) {
      throw createError(error?.message || 'تعذر الانضمام إلى المساحة');
    }

    return workspace as Workspace;
  },

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const user = await getCurrentUserOrThrow();
    const { data, error } = await supabase.rpc('get_workspace_members_enriched', {
      p_workspace_id: workspaceId,
    });

    if (error) {
      throw createError(error.message || 'تعذر تحميل أعضاء المساحة');
    }

    return ((data || []) as WorkspaceMember[]).map((member) => ({
      ...member,
      is_current_user: member.user_id === user.id,
    }));
  },

  async updateMemberRole(workspaceId: string, memberId: string, role: Role): Promise<WorkspaceMember> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);
    const currentUserRole = await getCurrentUserMembershipRole(workspaceId);

    if (!currentUserRole || !['owner', 'admin'].includes(currentUserRole)) {
      throw createError('لا تملك صلاحية تعديل الأدوار');
    }

    const { data: targetMember, error: targetError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', memberId)
      .maybeSingle();

    if (targetError || !targetMember) {
      throw createError('العضو غير موجود');
    }

    if (targetMember.role === 'owner') {
      throw createError('لا يمكن تعديل دور المالك');
    }

    if (targetMember.user_id === user.id) {
      throw createError('لا يمكنك تعديل دورك من هذه الواجهة');
    }

    if (currentUserRole === 'admin' && targetMember.role === 'admin') {
      throw createError('المشرف لا يمكنه تعديل دور مشرف آخر');
    }

    const { data, error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)
      .select('*')
      .single();

    if (error || !data) {
      throw createError(error?.message || 'تعذر تحديث دور العضو');
    }

    const targetName = targetMember.guest_name || targetMember.user_id?.slice(0, 8) || 'عضو';
    await logAudit(workspaceId, user.id, actorName, 'تغيير دور عضو', `تم تغيير دور ${targetName} إلى ${role}`);

    return data;
  },

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);
    const currentUserRole = await getCurrentUserMembershipRole(workspaceId);

    if (!currentUserRole || !['owner', 'admin'].includes(currentUserRole)) {
      throw createError('لا تملك صلاحية إزالة الأعضاء');
    }

    const { data: targetMember, error: targetError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', memberId)
      .maybeSingle();

    if (targetError || !targetMember) {
      throw createError('العضو غير موجود');
    }

    if (targetMember.role === 'owner') {
      throw createError('لا يمكن إزالة مالك المساحة');
    }

    if (targetMember.user_id === user.id) {
      throw createError('لا يمكنك إزالة نفسك من هذه الواجهة');
    }

    if (currentUserRole === 'admin' && targetMember.role === 'admin') {
      throw createError('المشرف لا يمكنه إزالة مشرف آخر');
    }

    const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);

    if (error) {
      throw createError(error.message || 'تعذر إزالة العضو');
    }

    const targetName = targetMember.guest_name || targetMember.user_id?.slice(0, 8) || 'عضو';
    await logAudit(workspaceId, user.id, actorName, 'إزالة عضو', `تمت إزالة ${targetName} من المساحة`);
  },

  async getFiles(
    id: string,
    options?: { page?: number; limit?: number; search?: string }
  ): Promise<PaginatedResult<WorkspaceFile>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, options?.limit || 12);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('workspace_files')
      .select('*', { count: 'exact' })
      .eq('workspace_id', id)
      .order('created_at', { ascending: false });

    if (options?.search?.trim()) {
      query = query.ilike('name', `%${options.search.trim()}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw createError('تعذر تحميل الملفات');
    }

    return {
      data: data || [],
      pagination: buildPagination(page, limit, count || 0),
    };
  },

  async uploadFile(workspaceId: string, file: File, onProgress?: (percentage: number) => void): Promise<WorkspaceFile> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);
    const storageInfo = await getStorageInfoDirect(workspaceId);

    if (storageInfo.max > 0 && storageInfo.used + file.size > storageInfo.max) {
      throw createError('المساحة المتبقية لا تكفي لرفع هذا الملف');
    }

    if (onProgress) onProgress(5);
    const storagePath = await uploadToStorage(workspaceId, file);
    if (onProgress) onProgress(85);

    const { data, error } = await supabase
      .from('workspace_files')
      .insert({
        workspace_id: workspaceId,
        name: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path: storagePath,
        uploaded_by: user.id,
        uploaded_by_name: actorName,
      })
      .select('*')
      .single();

    if (error || !data) {
      await supabase.storage.from('workspace-files').remove([storagePath]).catch(() => undefined);
      throw createError(error?.message || 'تعذر حفظ بيانات الملف');
    }

    await logAudit(workspaceId, user.id, actorName, 'رفع ملف', `تم رفع "${file.name}"`);
    if (onProgress) onProgress(100);
    return data;
  },

  async getFileVersions(workspaceId: string, fileId: string): Promise<FileVersion[]> {
    const currentFile = await getWorkspaceFileOrThrow(workspaceId, fileId);
    const { data, error } = await supabase
      .from('file_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('file_id', fileId)
      .order('version_number', { ascending: false });

    if (error) {
      throw createError('تعذر تحميل سجل النسخ');
    }

    const archivedVersions = data || [];
    const currentVersionNumber = Math.max(...archivedVersions.map((item) => item.version_number), 0) + 1;

    return [
      {
        id: currentFile.id,
        file_id: currentFile.id,
        workspace_id: currentFile.workspace_id,
        version_number: currentVersionNumber,
        name: currentFile.name,
        size: currentFile.size,
        mime_type: currentFile.mime_type,
        storage_path: currentFile.storage_path,
        uploaded_by: currentFile.uploaded_by,
        uploaded_by_name: currentFile.uploaded_by_name,
        created_at: currentFile.created_at,
        is_current: true,
      },
      ...archivedVersions.map((item) => ({ ...item, is_current: false })),
    ];
  },

  async uploadFileVersion(
    workspaceId: string,
    fileId: string,
    file: File,
    onProgress?: (percentage: number) => void
  ): Promise<WorkspaceFile> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);
    const currentFile = await getWorkspaceFileOrThrow(workspaceId, fileId);
    const storagePath = await uploadToStorage(workspaceId, file);
    const highestVersionNumber = await getHighestVersionNumber(fileId);

    const { error: archiveError } = await supabase.from('file_versions').insert({
      file_id: fileId,
      workspace_id: workspaceId,
      version_number: highestVersionNumber + 1,
      name: currentFile.name,
      size: currentFile.size,
      mime_type: currentFile.mime_type,
      storage_path: currentFile.storage_path,
      uploaded_by: currentFile.uploaded_by,
      uploaded_by_name: currentFile.uploaded_by_name,
      created_at: currentFile.created_at,
    });

    if (archiveError) {
      await supabase.storage.from('workspace-files').remove([storagePath]).catch(() => undefined);
      throw createError('تعذر حفظ النسخة السابقة');
    }

    if (onProgress) onProgress(85);
    const { data, error } = await supabase
      .from('workspace_files')
      .update({
        name: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path: storagePath,
        uploaded_by: user.id,
        uploaded_by_name: actorName,
        created_at: new Date().toISOString(),
      })
      .eq('id', fileId)
      .select('*')
      .single();

    if (error || !data) {
      throw createError('تعذر تحديث الملف بالنسخة الجديدة');
    }

    await logAudit(workspaceId, user.id, actorName, 'رفع نسخة جديدة', `تم رفع نسخة جديدة للملف "${currentFile.name}"`);
    if (onProgress) onProgress(100);
    return data;
  },

  async getFileComments(
    workspaceId: string,
    fileId: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedResult<FileComment>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, options?.limit || 20);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('file_comments')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('file_id', fileId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw createError('تعذر تحميل التعليقات');
    }

    return {
      data: data || [],
      pagination: buildPagination(page, limit, count || 0),
    };
  },

  async addFileComment(
    workspaceId: string,
    fileId: string,
    content: string,
    parentId?: string
  ): Promise<FileComment> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);

    const { data, error } = await supabase
      .from('file_comments')
      .insert({
        workspace_id: workspaceId,
        file_id: fileId,
        user_id: user.id,
        user_name: actorName,
        content,
        parent_id: parentId || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw createError(error?.message || 'تعذر إضافة التعليق');
    }

    await logAudit(workspaceId, user.id, actorName, 'إضافة تعليق', 'تمت إضافة تعليق جديد على ملف داخل المساحة');
    return data;
  },

  async getActivity(id: string, options?: { page?: number; limit?: number }): Promise<PaginatedResult<AuditLog>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, options?.limit || 10);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw createError('تعذر تحميل سجل النشاط');
    }

    return {
      data: data || [],
      pagination: buildPagination(page, limit, count || 0),
    };
  },

  async getStorage(id: string): Promise<StorageInfo> {
    return getStorageInfoDirect(id);
  },

  async updateWorkspace(
    id: string,
    updates: { name: string; description: string; max_storage_mb: number }
  ): Promise<Workspace> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);

    const { data, error } = await supabase
      .from('workspaces')
      .update({
        name: updates.name,
        description: updates.description,
        max_storage_mb: updates.max_storage_mb,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw createError(error?.message || 'تعذر حفظ إعدادات المساحة');
    }

    await logAudit(id, user.id, actorName, 'تحديث إعدادات المساحة', 'تم تعديل إعدادات المساحة');
    return data;
  },

  async regenerateInvite(id: string): Promise<{ invite_token: string }> {
    const newToken = uuidv4().replace(/-/g, '').slice(0, 12);

    const { error } = await supabase
      .from('workspaces')
      .update({ invite_token: newToken })
      .eq('id', id);

    if (error) {
      throw createError('تعذر إعادة توليد رابط الدعوة');
    }

    return { invite_token: newToken };
  },

  async deleteWorkspace(id: string): Promise<void> {
    try {
      const { data: files } = await supabase.storage.from('workspace-files').list(id);
      if (files?.length) {
        const paths = files.map((file) => `${id}/${file.name}`);
        await supabase.storage.from('workspace-files').remove(paths);
      }
    } catch {
      // ignore storage cleanup errors
    }

    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) {
      throw createError('تعذر حذف مساحة العمل');
    }
  },

  async deleteFile(workspaceId: string, fileId: string): Promise<void> {
    const user = await getCurrentUserOrThrow();
    const actorName = getActorName(user);
    const file = await getWorkspaceFileOrThrow(workspaceId, fileId);

    try {
      await supabase.storage.from('workspace-files').remove([file.storage_path]);
    } catch {
      // ignore storage deletion failure
    }

    const { error } = await supabase.from('workspace_files').delete().eq('id', fileId);

    if (error) {
      throw createError('تعذر حذف الملف');
    }

    await logAudit(workspaceId, user.id, actorName, 'حذف ملف', `تم حذف "${file.name}"`);
  },
};

export const supabaseNotificationsService = {
  async list(options?: { page?: number; limit?: number; unreadOnly?: boolean }): Promise<NotificationListResult> {
    const user = await getCurrentUserOrThrow();
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, options?.limit || 8);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw createError('تعذر تحميل الإشعارات');
    }

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    return {
      data: data || [],
      pagination: buildPagination(page, limit, count || 0),
      unreadCount: unreadCount || 0,
    };
  },

  async markAsRead(notificationId: string): Promise<number> {
    const user = await getCurrentUserOrThrow();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      throw createError('تعذر تحديث حالة الإشعار');
    }

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    return count || 0;
  },

  async markAllAsRead(): Promise<number> {
    const user = await getCurrentUserOrThrow();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      throw createError('تعذر تحديث الإشعارات');
    }

    return 0;
  },
};
