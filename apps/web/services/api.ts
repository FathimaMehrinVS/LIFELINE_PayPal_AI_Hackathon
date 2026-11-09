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
  role: "NGO" | "DONOR" | "PARTNER";
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

async function request<TResponse>(method: "GET" | "POST", path: string, body?: unknown, accessToken?: string): Promise<TResponse> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = accessToken ?? (typeof window !== "undefined"
    ? (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token
    : undefined);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new ApiRequestError(res.status, json as ApiError);
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
  verifyDelivery: (allocationId: string, body: VerifyDeliveryRequest) => post<DeliveryRecord>(`/api/deliveries/${encodeURIComponent(allocationId)}/verify`, body),
  /** With `replaces`, re-runs a case that needed information, keeping its id. */
  createCase: (body: SituationRequest, replaces?: string) =>
    post<CaseResult>(replaces ? `/api/cases?replaces=${encodeURIComponent(replaces)}` : "/api/cases", body),
  listSuppliers: () => get<Supplier[]>("/api/suppliers"),
  getSupplier: (id: string) => get<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}`),
  registerSupplier: (body: CreateSupplierRequestInput) => post<SupplierDetail>("/api/suppliers", body),
  updateSupplierStatus: (id: string, body: UpdateSupplierStatusRequest) => post<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}/status`, body),
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
  provisionAuthProfile: (accessToken: string) => request<AuthProfileProvisionResult>("POST", "/api/auth/profile", undefined, accessToken),
};
