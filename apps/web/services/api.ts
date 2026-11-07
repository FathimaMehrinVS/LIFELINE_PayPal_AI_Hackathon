import type {
  AllocationResult,
  ApiError,
  ApproveAllocationRequest,
  CaseResult,
  CommerceRequestInput,
  CommerceResult,
  CreateDonationRequest,
  CreatePayoutRequest,
  DonationResult,
  FinanceRequest,
  FinanceResult,
  PayoutResult,
  SituationRequest,
  SituationResult,
} from "@lifeline/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly body: ApiError) {
    super(body.error.message);
  }
}

async function request<TResponse>(method: "GET" | "POST", path: string, body?: unknown): Promise<TResponse> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
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
  /** With `replaces`, re-runs a case that needed information, keeping its id. */
  createCase: (body: SituationRequest, replaces?: string) =>
    post<CaseResult>(replaces ? `/api/cases?replaces=${encodeURIComponent(replaces)}` : "/api/cases", body),
  listCases: () => get<CaseResult[]>("/api/cases"),
  approveAllocation: (body: ApproveAllocationRequest) => post<AllocationResult>("/api/allocations/approve", body),
};
