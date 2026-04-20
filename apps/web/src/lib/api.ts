import type {
  Church,
  ChurchDetailResponse,
  ChurchListItem,
  DashboardFilters,
  DashboardOverview,
  InsightSummary,
  Member,
  Pastor,
  UserProfile,
} from "@ngo/shared";

import type { AuthSession } from "@/auth/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  session?: AuthSession;
};

type ChurchInput = Omit<Church, "churchId" | "createdAt" | "updatedAt">;
type PastorInput = Omit<Pastor, "pastorId" | "churchId">;
type MemberInput = Omit<Member, "memberId" | "churchId">;

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.session?.mode === "demo" ? { "x-demo-user-id": options.session.userId } : {}),
      ...(options.session?.mode === "cognito" ? { Authorization: `Bearer ${options.session.idToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorBody.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
};

const createSearchParams = (filters: DashboardFilters): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const search = params.toString();
  return search ? `?${search}` : "";
};

export const api = {
  getMe: (session: AuthSession) => request<UserProfile>("/me", { session }),
  getDashboardOverview: (filters: DashboardFilters, session: AuthSession) => request<DashboardOverview>(`/dashboard/overview${createSearchParams(filters)}`, { session }),
  getChurches: (filters: DashboardFilters, session: AuthSession) => request<ChurchListItem[]>(`/churches${createSearchParams(filters)}`, { session }),
  getChurchDetail: (churchId: string, session: AuthSession) => request<ChurchDetailResponse>(`/churches/${churchId}`, { session }),
  updateChurch: (churchId: string, payload: Partial<ChurchInput>, session: AuthSession) => request<Church>(`/churches/${churchId}`, { method: "PUT", body: payload, session }),
  createPastor: (churchId: string, payload: PastorInput, session: AuthSession) => request<Pastor>(`/churches/${churchId}/pastors`, { method: "POST", body: payload, session }),
  updatePastor: (pastorId: string, payload: Partial<PastorInput>, session: AuthSession) => request<Pastor>(`/pastors/${pastorId}`, { method: "PUT", body: payload, session }),
  createMember: (churchId: string, payload: MemberInput, session: AuthSession) => request<Member>(`/churches/${churchId}/members`, { method: "POST", body: payload, session }),
  updateMember: (memberId: string, payload: Partial<MemberInput>, session: AuthSession) => request<Member>(`/members/${memberId}`, { method: "PUT", body: payload, session }),
  getInsightSummary: (filters: DashboardFilters, session: AuthSession) => request<InsightSummary>("/insights/summary", { method: "POST", body: { filters }, session }),
};
