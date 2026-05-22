import { supabase } from '@/lib/supabase';
import { Workspace, WorkspaceMember, WorkspaceFile, AuditLog } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** جلب اسم العرض الحقيقي من البروفايل */
async function getDisplayName(userId: string): Promise<string> {
  try {
    const { data } = await supabase.rpc('get_user_display_name', {
      user_uuid: userId,
    });
    return (data as string) || 'مستخدم';
  } catch {
    return 'مستخدم';
  }
}

/** حساب التخزين المستخدم بالبايت */
async function getWorkspaceStorageUsage(workspaceId: string): Promise<{
  used_bytes: number;
  max_bytes: number;
  used_percentage: number;
}> {
  const { data } = await supabase.rpc('get_workspace_storage_usage', {
    ws_id: workspaceId,
  });
  return (
    data?.[0] ?? {
      used_bytes: 0,
      max_bytes: 500 * 1024 * 1024,
      used_percentage: 0,
    }
  );
}

// ─── Workspace Service ───────────────────────────────────────────────────────

export const workspaceService = {
  async create(name: string, description: string, _ownerId: string): Promise<Workspace> {
    // Atomic RPC: workspace + owner member + audit log in one SECURITY DEFINER call.
    // owner_id is forced to auth.uid() server-side; the _ownerId arg is ignored.
    const { data, error } = await supabase.rpc('create_workspace', {
      p_name: name,
      p_description: description ?? '',
      p_invite_token: null,
    });
    if (error || !data) throw error || new Error('create_workspace failed');
    return data as Workspace;
  },

  async getById(id: string): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async getByInviteToken(token: string): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async listForUser(userId: string): Promise<Workspace[]> {
    const { data: memberships, error: mErr } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);
    if (mErr || !memberships?.length) return [];

    const ids = memberships.map((m) => m.workspace_id);
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async join(workspaceId: string, userId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return;

    await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'member',
    });

    const displayName = await getDisplayName(userId);
    await this.logAudit(workspaceId, userId, displayName, 'انضمام عضو', `${displayName} انضم للمساحة`);
  },

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    const { data, error } = await supabase
      .from('workspace_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async regenerateInvite(workspaceId: string): Promise<string> {
    const newToken = uuidv4().replace(/-/g, '').slice(0, 12);
    const { error } = await supabase
      .from('workspaces')
      .update({ invite_token: newToken })
      .eq('id', workspaceId);
    if (error) throw error;
    return newToken;
  },

  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      const { data: files } = await supabase.storage
        .from('workspace-files')
        .list(workspaceId);
      if (files?.length) {
        const paths = files.map((f) => `${workspaceId}/${f.name}`);
        await supabase.storage.from('workspace-files').remove(paths);
      }
    } catch {
      // Storage cleanup failure shouldn't block workspace deletion
    }

    await supabase.from('workspace_files').delete().eq('workspace_id', workspaceId);
    await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId);
    await supabase.from('audit_logs').delete().eq('workspace_id', workspaceId);
    await supabase.from('workspaces').delete().eq('id', workspaceId);
  },

  async getStorageUsed(workspaceId: string): Promise<number> {
    const usage = await getWorkspaceStorageUsage(workspaceId);
    return usage.used_bytes;
  },

  async getStorageInfo(workspaceId: string): Promise<{
    used: number;
    max: number;
    percentage: number;
  }> {
    const usage = await getWorkspaceStorageUsage(workspaceId);
    return {
      used: usage.used_bytes,
      max: usage.max_bytes,
      percentage: usage.used_percentage,
    };
  },

  async getAuditLog(workspaceId: string): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  async logAudit(
    workspaceId: string,
    userId: string | null,
    userName: string,
    action: string,
    details?: string
  ): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        workspace_id: workspaceId,
        user_id: userId,
        user_name: userName,
        action,
        details,
      });
    } catch {
      // Audit log failure should not break the main operation
    }
  },
};

// ─── File Service ────────────────────────────────────────────────────────────

export const fileService = {
  async upload(
    workspaceId: string,
    file: File,
    uploadedBy: string,
    uploadedByName: string
  ): Promise<WorkspaceFile> {
    const fileId = uuidv4();
    const ext = file.name.split('.').pop() || '';
    const storagePath = `${workspaceId}/${fileId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('workspace-files')
      .upload(storagePath, file, { contentType: file.type });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('workspace_files')
      .insert({
        workspace_id: workspaceId,
        name: file.name,
        size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        uploaded_by: uploadedBy,
        uploaded_by_name: uploadedByName,
      })
      .select()
      .single();
    if (error) throw error;

    try {
      await workspaceService.logAudit(
        workspaceId,
        uploadedBy,
        uploadedByName,
        'رفع ملف',
        `تم رفع "${file.name}" (${this.formatSize(file.size)})`
      );
    } catch {
      // ignore audit failure
    }
    return data;
  },

  async deleteFile(fileRecord: WorkspaceFile, userId: string, userName: string): Promise<void> {
    await supabase.storage
      .from('workspace-files')
      .remove([fileRecord.storage_path]);
    await supabase.from('workspace_files').delete().eq('id', fileRecord.id);
    await workspaceService.logAudit(
      fileRecord.workspace_id,
      userId,
      userName,
      'حذف ملف',
      `تم حذف "${fileRecord.name}"`
    );
  },

  async getDownloadUrl(storagePath: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from('workspace-files')
        .createSignedUrl(storagePath, 3600);
      if (error || !data?.signedUrl) return '';
      return data.signedUrl;
    } catch {
      return '';
    }
  },

  canPreview(mimeType: string): boolean {
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json'
    );
  },

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },
};

// ─── Realtime Service ────────────────────────────────────────────────────────

let activeChannel: RealtimeChannel | null = null;

export const realtimeService = {
  subscribeToWorkspace(
    workspaceId: string,
    onFilesChange: () => void,
    onMembersChange: () => void
  ): void {
    this.unsubscribe();

    activeChannel = supabase
      .channel(`workspace-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_files',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => onFilesChange()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => onMembersChange()
      )
      .subscribe();
  },

  unsubscribe(): void {
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
  },
};
