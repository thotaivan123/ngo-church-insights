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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  userId?: string;
};

type ChurchInput = Omit<Church, "churchId" | "createdAt" | "updatedAt">;
type PastorInput = Omit<Pastor, "pastorId" | "churchId">;
type MemberInput = Omit<Member, "memberId" | "churchId">;

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.userId ? { "x-demo-user-id": options.userId } : {}),
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
  getMe: (userId: string) => request<UserProfile>("/me", { userId }),
  getDashboardOverview: (filters: DashboardFilters, userId: string) => request<DashboardOverview>(`/dashboard/overview${createSearchParams(filters)}`, { userId }),
  getChurches: (filters: DashboardFilters, userId: string) => request<ChurchListItem[]>(`/churches${createSearchParams(filters)}`, { userId }),
  getChurchDetail: (churchId: string, userId: string) => request<ChurchDetailResponse>(`/churches/${churchId}`, { userId }),
  updateChurch: (churchId: string, payload: Partial<ChurchInput>, userId: string) => request<Church>(`/churches/${churchId}`, { method: "PUT", body: payload, userId }),
  createPastor: (churchId: string, payload: PastorInput, userId: string) => request<Pastor>(`/churches/${churchId}/pastors`, { method: "POST", body: payload, userId }),
  updatePastor: (pastorId: string, payload: Partial<PastorInput>, userId: string) => request<Pastor>(`/pastors/${pastorId}`, { method: "PUT", body: payload, userId }),
  createMember: (churchId: string, payload: MemberInput, userId: string) => request<Member>(`/churches/${churchId}/members`, { method: "POST", body: payload, userId }),
  updateMember: (memberId: string, payload: Partial<MemberInput>, userId: string) => request<Member>(`/members/${memberId}`, { method: "PUT", body: payload, userId }),
  getInsightSummary: (filters: DashboardFilters, userId: string) => request<InsightSummary>("/insights/summary", { method: "POST", body: { filters }, userId }),
};
