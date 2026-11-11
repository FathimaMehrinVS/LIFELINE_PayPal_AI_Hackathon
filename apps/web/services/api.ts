import type {
  AllocationResult,
  ApiError,
  ApproveAllocationRequest,
  AuditRecords,
  CaseResult,
  CaseTimelineEntry,
  Contribution,
  CommerceRequestInput,
  CommerceResult,
  CreateSupplierRequestInput,
  CreateDonationRequest,
  CreatePayoutRequest,
  DonorPlan,
  DonorPlanDetail,
  DonationResult,
  AssignDeliveryRequest,
  DeliveryPartner,
  DeliveryRecord,
  SubmitDeliveryEventRequest,
  VerifyDeliveryRequest,
  FinanceRequest,
  FinanceResult,
  Ledger,
  PayoutResult,
  RecordSupplierCheckRequest,
  TeamMember,
  UpdateTeamRoleRequest,
  SituationRequest,
  SituationResult,
  Supplier,
  SupplierDetail,
  UpdateSupplierStatusRequest,
} from "@lifeline/contracts";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AuthProfile {
  id: string;
  email: string;
  role: "ADMIN" | "NGO" | "DONOR" | "PARTNER";
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "NGO" | "DONOR" | "PARTNER" | null;
  created_at: string;
}

export interface AuthProfileProvisionResult {
  id: string;
  email: string;
  role: AuthProfile["role"] | null;
}

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly body: ApiError) {
    super(body.error.message);
  }
}

/** Recent GET results, so moving between pages doesn't refetch the same data. Any change or sign-out clears it. */
const recent = new Map<string, { at: number; value: unknown }>();
const RECENT_MS = 15_000;

export function clearApiCache(): void {
  recent.clear();
}

async function request<TResponse>(method: "GET" | "POST", path: string, body?: unknown, accessToken?: string): Promise<TResponse> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = accessToken ?? (typeof window !== "undefined"
    ? (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token
    : undefined);
  if (token) headers.Authorization = `Bearer ${token}`;
  // Keyed by the account's token too, so one person's data is never shown to another.
  const cacheKey = `${token?.slice(-16) ?? "anonymous"}:${path}`;
  if (method === "GET") {
    const known = recent.get(cacheKey);
    if (known && Date.now() - known.at < RECENT_MS) return structuredClone(known.value) as TResponse;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new ApiRequestError(res.status, json as ApiError);
  if (method === "GET") recent.set(cacheKey, { at: Date.now(), value: structuredClone(json) });
  else recent.clear();
  return json as TResponse;
}

const get = <TResponse>(path: string) => request<TResponse>("GET", path);
const post = <TResponse>(path: string, body?: unknown) => request<TResponse>("POST", path, body);

export const api = {
  analyzeSituation: (body: SituationRequest) => post<SituationResult>("/api/situation/analyze", body),
  evaluateFinance: (body: FinanceRequest) => post<FinanceResult>("/api/finance/evaluate", body),
  buildBasket: (body: CommerceRequestInput) => post<CommerceResult>("/api/commerce/basket", body),
  createDonation: (body: CreateDonationRequest) => post<DonationResult>("/api/payments/donations", body),
  captureDonation: (donationId: string) =>
    post<DonationResult>(`/api/payments/donations/${encodeURIComponent(donationId)}/capture`),
  cancelDonation: (donationId: string) =>
    post<DonationResult>(`/api/payments/donations/${encodeURIComponent(donationId)}/cancel`),
  createPayout: (body: CreatePayoutRequest) => post<PayoutResult>("/api/payments/payouts", body),
  listDeliveries: () => get<DeliveryRecord[]>("/api/deliveries"),
  listDeliveryPartners: () => get<DeliveryPartner[]>("/api/deliveries/partners"),
  assignDelivery: (body: AssignDeliveryRequest) => post<DeliveryRecord>("/api/deliveries", body),
  submitDeliveryEvent: (allocationId: string, body: SubmitDeliveryEventRequest) => post<DeliveryRecord>(`/api/deliveries/${encodeURIComponent(allocationId)}/events`, body),
  issuePickupCode: (allocationId: string) => post<DeliveryRecord>(`/api/deliveries/${encodeURIComponent(allocationId)}/pickup-code`),
  verifyDelivery: (allocationId: string, body: VerifyDeliveryRequest) => post<DeliveryRecord>(`/api/deliveries/${encodeURIComponent(allocationId)}/verify`, body),
  /** With `replaces`, re-runs a case that needed information, keeping its id. */
  createCase: (body: SituationRequest, replaces?: string) =>
    post<CaseResult>(replaces ? `/api/cases?replaces=${encodeURIComponent(replaces)}` : "/api/cases", body),
  listSuppliers: () => get<Supplier[]>("/api/suppliers"),
  getSupplier: (id: string) => get<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}`),
  registerSupplier: (body: CreateSupplierRequestInput) => post<SupplierDetail>("/api/suppliers", body),
  updateSupplierStatus: (id: string, body: UpdateSupplierStatusRequest) => post<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}/status`, body),
  recordSupplierCheck: (id: string, body: RecordSupplierCheckRequest) => post<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}/checks`, body),
  listTeam: () => get<TeamMember[]>("/api/team"),
  changeTeamRole: (id: string, body: UpdateTeamRoleRequest) => post<TeamMember>(`/api/team/${encodeURIComponent(id)}/role`, body),
  listCases: () => get<CaseResult[]>("/api/cases"),
  getRecentActivity: () => get<CaseTimelineEntry[]>("/api/cases/activity"),
  getCaseTimeline: (caseId: string) => get<CaseTimelineEntry[]>(`/api/cases/${encodeURIComponent(caseId)}/timeline`),
  listMyCases: () => get<CaseResult[]>("/api/cases/mine"),
  listPlans: () => get<DonorPlan[]>("/api/plans"),
  getPlan: (id: string) => get<DonorPlanDetail>(`/api/plans/${encodeURIComponent(id)}`),
  listContributions: () => get<Contribution[]>("/api/plans/contributions"),
  getLedger: () => get<Ledger>("/api/records/ledger"),
  getAuditRecords: () => get<AuditRecords>("/api/records/audit"),
  approveAllocation: (body: ApproveAllocationRequest) => post<AllocationResult>("/api/allocations/approve", body),
  getAuthProfile: (accessToken: string) => request<AuthProfile>("GET", "/api/auth/me", undefined, accessToken),
  listAdminUsers: () => get<AdminUser[]>("/api/admin/users"),
  setUserRole: (id: string, role: NonNullable<AdminUser["role"]>) => post<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/role`, { role }),
  provisionAuthProfile: (accessToken: string) => request<AuthProfileProvisionResult>("POST", "/api/auth/profile", undefined, accessToken),
};
