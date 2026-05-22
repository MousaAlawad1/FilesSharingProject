-- ============================================================================
-- FileShare Workspace — Consolidated schema (single migration)
-- ============================================================================
-- This file replaces the previous 001..007 migrations.
-- It is fully idempotent: safe to run on a fresh project AND safe to re-run.
-- It does NOT delete any existing data.
--
-- If you also want to wipe data and start from zero, run
--   supabase/RESET_AND_REBUILD_ALL_IN_ONE.sql
-- instead.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 0) Extensions
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) Tables
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_token    TEXT NOT NULL UNIQUE,
  max_storage_mb  INTEGER NOT NULL DEFAULT 500,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name    TEXT,
  role          TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  size              BIGINT NOT NULL DEFAULT 0,
  mime_type         TEXT NOT NULL DEFAULT '',
  storage_path      TEXT NOT NULL,
  uploaded_by       TEXT NOT NULL,
  uploaded_by_name  TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL DEFAULT '',
  action        TEXT NOT NULL,
  details       TEXT,
  ip_address    INET,
  user_agent    TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_logs may have been created without the extra columns by old 001
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS public.file_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id           UUID NOT NULL REFERENCES public.workspace_files(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  name              TEXT NOT NULL,
  size              BIGINT NOT NULL,
  mime_type         TEXT NOT NULL DEFAULT '',
  storage_path      TEXT NOT NULL,
  uploaded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name  TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (file_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.file_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id       UUID NOT NULL REFERENCES public.workspace_files(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL,
  parent_id     UUID REFERENCES public.file_comments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
                  'file_uploaded',
                  'file_deleted',
                  'file_version_uploaded',
                  'comment_added',
                  'member_joined',
                  'invite_regenerated'
                )),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2) Indexes
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_workspaces_owner            ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_invite           ON public.workspaces(invite_token);
CREATE INDEX IF NOT EXISTS idx_members_workspace           ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_members_user                ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_files_workspace             ON public.workspace_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace             ON public.audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_file          ON public.file_versions(file_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_file_versions_workspace     ON public.file_versions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_comments_file          ON public.file_comments(file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_comments_workspace     ON public.file_comments(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_comments_parent        ON public.file_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read     ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace     ON public.notifications(workspace_id, created_at DESC);

-- Prevent a user from being added twice to the same workspace (fixes race in
-- join_workspace_by_invite). Guests (user_id NULL) are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_unique_user
  ON public.workspace_members(workspace_id, user_id)
  WHERE user_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3) Helper functions used by RLS (SECURITY DEFINER to break recursion)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Why: a policy ON workspace_members cannot SELECT FROM workspace_members
-- without triggering itself recursively. SECURITY DEFINER functions run with
-- the function owner's rights and bypass RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_ws UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = p_ws
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_ws UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_ws AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_ws
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_upload_to_workspace(p_ws UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_ws AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_ws
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_to_workspace(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4) Enable RLS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- 5) RLS Policies
-- ════════════════════════════════════════════════════════════════════════════
-- Drop every policy this file owns first, so re-running picks up the new defs
-- and any stale/leaky policies from older migrations are removed.

-- ---- profiles ----
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- workspaces ----
DROP POLICY IF EXISTS "workspaces_select_member"            ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_auth"              ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_authenticated"     ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_owner"             ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_owner_or_admin"    ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_owner"             ON public.workspaces;

-- Members can see workspaces they belong to. Anonymous invite previews go
-- through the SECURITY DEFINER RPC `get_workspace_invite_preview` instead of
-- this policy, so we do NOT leak via `invite_token IS NOT NULL` like 001 did.
CREATE POLICY "workspaces_select_member" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));

CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspaces_update_owner_or_admin" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(id))
  WITH CHECK (public.is_workspace_admin(id));

CREATE POLICY "workspaces_delete_owner" ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---- workspace_members ----
DROP POLICY IF EXISTS "members_select_all"               ON public.workspace_members;
DROP POLICY IF EXISTS "members_select_workspace_members" ON public.workspace_members;
DROP POLICY IF EXISTS "members_insert_all"               ON public.workspace_members;
DROP POLICY IF EXISTS "members_insert_owner_or_admin"    ON public.workspace_members;
DROP POLICY IF EXISTS "members_update_owner_or_admin"    ON public.workspace_members;
DROP POLICY IF EXISTS "members_delete_owner"             ON public.workspace_members;
DROP POLICY IF EXISTS "members_delete_owner_or_admin"    ON public.workspace_members;

-- SELECT: any member of the workspace can see the member list.
-- Uses SECURITY DEFINER helper -> no recursion.
CREATE POLICY "members_select_workspace_members" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- INSERT: owners/admins add members directly. Self-join via invite uses the
-- SECURITY DEFINER RPC `join_workspace_by_invite` and bypasses this check.
CREATE POLICY "members_insert_owner_or_admin" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "members_update_owner_or_admin" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "members_delete_owner_or_admin" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- ---- workspace_files ----
DROP POLICY IF EXISTS "files_select_member"        ON public.workspace_files;
DROP POLICY IF EXISTS "files_insert_member"        ON public.workspace_files;
DROP POLICY IF EXISTS "files_delete_member"        ON public.workspace_files;
DROP POLICY IF EXISTS "files_update_owner_or_admin" ON public.workspace_files;
DROP POLICY IF EXISTS "files_delete_owner_or_admin" ON public.workspace_files;

CREATE POLICY "files_select_member" ON public.workspace_files
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "files_insert_member" ON public.workspace_files
  FOR INSERT TO authenticated
  WITH CHECK (public.can_upload_to_workspace(workspace_id));

CREATE POLICY "files_update_owner_or_admin" ON public.workspace_files
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "files_delete_owner_or_admin" ON public.workspace_files
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- ---- audit_logs ----
DROP POLICY IF EXISTS "audit_select_member"           ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert_all"              ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert_authenticated"    ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert_member"           ON public.audit_logs;

CREATE POLICY "audit_select_member" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- Tightened: only members of the workspace can insert audit rows for it.
CREATE POLICY "audit_insert_member" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ---- file_versions ----
DROP POLICY IF EXISTS "file_versions_select_member" ON public.file_versions;
DROP POLICY IF EXISTS "file_versions_insert_member" ON public.file_versions;

CREATE POLICY "file_versions_select_member" ON public.file_versions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "file_versions_insert_member" ON public.file_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_upload_to_workspace(workspace_id));

-- ---- file_comments ----
DROP POLICY IF EXISTS "file_comments_select_member"           ON public.file_comments;
DROP POLICY IF EXISTS "file_comments_insert_member"           ON public.file_comments;
DROP POLICY IF EXISTS "file_comments_update_owner"            ON public.file_comments;
DROP POLICY IF EXISTS "file_comments_delete_owner_or_admin"   ON public.file_comments;

CREATE POLICY "file_comments_select_member" ON public.file_comments
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "file_comments_insert_member" ON public.file_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "file_comments_update_owner" ON public.file_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "file_comments_delete_owner_or_admin" ON public.file_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_admin(workspace_id));

-- ---- notifications ----
DROP POLICY IF EXISTS "notifications_select_own"     ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own"     ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_self"    ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notification rows are written by SECURITY DEFINER triggers, never by clients.
-- We keep an INSERT policy only for the (rare) case a client wants to create
-- a notification addressed to itself.
CREATE POLICY "notifications_insert_self" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- 6) Storage bucket + storage policies
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-files', 'workspace-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_select_auth"           ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_auth"           ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_auth"           ON storage.objects;
DROP POLICY IF EXISTS "storage_select_member"         ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_member"         ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_owner_or_admin" ON storage.objects;

CREATE POLICY "storage_select_member" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'workspace-files'
    AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "storage_insert_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-files'
    AND public.can_upload_to_workspace(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "storage_delete_owner_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace-files'
    AND public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 7) Core utility functions
-- ════════════════════════════════════════════════════════════════════════════

-- Auto-create / sync the profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_display_name(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  display_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(full_name, ''), SPLIT_PART(email, '@', 1), 'مستخدم')
    INTO display_name
  FROM public.profiles
  WHERE id = user_uuid;

  RETURN COALESCE(display_name, 'مستخدم');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_storage_usage(ws_id UUID)
RETURNS TABLE(used_bytes BIGINT, max_bytes BIGINT, used_percentage NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(f.size), 0)::BIGINT                                                  AS used_bytes,
    (w.max_storage_mb * 1024 * 1024)::BIGINT                                          AS max_bytes,
    CASE
      WHEN w.max_storage_mb = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(f.size), 0)::NUMERIC / (w.max_storage_mb * 1024 * 1024)::NUMERIC) * 100,
        1
      )
    END                                                                               AS used_percentage
  FROM public.workspaces w
  LEFT JOIN public.workspace_files f ON f.workspace_id = w.id
  WHERE w.id = ws_id
  GROUP BY w.id, w.max_storage_mb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_storage_usage(UUID)  TO authenticated;

-- Enforce per-workspace storage limit
CREATE OR REPLACE FUNCTION public.check_storage_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_usage BIGINT;
  max_bytes     BIGINT;
BEGIN
  SELECT COALESCE(SUM(size), 0) INTO current_usage
  FROM public.workspace_files
  WHERE workspace_id = NEW.workspace_id;

  SELECT (max_storage_mb * 1024 * 1024)::BIGINT INTO max_bytes
  FROM public.workspaces
  WHERE id = NEW.workspace_id;

  IF current_usage + NEW.size > max_bytes THEN
    RAISE EXCEPTION 'Storage limit exceeded. Current: % MB, Limit: % MB',
      current_usage / (1024 * 1024), max_bytes / (1024 * 1024);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_file_comment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8) Invite preview + invite join RPCs
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_workspace_invite_preview(p_token TEXT)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  description   TEXT,
  invite_token  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT w.id, w.name, w.description, w.invite_token
  FROM public.workspaces w
  WHERE w.invite_token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_invite_preview(TEXT)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_workspace_by_invite(p_token TEXT)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  description     TEXT,
  owner_id        UUID,
  invite_token    TEXT,
  max_storage_mb  INTEGER,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ws               public.workspaces%ROWTYPE;
  current_user_id  UUID;
  display_name     TEXT;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO ws
  FROM public.workspaces w
  WHERE w.invite_token = p_token
  LIMIT 1;

  IF ws.id IS NULL THEN
    RAISE EXCEPTION 'Invite link is invalid or expired';
  END IF;

  -- Idempotent: rely on the partial unique index to dedupe.
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws.id, current_user_id, 'member')
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    display_name := public.get_user_display_name(current_user_id);
    INSERT INTO public.audit_logs (workspace_id, user_id, user_name, action, details)
    VALUES (
      ws.id,
      current_user_id,
      COALESCE(display_name, 'مستخدم'),
      'انضمام عضو',
      COALESCE(display_name, 'مستخدم') || ' انضم إلى المساحة عبر رابط دعوة'
    );
  END IF;

  RETURN QUERY
  SELECT ws.id, ws.name, ws.description, ws.owner_id,
         ws.invite_token, ws.max_storage_mb, ws.created_at, ws.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_workspace_by_invite(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9) Enriched members RPC
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_workspace_members_enriched(p_workspace_id UUID)
RETURNS TABLE (
  id            UUID,
  workspace_id  UUID,
  user_id       UUID,
  guest_name    TEXT,
  role          TEXT,
  joined_at     TIMESTAMPTZ,
  display_name  TEXT,
  email         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    wm.id,
    wm.workspace_id,
    wm.user_id,
    wm.guest_name,
    wm.role::TEXT,
    wm.joined_at,
    COALESCE(
      NULLIF(wm.guest_name, ''),
      NULLIF(p.full_name, ''),
      NULLIF(SPLIT_PART(COALESCE(p.email, ''), '@', 1), ''),
      'عضو'
    ) AS display_name,
    p.email
  FROM public.workspace_members wm
  LEFT JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY wm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_members_enriched(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9b) Atomic workspace creation RPC
-- ════════════════════════════════════════════════════════════════════════════
--
-- Creates a workspace + its owner member row + an audit log entry in one
-- SECURITY DEFINER call. This avoids any "new row violates row-level security
-- policy for table workspaces" errors that can happen when the client session
-- is in an odd state or when RLS gets stricter later.
--
-- The caller MUST be authenticated. owner_id is forced to auth.uid().

CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name         TEXT,
  p_description  TEXT DEFAULT '',
  p_invite_token TEXT DEFAULT NULL
)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID;
  token           TEXT;
  ws              public.workspaces%ROWTYPE;
  display_name    TEXT;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  token := COALESCE(
    NULLIF(p_invite_token, ''),
    REPLACE(gen_random_uuid()::text, '-', '')
  );
  token := LEFT(token, 12);

  -- Ensure uniqueness even with the short slice
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE invite_token = token) LOOP
    token := LEFT(REPLACE(gen_random_uuid()::text, '-', ''), 12);
  END LOOP;

  INSERT INTO public.workspaces (name, description, owner_id, invite_token, max_storage_mb)
  VALUES (TRIM(p_name), COALESCE(p_description, ''), current_user_id, token, 500)
  RETURNING * INTO ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws.id, current_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  display_name := public.get_user_display_name(current_user_id);

  INSERT INTO public.audit_logs (workspace_id, user_id, user_name, action, details)
  VALUES (
    ws.id,
    current_user_id,
    COALESCE(display_name, 'مستخدم'),
    'إنشاء مساحة عمل',
    'تم إنشاء "' || ws.name || '"'
  );

  RETURN ws;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 10) Notification fan-out helpers and per-event triggers
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_workspace_members(
  p_workspace_id   UUID,
  p_actor_user_id  UUID,
  p_type           TEXT,
  p_title          TEXT,
  p_message        TEXT,
  p_data           JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, workspace_id, type, title, message, data, read)
  SELECT
    wm.user_id, p_workspace_id, p_type, p_title, p_message, p_data, false
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id IS NOT NULL
    AND (p_actor_user_id IS NULL OR wm.user_id <> p_actor_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_name      TEXT;
  workspace_name  TEXT;
BEGIN
  IF NEW.role = 'owner' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  actor_name := COALESCE(public.get_user_display_name(NEW.user_id), 'مستخدم');
  SELECT name INTO workspace_name FROM public.workspaces WHERE id = NEW.workspace_id;

  PERFORM public.notify_workspace_members(
    NEW.workspace_id,
    NEW.user_id,
    'member_joined',
    'انضم عضو جديد',
    actor_name || ' انضم إلى مساحة العمل ' || COALESCE(workspace_name, ''),
    jsonb_build_object(
      'workspaceId',    NEW.workspace_id,
      'memberId',       NEW.id,
      'workspaceName',  workspace_name
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_file_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor UUID;
BEGIN
  -- workspace_files.uploaded_by is TEXT (may hold a guest tag like "guest-xxx").
  -- Only cast to UUID when it actually looks like one; otherwise leave NULL
  -- so the actor exclusion in notify_workspace_members is a no-op.
  IF NEW.uploaded_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    actor := NEW.uploaded_by::uuid;
  ELSE
    actor := NULL;
  END IF;

  PERFORM public.notify_workspace_members(
    NEW.workspace_id,
    actor,
    'file_uploaded',
    'تم رفع ملف جديد',
    COALESCE(NULLIF(NEW.uploaded_by_name, ''), 'مستخدم') || ' رفع الملف ' || NEW.name,
    jsonb_build_object(
      'workspaceId', NEW.workspace_id,
      'fileId',      NEW.id,
      'fileName',    NEW.name
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_file_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.notify_workspace_members(
    OLD.workspace_id,
    NULL,
    'file_deleted',
    'تم حذف ملف',
    'تم حذف الملف ' || OLD.name,
    jsonb_build_object(
      'workspaceId', OLD.workspace_id,
      'fileId',      OLD.id,
      'fileName',    OLD.name
    )
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_file_version_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.notify_workspace_members(
    NEW.workspace_id,
    NEW.uploaded_by,
    'file_version_uploaded',
    'تم رفع نسخة جديدة',
    COALESCE(NULLIF(NEW.uploaded_by_name, ''), 'مستخدم') || ' رفع نسخة جديدة للملف ' || NEW.name,
    jsonb_build_object(
      'workspaceId', NEW.workspace_id,
      'fileId',      NEW.file_id,
      'versionId',   NEW.id,
      'fileName',    NEW.name
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_comment_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.notify_workspace_members(
    NEW.workspace_id,
    NEW.user_id,
    'comment_added',
    'تعليق جديد على ملف',
    COALESCE(NULLIF(NEW.user_name, ''), 'مستخدم') || ' أضاف تعليقاً جديداً',
    jsonb_build_object(
      'workspaceId', NEW.workspace_id,
      'fileId',      NEW.file_id,
      'commentId',   NEW.id
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_invite_regenerated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_user_id UUID;
BEGIN
  IF OLD.invite_token IS NOT DISTINCT FROM NEW.invite_token THEN
    RETURN NEW;
  END IF;

  actor_user_id := auth.uid();

  PERFORM public.notify_workspace_members(
    NEW.id,
    actor_user_id,
    'invite_regenerated',
    'تم تحديث رابط الدعوة',
    'تم إنشاء رابط دعوة جديد لمساحة العمل ' || NEW.name,
    jsonb_build_object('workspaceId', NEW.id, 'workspaceName', NEW.name)
  );
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 11) Triggers (drop + recreate to stay idempotent)
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created                  ON auth.users;
DROP TRIGGER IF EXISTS trg_check_storage_limit               ON public.workspace_files;
DROP TRIGGER IF EXISTS trg_file_comments_updated_at          ON public.file_comments;
DROP TRIGGER IF EXISTS trg_workspace_members_notify_joined   ON public.workspace_members;
DROP TRIGGER IF EXISTS trg_workspace_files_notify_insert     ON public.workspace_files;
DROP TRIGGER IF EXISTS trg_workspace_files_notify_delete     ON public.workspace_files;
DROP TRIGGER IF EXISTS trg_file_versions_notify_insert       ON public.file_versions;
DROP TRIGGER IF EXISTS trg_file_comments_notify_insert       ON public.file_comments;
DROP TRIGGER IF EXISTS trg_workspaces_notify_invite_update   ON public.workspaces;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_check_storage_limit
  BEFORE INSERT ON public.workspace_files
  FOR EACH ROW EXECUTE FUNCTION public.check_storage_limit();

CREATE TRIGGER trg_file_comments_updated_at
  BEFORE UPDATE ON public.file_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_file_comment_updated_at();

CREATE TRIGGER trg_workspace_members_notify_joined
  AFTER INSERT ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_member_joined();

CREATE TRIGGER trg_workspace_files_notify_insert
  AFTER INSERT ON public.workspace_files
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_file_uploaded();

CREATE TRIGGER trg_workspace_files_notify_delete
  BEFORE DELETE ON public.workspace_files
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_file_deleted();

CREATE TRIGGER trg_file_versions_notify_insert
  AFTER INSERT ON public.file_versions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_file_version_uploaded();

CREATE TRIGGER trg_file_comments_notify_insert
  AFTER INSERT ON public.file_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_comment_added();

CREATE TRIGGER trg_workspaces_notify_invite_update
  AFTER UPDATE OF invite_token ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_invite_regenerated();

-- ════════════════════════════════════════════════════════════════════════════
-- 12) Realtime publication membership
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspace_files',
    'workspace_members',
    'file_comments',
    'file_versions',
    'notifications'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
