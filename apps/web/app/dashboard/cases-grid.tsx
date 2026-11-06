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

const theme = themeQuartz.withParams({
  accentColor: "#4f46e5",
  fontFamily: "inherit",
  headerBackgroundColor: "#f8fafc",
  headerFontWeight: 600,
  rowHoverColor: "#eef2ff",
  selectedRowBackgroundColor: "#e0e7ff",
  wrapperBorderRadius: 8,
});

export type StatusFilter = "all" | "complete" | "needs_information" | "no_usable_route";

const URGENCY_STYLES: Record<Urgency, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-900",
  critical: "bg-red-600 text-white",
};

/** Short labels for the grid; the filter buttons use the full STATUS_LABELS. */
const SHORT_STATUS: Record<CaseRow["case"]["status"], string> = {
  complete: "Ready",
  needs_information: "Needs info",
  no_usable_route: "No route",
};

const STATUS_STYLES: Record<CaseRow["case"]["status"], string> = {
  complete: "bg-emerald-100 text-emerald-800",
  needs_information: "bg-amber-100 text-amber-900",
  no_usable_route: "bg-red-100 text-red-800",
};

function UrgencyCell({ value }: ICellRendererParams<CaseRow, Urgency>) {
  if (!value) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${URGENCY_STYLES[value]}`}>{value}</span>;
}

function StatusCell({ data }: ICellRendererParams<CaseRow>) {
  if (!data) return null;
  const { status, missing_information } = data.case;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
      title={missing_information.length > 0 ? `Waiting for: ${missing_information.join(", ")}` : undefined}
    >
      {SHORT_STATUS[status]}
      {missing_information.length > 0 && ` (${missing_information.length})`}
    </span>
  );
}

function NeedsCell({ data }: ICellRendererParams<CaseRow>) {
  return (
    <span className="flex h-full flex-wrap content-center items-center gap-1">
      {data?.case.situation.needs.map((need) => (
        <span key={need} className="rounded bg-indigo-50 px-1.5 text-xs text-indigo-800">
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
    return <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Approved</span>;
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
        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
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
  if (urgency === "critical") return { backgroundColor: "#fef2f2", boxShadow: "inset 4px 0 0 #dc2626" };
  if (urgency === "high") return { boxShadow: "inset 4px 0 0 #f59e0b" };
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
        width: 115,
      },
      {
        headerName: "Situation",
        colId: "summary",
        valueGetter: (p) => p.data?.case.situation.summary,
        tooltipValueGetter: (p) => p.value,
        flex: 1,
        minWidth: 180,
      },
      {
        headerName: "Needs",
        colId: "needs",
        valueGetter: (p) => p.data?.case.situation.needs.join(" "),
        cellRenderer: NeedsCell,
        minWidth: 140,
      },
      {
        headerName: "Location",
        colId: "location",
        valueGetter: (p) => p.data?.case.situation.location ?? "",
        filter: "agTextColumnFilter",
        minWidth: 140,
      },
      {
        headerName: "Status",
        colId: "status",
        valueGetter: (p) => (p.data ? STATUS_LABELS[p.data.case.status] : ""),
        cellRenderer: StatusCell,
        width: 135,
      },
      {
        headerName: "Route",
        colId: "route",
        valueGetter: (p) => {
          const route = p.data && recommendedRoute(p.data.case);
          return route ? routeName(route.route_id) : "";
        },
        width: 100,
      },
      {
        headerName: "Sent",
        colId: "sent",
        type: "rightAligned",
        valueGetter: (p) => p.data?.case.situation.budget,
        valueFormatter: (p) => formatMoney(p.value, p.data?.case.situation.currency),
        filter: "agNumberColumnFilter",
        width: 100,
      },
      {
        headerName: "Usable",
        colId: "usable",
        headerTooltip: "What arrives after the route's fees",
        type: "rightAligned",
        valueGetter: (p) => (p.data ? recommendedRoute(p.data.case)?.usable_value : undefined),
        valueFormatter: (p) => formatMoney(p.value, p.data?.case.finance?.currency),
        width: 100,
      },
      {
        headerName: "Basket",
        colId: "basket",
        type: "rightAligned",
        valueGetter: (p) => p.data?.case.commerce?.total,
        valueFormatter: (p) => formatMoney(p.value, p.data?.case.commerce?.currency),
        width: 100,
      },
      {
        headerName: "NGO approval",
        colId: "approval",
        cellRenderer: ApprovalCell,
        cellRendererParams: { onApprove },
        sortable: false,
        pinned: "right",
        width: 165,
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
