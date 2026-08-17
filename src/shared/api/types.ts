/**
 * Mirrors the backend's response contract exactly.
 * Source of truth: `backend/src/common/types/api-envelope.ts`.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  data: null;
  message: string;
  statusCode: number;
  path: string;
  timestamp: string;
  /** Field-level messages from the backend's ValidationPipe. */
  errors?: string[];
}

/**
 * Note `limit`, not `pageSize`. The backend uses one name for the query parameter and the
 * response field deliberately; P1 carried both names for months and had to reconcile them.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}
