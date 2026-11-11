"use client";

import type { Urgency } from "@lifeline/contracts";
import {
  AllCommunityModule,
  type ColDef,
  type ICellRendererParams,
  type IRowNode,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo } from "react";
import { Badge, type BadgeTone } from "@/components/ui";
import type { Supplier } from "@lifeline/contracts";
import type { RiskLevel } from "@lifeline/contracts";
import { type CaseRow, STATUS_LABELS, caseRef, fundingState, URGENCY_RANK, formatMoney, recommendedRoute, routeName } from "./case-row";

// Owner: Member 1. NGO case grid (AG Grid Community).

ModuleRegistry.registerModules([AllCommunityModule]);

// The LIFELINE theme colours (see app/globals.css), passed to AG Grid's Quartz theme.
export const lifelineGridTheme = themeQuartz.withParams({
  accentColor: "#159B91",
  backgroundColor: "#FFFFFF",
  foregroundColor: "#142D4E",
  borderColor: "#E1E7EF",
  fontFamily: "inherit",
  headerBackgroundColor: "#F7F9FC",
  headerTextColor: "#4F5F73",
  headerFontWeight: 600,
  rowHoverColor: "#EEF7F6",
  selectedRowBackgroundColor: "#E3F2F0",
  rowHeight: 52,
  headerHeight: 44,
  wrapperBorderRadius: 16,
});

export type StatusFilter = "all" | "urgent" | "complete" | "needs_information" | "no_usable_route";

const URGENCY_TONE: Record<Urgency, BadgeTone> = { critical: "critical", high: "warning", medium: "info", low: "neutral" };

/** Short labels for the grid; the filter buttons use the full STATUS_LABELS. */
const SHORT_STATUS: Record<CaseRow["case"]["status"], string> = {
  complete: "Ready",
  needs_information: "Needs info",
  no_usable_route: "No route",
};

const STATUS_TONE: Record<CaseRow["case"]["status"], BadgeTone> = { complete: "success", needs_information: "warning", no_usable_route: "critical" };

function CaseIdCell({ data }: ICellRendererParams<CaseRow>) {
  return data ? <span className="font-mono text-[13px] font-bold text-teal-text">{caseRef(data.case.case_id)}</span> : null;
}

function UrgencyCell({ value }: ICellRendererParams<CaseRow, Urgency>) {
  return value ? <Badge tone={URGENCY_TONE[value]} className="capitalize">{value}</Badge> : null;
}

function RiskCell({ value }: ICellRendererParams<CaseRow, RiskLevel>) {
  const level = value ?? "NORMAL";
  const tone: BadgeTone = level === "HIGH_RISK" ? "critical" : level === "URGENT" ? "warning" : "neutral";
  const label = level === "HIGH_RISK" ? "High risk" : level === "URGENT" ? "Urgent" : "Normal";
  return <Badge tone={tone}>{label}</Badge>;
}

function StatusCell({ data }: ICellRendererParams<CaseRow>) {
  if (!data) return null;
  const { status, missing_information } = data.case;
  return <span title={missing_information.length > 0 ? `Waiting for: ${missing_information.join(", ")}` : undefined}><Badge tone={STATUS_TONE[status]}>{SHORT_STATUS[status]}</Badge></span>;
}

function FundingCell({ data }: ICellRendererParams<CaseRow>) {
  const funding = data && fundingState(data.case);
  if (!data || !funding) return <span className="text-slate-500">—</span>;
  const allocation = data.case.operations!.allocation!;
  return <span title={`${formatMoney(funding.captured, allocation.currency)} captured of ${formatMoney(allocation.amount, allocation.currency)}`}><Badge tone={funding.tone}>{funding.label}</Badge></span>;
}

function SupplierPaymentCell({ data }: ICellRendererParams<CaseRow>) {
  if (data?.disbursement?.state === "complete") {
    return data.disbursement.result.mode === "simulated" ? <Badge tone="simulated">Simulated</Badge> : <Badge tone="success">Paid</Badge>;
  }
  return data?.approval?.state === "approved" ? <Badge tone="neutral">Not paid</Badge> : <span className="text-slate-500">—</span>;
}

function NeedsCell({ data }: ICellRendererParams<CaseRow>) {
  return <span className="capitalize text-slate-600">{data?.case.situation.needs.map((need) => need.replace("_", " ")).join(", ")}</span>;
}

const DELIVERY: Record<string, { label: string; tone: BadgeTone }> = {
  awaiting_acceptance: { label: "Awaiting supplier", tone: "neutral" },
  accepted: { label: "Accepted", tone: "info" },
  preparing: { label: "Preparing", tone: "info" },
  ready: { label: "Ready", tone: "info" },
  dispatched: { label: "Dispatched", tone: "info" },
  handed_over: { label: "Handed over", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  recipient_confirmed: { label: "Delivered", tone: "success" },
  issue_reported: { label: "Problem reported", tone: "critical" },
};

function SupplierCell({ value }: ICellRendererParams<CaseRow>) {
  return value ? <span className="flex h-full items-center"><span className="line-clamp-2 whitespace-normal leading-snug text-navy">{value}</span></span> : <span className="text-slate-500">—</span>;
}

function DeliveryCell({ value }: ICellRendererParams<CaseRow>) {
  const state = value ? DELIVERY[value as string] : undefined;
  return state ? <Badge tone={state.tone}>{state.label}</Badge> : <span className="text-slate-500">—</span>;
}

interface ApprovalCellProps extends ICellRendererParams<CaseRow> {
  suppliers: Supplier[];
  supplierChoices: Record<string, string>;
  onChooseSupplier: (caseId: string, supplierId: string) => void;
  onApprove: (row: CaseRow, supplierId: string) => void;
}

function ApprovalCell({ data, suppliers, supplierChoices, onChooseSupplier, onApprove }: ApprovalCellProps) {
  if (!data) return null;
  const { approval } = data;
  if (approval?.state === "approved") {
    if (approval.result.status === "disbursed") {
      return <span className="rounded-full border border-dashed border-simulated bg-simulated-tint px-3 py-1 text-xs font-semibold text-simulated" title="Simulated demo disbursement; no money was transferred">Demo disbursed</span>;
    }
    return <Badge tone="success">✓ Approved</Badge>;
  }
  if (data.case.status !== "complete") return <span className="text-xs text-slate-500">Not ready</span>;
  // The purchase order goes to the supplier the basket's items come from.
  const basketSuppliers = new Set(data.case.commerce?.items.map((item) => item.merchant_id) ?? []);
  const approvedSuppliers = suppliers.filter((supplier) => supplier.status === "approved" && (basketSuppliers.size === 0 || basketSuppliers.has(supplier.supplier_id)));
  const selectedSupplier = supplierChoices[data.case.case_id] ?? (approvedSuppliers.length === 1 ? approvedSuppliers[0]!.supplier_id : "");
  return (
    <span className="flex h-full min-w-64 items-center gap-2">
      <select
        aria-label={`Supplier for ${caseRef(data.case.case_id)}`}
        value={selectedSupplier}
        disabled={approvedSuppliers.length === 0}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChooseSupplier(data.case.case_id, event.target.value)}
        className="max-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-navy disabled:bg-slate-100"
      >
        <option value="">Choose supplier</option>
        {approvedSuppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
      </select>
      <button
        type="button"
        disabled={approval?.state === "pending" || !selectedSupplier}
        onClick={(event) => {
          event.stopPropagation();
          onApprove(data, selectedSupplier);
        }}
        className="rounded-lg bg-navy px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {approval?.state === "pending" ? "Approving…" : approval?.state === "error" ? "Retry" : "Approve"}
      </button>
      {approvedSuppliers.length === 0 && <span className="text-xs text-slate-500" title="Approve the basket's supplier on the Suppliers page first">Basket supplier not approved</span>}
      {approval?.state === "error" && (
        <span className="truncate text-xs text-red-700" title={approval.message}>
          {approval.message}
        </span>
      )}
    </span>
  );
}

interface CasesGridProps {
  rows: CaseRow[];
  quickFilter: string;
  statusFilter: StatusFilter;
  suppliers: Supplier[];
  supplierChoices: Record<string, string>;
  onChooseSupplier: (caseId: string, supplierId: string) => void;
  onApprove: (row: CaseRow, supplierId: string) => void;
  onSelect: (row: CaseRow) => void;
  onVisibleCount: (count: number) => void;
}

function SituationCell({ value }: ICellRendererParams<CaseRow>) {
  return <span className="flex h-full items-center"><span className="line-clamp-2 whitespace-normal leading-snug">{value}</span></span>;
}

export function CasesGrid({ rows, quickFilter, statusFilter, suppliers, supplierChoices, onChooseSupplier, onApprove, onSelect, onVisibleCount }: CasesGridProps) {
  const columnDefs = useMemo<ColDef<CaseRow>[]>(
    () => [
      {
        headerName: "Case ID",
        colId: "caseId",
        valueGetter: (p) => (p.data ? caseRef(p.data.case.case_id) : ""),
        cellRenderer: CaseIdCell,
        pinned: "left",
        width: 128,
      },
      {
        headerName: "Urgency",
        colId: "urgency",
        valueGetter: (p) => p.data?.case.situation.urgency,
        cellRenderer: UrgencyCell,
        comparator: (a: Urgency, b: Urgency) => URGENCY_RANK[a] - URGENCY_RANK[b],
        sort: "desc",
        width: 128,
      },
      {
        headerName: "Risk",
        colId: "risk",
        valueGetter: (p) => p.data?.case.risk_level ?? "NORMAL",
        cellRenderer: RiskCell,
        width: 112,
      },
      {
        headerName: "Situation",
        colId: "summary",
        valueGetter: (p) => p.data?.case.situation.summary,
        cellRenderer: SituationCell,
        tooltipValueGetter: (p) => p.value,
        flex: 1,
        minWidth: 130,
      },
      {
        headerName: "Needs",
        colId: "needs",
        valueGetter: (p) => p.data?.case.situation.needs.join(" "),
        cellRenderer: NeedsCell,
        width: 152,
      },
      {
        headerName: "Location",
        colId: "location",
        valueGetter: (p) => p.data?.case.situation.location ?? "",
        filter: "agTextColumnFilter",
        width: 115,
      },
      {
        headerName: "Status",
        colId: "status",
        valueGetter: (p) => (p.data ? STATUS_LABELS[p.data.case.status] : ""),
        cellRenderer: StatusCell,
        width: 122,
      },
      {
        headerName: "Route",
        colId: "route",
        valueGetter: (p) => {
          const route = p.data && recommendedRoute(p.data.case);
          return route ? routeName(route.route_id) : "";
        },
        width: 90,
      },
      {
        headerName: "Sent",
        colId: "sent",
        type: "rightAligned",
        valueGetter: (p) => p.data?.case.situation.budget,
        valueFormatter: (p) => formatMoney(p.value, p.data?.case.situation.currency),
        filter: "agNumberColumnFilter",
        width: 92,
      },
      {
        headerName: "Usable",
        colId: "usable",
        headerTooltip: "What arrives after the route's fees",
        type: "rightAligned",
        valueGetter: (p) => (p.data ? recommendedRoute(p.data.case)?.usable_value : undefined),
        valueFormatter: (p) => formatMoney(p.value, p.data?.case.finance?.currency),
        width: 92,
      },
      {
        headerName: "Basket",
        colId: "basket",
        type: "rightAligned",
        valueGetter: (p) => p.data?.case.commerce?.total,
        valueFormatter: (p) => formatMoney(p.value, p.data?.case.commerce?.currency),
        width: 92,
      },
      {
        headerName: "Supplier",
        colId: "supplier",
        valueGetter: (p) => p.data?.case.operations?.delivery?.merchant_name ?? "",
        cellRenderer: SupplierCell,
        tooltipValueGetter: (p) => p.value,
        width: 150,
      },
      {
        headerName: "Delivery",
        colId: "delivery",
        headerTooltip: "Only recorded delivery steps",
        valueGetter: (p) => p.data?.case.operations?.delivery?.fulfilment_status ?? "",
        cellRenderer: DeliveryCell,
        width: 140,
      },
      {
        headerName: "Funding",
        colId: "funding",
        valueGetter: (p) => (p.data ? fundingState(p.data.case)?.label ?? "" : ""),
        cellRenderer: FundingCell,
        width: 125,
      },
      {
        headerName: "Supplier payment",
        colId: "payment",
        headerTooltip: "Recorded separately from donations",
        valueGetter: (p) => (p.data?.disbursement?.state === "complete" ? p.data.disbursement.result.mode : ""),
        cellRenderer: SupplierPaymentCell,
        width: 140,
      },
      {
        headerName: "Approval",
        headerTooltip: "NGO approval",
        colId: "approval",
        cellRenderer: ApprovalCell,
        cellRendererParams: { suppliers, supplierChoices, onChooseSupplier, onApprove },
        sortable: false,
        pinned: "right",
        width: 280,
      },
    ],
    [suppliers, supplierChoices, onChooseSupplier, onApprove],
  );

  const isExternalFilterPresent = useCallback(() => statusFilter !== "all", [statusFilter]);
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<CaseRow>) =>
      statusFilter === "urgent"
        ? node.data?.case.situation.urgency === "high" || node.data?.case.situation.urgency === "critical"
        : node.data?.case.status === statusFilter,
    [statusFilter],
  );

  return (
    <AgGridReact<CaseRow>
      theme={lifelineGridTheme}
      rowData={rows}
      columnDefs={columnDefs}
      defaultColDef={{ sortable: true, resizable: true }}
      getRowId={(p) => p.data.case.case_id}
      quickFilterText={quickFilter}
      isExternalFilterPresent={isExternalFilterPresent}
      doesExternalFilterPass={doesExternalFilterPass}
      onRowClicked={(e) => e.data && onSelect(e.data)}
      rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
      rowHeight={56}
      tooltipShowDelay={300}
      domLayout="autoHeight"
      suppressNoRowsOverlay
      onModelUpdated={(event) => onVisibleCount(event.api.getDisplayedRowCount())}
    />
  );
}
