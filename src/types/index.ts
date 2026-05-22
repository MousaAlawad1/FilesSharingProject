export type Role = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export type NotificationType =
  | 'file_uploaded'
  | 'file_deleted'
  | 'file_version_uploaded'
  | 'comment_added'
  | 'member_joined'
  | 'invite_regenerated';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  invite_token: string;
  max_storage_mb: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInvitePreview {
  id: string;
  name: string;
  description?: string;
  invite_token: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id?: string;
  guest_name?: string;
  role: Role;
  joined_at: string;
  display_name?: string;
  email?: string | null;
  is_current_user?: boolean;
}

export interface WorkspaceFile {
  id: string;
  workspace_id: string;
  name: string;
  size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  workspace_id: string;
  version_number: number;
  name: string;
  size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by?: string | null;
  uploaded_by_name: string;
  created_at: string;
  is_current: boolean;
}

export interface FileComment {
  id: string;
  file_id: string;
  workspace_id: string;
  user_id?: string | null;
  user_name: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  user_id?: string;
  user_name: string;
  action: string;
  details?: string;
  created_at: string;
}

export interface WorkspaceActivity extends AuditLog {
  workspace_name?: string;
}

export interface StorageInfo {
  used: number;
  max: number;
  percentage: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
