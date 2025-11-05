/**
 * GitLab API type definitions
 * Based on GitLab REST API v4 documentation
 */

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string;
}

export interface GitLabPosition {
  base_sha?: string;
  start_sha?: string;
  head_sha?: string;
  old_path?: string;
  new_path?: string;
  position_type?: string;
  old_line?: number | null;
  new_line?: number | null;
}

export interface GitLabNote {
  id: number;
  type?: string;
  body: string;
  attachment?: unknown;
  author: GitLabUser;
  created_at: string;
  updated_at?: string;
  system: boolean;
  noteable_id: number;
  noteable_type: string;
  noteable_iid?: number;
  resolvable?: boolean;
  resolved?: boolean;
  resolved_by?: GitLabUser;
  resolved_at?: string;
  confidential?: boolean;
  internal?: boolean;
  position?: GitLabPosition;
}

export interface GitLabDiscussion {
  id: string;
  individual_note: boolean;
  notes: GitLabNote[];
}

export interface PaginationInfo {
  nextPage: number | null;
  totalPages: number | null;
  perPage: number;
  total: number | null;
}
