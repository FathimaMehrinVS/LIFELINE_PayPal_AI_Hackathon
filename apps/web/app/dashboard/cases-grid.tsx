"use client";

import type { Urgency } from "@lifeline/contracts";
import {
  AllCommunityModule,
  type ColDef,
  type ICellRendererParams,
  type IRowNode,
  ModuleRegistry,
  type RowClassParams,
  type RowStyle,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo } from "react";
import { type CaseRow, STATUS_LABELS, URGENCY_RANK, formatMoney, recommendedRoute, routeName } from "./case-row";

// Owner: Member 1. NGO case grid (AG Grid Community).

ModuleRegistry.registerModules([AllCommunityModule]);

// The LIFELINE theme colours (see app/globals.css), passed to AG Grid's Quartz theme.
const theme = themeQuartz.withParams({
  accentColor: "#1C4FA8",
  backgroundColor: "#FFFFFF",
  foregroundColor: "#0F2547",
  borderColor: "#DCE4EE",
  fontFamily: "inherit",
  headerBackgroundColor: "#EAF0F7",
  headerTextColor: "#0F2547",
  headerFontWeight: 600,
  rowHoverColor: "#EEF4FC",
  selectedRowBackgroundColor: "#D9E6F8",
  rowHeight: 52,
  headerHeight: 44,
  wrapperBorderRadius: 16,
});

export type StatusFilter = "all" | "complete" | "needs_information" | "no_usable_route";

/** Dot colour and text colour per urgency: red only for critical. */
const URGENCY_STYLES: Record<Urgency, { dot: string; text: string }> = {
  low: { dot: "bg-slate-400", text: "text-slate-600" },
  medium: { dot: "bg-indigo-500", text: "text-indigo-700" },
  high: { dot: "bg-amber-400", text: "text-amber-700" },
  critical: { dot: "bg-red-500", text: "text-red-600" },
};

/** Short labels for the grid; the filter buttons use the full STATUS_LABELS. */
const SHORT_STATUS: Record<CaseRow["case"]["status"], string> = {
  complete: "Ready",
  needs_information: "Needs info",
  no_usable_route: "No route",
};

const STATUS_STYLES: Record<CaseRow["case"]["status"], string> = {
  complete: "bg-emerald-100 text-emerald-800",
  needs_information: "bg-amber-100 text-amber-800",
  no_usable_route: "bg-red-100 text-red-800",
};

function UrgencyCell({ value }: ICellRendererParams<CaseRow, Urgency>) {
  if (!value) return null;
  const style = URGENCY_STYLES[value];
  return (
    <span className={`flex h-full items-center gap-2 text-sm font-semibold capitalize ${style.text}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {value}
    </span>
  );
}

function StatusCell({ data }: ICellRendererParams<CaseRow>) {
  if (!data) return null;
  const { status, missing_information } = data.case;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
      title={missing_information.length > 0 ? `Waiting for: ${missing_information.join(", ")}` : undefined}
    >
      {SHORT_STATUS[status]}
    </span>
  );
}

function NeedsCell({ data }: ICellRendererParams<CaseRow>) {
  return (
    <span className="flex h-full flex-wrap content-center items-center gap-1">
      {data?.case.situation.needs.map((need) => (
        <span key={need} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium capitalize text-sky-800 ring-1 ring-sky-100">
          {need.replace("_", " ")}
        </span>
      ))}
    </span>
  );
}

interface ApprovalCellProps extends ICellRendererParams<CaseRow> {
  onApprove: (row: CaseRow) => void;
}

function ApprovalCell({ data, onApprove }: ApprovalCellProps) {
  if (!data) return null;
  const { approval } = data;
  if (approval?.state === "approved") {
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">✓ Approved</span>;
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
        className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:bg-slate-300"
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

/** Coloured left edge by urgency, so critical cases stand out while scrolling. */
function getRowStyle({ data }: RowClassParams<CaseRow>): RowStyle | undefined {
  const urgency = data?.case.situation.urgency;
  if (urgency === "critical") return { backgroundColor: "#FDF1F0", boxShadow: "inset 4px 0 0 #D64545" };
  if (urgency === "high") return { boxShadow: "inset 4px 0 0 #E8A33D" };
  return undefined;
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
        headerName: "Urgency",
        colId: "urgency",
        valueGetter: (p) => p.data?.case.situation.urgency,
        cellRenderer: UrgencyCell,
        comparator: (a: Urgency, b: Urgency) => URGENCY_RANK[a] - URGENCY_RANK[b],
        sort: "desc",
        pinned: "left",
        width: 118,
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
    (node: IRowNode<CaseRow>) => node.data?.case.status === statusFilter,
    [statusFilter],
  );

  return (
    <AgGridReact<CaseRow>
      theme={theme}
      rowData={rows}
      columnDefs={columnDefs}
      defaultColDef={{ sortable: true, resizable: true }}
      getRowId={(p) => p.data.case.case_id}
      getRowStyle={getRowStyle}
      quickFilterText={quickFilter}
      isExternalFilterPresent={isExternalFilterPresent}
      doesExternalFilterPass={doesExternalFilterPass}
      onRowClicked={(e) => e.data && onSelect(e.data)}
      rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
      rowHeight={48}
      tooltipShowDelay={300}
      domLayout="autoHeight"
      overlayNoRowsTemplate="No cases yet. Analyse a situation to create one."
    />
  );
}
