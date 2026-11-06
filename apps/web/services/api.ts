import type {
  ApiError,
  CommerceRequest,
  CommerceResult,
  CreatePaymentRequest,
  FinanceRequest,
  FinanceResult,
  PaymentResult,
  SituationRequest,
  SituationResult,
} from "@lifeline/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly body: ApiError) {
    super(body.error.message);
  }
}

async function post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new ApiRequestError(res.status, json as ApiError);
  return json as TResponse;
}

export const api = {
  analyzeSituation: (body: SituationRequest) => post<SituationResult>("/api/situation/analyze", body),
  evaluateFinance: (body: FinanceRequest) => post<FinanceResult>("/api/finance/evaluate", body),
  buildBasket: (body: CommerceRequest) => post<CommerceResult>("/api/commerce/basket", body),
  createPayment: (body: CreatePaymentRequest) => post<PaymentResult>("/api/payments", body),
  capturePayment: (paymentId: string) => post<PaymentResult>(`/api/payments/${encodeURIComponent(paymentId)}/capture`),
};
