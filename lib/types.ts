export type ContentFormat = 'post' | 'carousel' | 'reel' | 'story' | 'video';

export type ContentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'changes_requested'
  | 'revised_pending'
  | 'scheduled'
  | 'published';

export type MediaKind = 'image' | 'video' | 'cover';
export type AuthorType = 'admin' | 'client';

export interface Client {
  id: string;
  owner_id: string;
  company_name: string;
  slug: string;
  instagram_handle: string;
  display_name: string | null;
  bio: string;
  contact_name: string;
  contact_email: string | null;
  /** WhatsApp do responsável (migration 0017). */
  contact_phone?: string | null;
  avatar_path: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  review_token: string;
  token_active: boolean;
  token_rotated_at: string;
  created_at: string;
}

export interface ContentItem {
  id: string;
  client_id: string;
  project_id: string;
  title: string;
  format: ContentFormat;
  scheduled_date: string | null; // YYYY-MM-DD
  scheduled_time: string | null; // HH:MM:SS
  objective: string;
  internal_notes: string;
  status: ContentStatus;
  current_version: number;
  approved_at: string | null;
  approved_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  caption: string;
  cta: string;
  hashtags: string;
  duration_seconds: number | null;
  note: string;
  created_at: string;
}

export interface ContentMedia {
  id: string;
  content_id: string;
  version_id: string;
  kind: MediaKind;
  storage_path: string;
  position: number;
  mime_type: string | null;
  created_at: string;
}

export interface CommentRow {
  id: string;
  content_id: string;
  version_id: string | null;
  author_type: AuthorType;
  author_name: string;
  message: string;
  slide_index: number | null;
  is_change_request: boolean;
  created_at: string;
}

export interface ApprovalRow {
  id: string;
  content_id: string;
  version_id: string | null;
  action: 'approved' | 'changes_requested';
  client_name: string;
  note: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  client_id: string;
  content_id: string | null;
  actor_type: 'admin' | 'client' | 'system';
  actor_name: string;
  action: string;
  detail: string;
  created_at: string;
}

/** Mídia já com URL assinada, pronta para renderizar. */
export interface SignedMedia extends ContentMedia {
  url: string;
}

/** Versão com suas mídias assinadas. */
export interface VersionWithMedia extends ContentVersion {
  media: SignedMedia[];
}

/** Dados mínimos para desenhar um card / miniatura. */
export interface ContentCardData extends ContentItem {
  /** URL assinada da miniatura (arte, 1º slide ou capa). */
  thumb: string | null;
  slide_count: number;
  has_video: boolean;
}

export interface ContentDetail extends ContentItem {
  versions: VersionWithMedia[];
  comments: CommentRow[];
  approvals: ApprovalRow[];
  history: ActivityLog[];
}

export interface ClientWithProject extends Client {
  project: Project | null;
  avatar_url: string | null;
}
