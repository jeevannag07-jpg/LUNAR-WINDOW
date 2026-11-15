/**
 * LUNAR WINDOW — Strongly Typed Backend API Client
 * Interfaces with FastAPI endpoints at /api/v1/... and system health probes.
 * Strictly adheres to verified endpoint structures:
 * - GET /health
 * - GET /ready
 * - GET /
 * - POST /api/v1/analysis/visibility
 * - POST /api/v1/analysis/terrain/profile
 * - POST /api/v1/analysis/compare
 */

import type {
  HealthResponse,
  MissionVisibilityRequest,
  MissionVisibilityResponse,
  ReadinessResponse,
  RootResponse,
  SiteComparisonRequest,
  SiteComparisonResponse,
  TerrainProfileRequest,
  TerrainProfileResponse,
} from '../types/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public detail?: unknown,
  ) {
    super(`API Error ${status} (${statusText}): ${typeof detail === 'object' ? JSON.stringify(detail) : String(detail)}`);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(newBaseUrl: string): void {
    this.baseUrl = newBaseUrl.replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        throw new ApiError(response.status, response.statusText, errorData);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error(`Network failure connecting to LUNAR WINDOW backend at ${url}: ${(err as Error).message}`);
    }
  }

  /** Liveness health probe at /health */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  /** Operational readiness probe at /ready */
  async getReady(): Promise<ReadinessResponse> {
    const res = await this.request<ReadinessResponse>('/ready');
    // Normalize services vs service_status
    if (res.services && !res.service_status) {
      res.service_status = res.services;
    }
    return res;
  }

  /** Project information metadata at / */
  async getRoot(): Promise<RootResponse> {
    return this.request<RootResponse>('/');
  }

  /**
   * Evaluate mission visibility across time.
   * Endpoint: POST /api/v1/analysis/visibility
   */
  async evaluateVisibility(request: MissionVisibilityRequest): Promise<MissionVisibilityResponse> {
    return this.request<MissionVisibilityResponse>('/api/v1/analysis/visibility', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Generate 360-degree topographic horizon profile.
   * Endpoint: POST /api/v1/analysis/terrain/profile
   */
  async getTerrainProfile(request: TerrainProfileRequest): Promise<TerrainProfileResponse> {
    return this.request<TerrainProfileResponse>('/api/v1/analysis/terrain/profile', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Compare and rank candidate lunar exploration sites.
   * Endpoint: POST /api/v1/analysis/compare
   */
  async compareSites(request: SiteComparisonRequest): Promise<SiteComparisonResponse> {
    return this.request<SiteComparisonResponse>('/api/v1/analysis/compare', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const apiClient = new ApiClient();
