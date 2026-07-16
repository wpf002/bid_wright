import type { BidStatus, ExtractionResult, BidLineItem } from "@bidwright/shared";

/**
 * Typed client for the BidWright API.
 *
 * Access tokens are short-lived (15m), so a 401 triggers a single refresh
 * against the rotating refresh token and replays the original request. Refresh
 * is de-duplicated: concurrent 401s share one refresh, because the server
 * revokes the whole token family if a rotated token is presented twice.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_KEY = "bw.accessToken";
const REFRESH_KEY = "bw.refreshToken";

export interface PublicUser {
  id: string;
  email: string;
  companyName: string | null;
}

/** A bid row as stored by the API (jsonb columns come back parsed). */
export interface BidRow {
  id: string;
  userId: string;
  itbFileName: string;
  projectName: string | null;
  gcName: string | null;
  ownerName: string | null;
  bidDeadline: string | null;
  primaryTrade: string | null;
  status: BidStatus;
  extraction: ExtractionResult;
  lineItems: BidLineItem[];
  assumptions: string[];
  clarifications: string[];
  exclusions: string[];
  subtotalCents: number;
  overheadPercent: number;
  profitPercent: number;
  totalCents: number;
  validityDays: number;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- token storage -------------------------------------------------------
// localStorage keeps the session across refreshes. It's readable by XSS, which
// is the accepted trade-off until httpOnly cookies land alongside CSRF
// protection; the short access-token TTL limits the blast radius.

export const tokens = {
  get access() {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** In-flight refresh, shared so concurrent 401s don't each rotate the token. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    tokens.clear();
    return false;
  }
  const body = await res.json();
  tokens.set(body.token, body.refreshToken);
  return true;
}

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= refreshSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const access = tokens.access;
  const headers = new Headers(init.headers);
  if (access) headers.set("authorization", `Bearer ${access}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const ok = await refreshOnce();
    if (ok) return request<T>(path, init, false);
  }

  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => (typeof b.error === "string" ? b.error : `Request failed (${res.status})`))
      .catch(() => `Request failed (${res.status})`);
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- endpoints -----------------------------------------------------------

export const api = {
  async register(input: {
    email: string;
    password: string;
    companyName?: string;
  }): Promise<PublicUser> {
    const body = await request<{ token: string; refreshToken: string; user: PublicUser }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(input) },
    );
    tokens.set(body.token, body.refreshToken);
    return body.user;
  },

  async login(email: string, password: string): Promise<PublicUser> {
    const body = await request<{ token: string; refreshToken: string; user: PublicUser }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    tokens.set(body.token, body.refreshToken);
    return body.user;
  },

  async logout(): Promise<void> {
    const refreshToken = tokens.refresh;
    if (refreshToken) {
      await request<void>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }
    tokens.clear();
  },

  me: () => request<PublicUser>("/api/auth/me"),

  listBids: () => request<BidRow[]>("/api/bids"),

  getBid: (id: string) => request<BidRow>(`/api/bids/${id}`),

  updateBid: (id: string, patch: Partial<BidRow>) =>
    request<BidRow>(`/api/bids/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteBid: (id: string) => request<void>(`/api/bids/${id}`, { method: "DELETE" }),

  async uploadItb(file: File): Promise<BidRow> {
    const form = new FormData();
    form.append("file", file);
    return request<BidRow>("/api/uploads/itb", { method: "POST", body: form });
  },
};
