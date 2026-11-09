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
import { type CaseRow, STATUS_LABELS, caseRef, URGENCY_RANK, formatMoney, recommendedRoute, routeName } from "./case-row";

// Owner: Member 1. NGO case grid (AG Grid Community).

ModuleRegistry.registerModules([AllCommunityModule]);

// The LIFELINE theme colours (see app/globals.css), passed to AG Grid's Quartz theme.
const theme = themeQuartz.withParams({
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

function StatusCell({ data }: ICellRendererParams<CaseRow>) {
  if (!data) return null;
  const { status, missing_information } = data.case;
  return <span title={missing_information.length > 0 ? `Waiting for: ${missing_information.join(", ")}` : undefined}><Badge tone={STATUS_TONE[status]}>{SHORT_STATUS[status]}</Badge></span>;
}

function NeedsCell({ data }: ICellRendererParams<CaseRow>) {
  return <span className="capitalize text-slate-600">{data?.case.situation.needs.map((need) => need.replace("_", " ")).join(", ")}</span>;
}

interface ApprovalCellProps extends ICellRendererParams<CaseRow> {
  onApprove: (row: CaseRow) => void;
}

function ApprovalCell({ data, onApprove }: ApprovalCellProps) {
  if (!data) return null;
  const { approval } = data;
  if (approval?.state === "approved") {
    if (approval.result.status === "disbursed") {
      return <span className="rounded-full border border-dashed border-simulated bg-simulated-tint px-3 py-1 text-xs font-semibold text-simulated" title="Simulated demo disbursement; no money was transferred">Demo disbursed</span>;
    }
    return <Badge tone="success">✓ Approved</Badge>;
  }
  if (data.case.status !== "complete") return <span className="text-xs text-slate-400">Not ready</span>;
  return (
    <span className="flex h-full items-center gap-2">
      <button
        type="button"
        disabled={approval?.state === "pending"}
        onClick={(event) => {
          event.stopPropagation();
          onApprove(data);
        }}
        className="rounded-lg bg-navy px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {approval?.state === "pending" ? "Approving…" : approval?.state === "error" ? "Retry" : "Approve"}
      </button>
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
  onApprove: (row: CaseRow) => void;
  onSelect: (row: CaseRow) => void;
}

export function CasesGrid({ rows, quickFilter, statusFilter, onApprove, onSelect }: CasesGridProps) {
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
        headerName: "Situation",
        colId: "summary",
        valueGetter: (p) => p.data?.case.situation.summary,
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
        headerName: "Approval",
        headerTooltip: "NGO approval",
        colId: "approval",
        cellRenderer: ApprovalCell,
        cellRendererParams: { onApprove },
        sortable: false,
        pinned: "right",
        width: 125,
      },
    ],
    [onApprove],
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
      theme={theme}
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
      overlayNoRowsTemplate="No cases yet. Use New case to record one."
    />
  );
}
