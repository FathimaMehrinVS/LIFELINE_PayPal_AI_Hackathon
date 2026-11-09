"use client";

import { SUPPLIER_CHECK_LABELS, type SupplierCheck, type SupplierCheckKey, type SupplierCheckState, type SupplierDetail } from "@lifeline/contracts";
import { useState } from "react";
import { Badge, type BadgeTone, Card, Choice, FieldError, button, fieldClass, fieldErrorClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { shortDate } from "../supplier-format";

// Owner: Member 1. Styled from "LIFELINE Screen Designs" page 15. Each result is saved to the audit log.

const STATE: Record<SupplierCheckState, { label: string; tone: BadgeTone }> = {
  not_checked: { label: "Not Checked", tone: "neutral" },
  in_review: { label: "In Review", tone: "info" },
  verified: { label: "Verified", tone: "success" },
  failed: { label: "Failed", tone: "critical" },
};

const HINT: Record<SupplierCheckKey, string> = {
  business_registration: "Checked against an official business registry",
  owner_identity: "The owner's identity was confirmed by the NGO",
  business_address: "The business operates at the address it gave",
  payment_account: "The account holder's name matches the business",
  sanctions_screening: "Screened against sanctions and exclusion lists",
  ngo_reference: "Another NGO has worked with this supplier",
};

const RECORDABLE = ["in_review", "verified", "failed"] as const;
type Recordable = (typeof RECORDABLE)[number];

function CheckForm({ check, supplierId, onSaved, onCancel }: { check: SupplierCheck; supplierId: string; onSaved: (detail: SupplierDetail) => void; onCancel: () => void }) {
  const [state, setState] = useState<Recordable>(check.state === "not_checked" ? "verified" : check.state);
  const [evidence, setEvidence] = useState(check.evidence ?? "");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorId = `${check.key}-error`;

  async function save() {
    const text = evidence.trim();
    if (state !== "in_review" && text.length < 3) {
      setMissing(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      onSaved(await api.recordSupplierCheck(supplierId, { key: check.key, state, ...(text ? { evidence: text } : {}) }));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save this check.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Result for ${SUPPLIER_CHECK_LABELS[check.key]}`}>
        {RECORDABLE.map((option) => <Choice key={option} selected={state === option} onClick={() => { setState(option); setMissing(false); }} className="rounded-full px-3.5 py-1.5">{STATE[option].label}</Choice>)}
      </div>
      <label className="mt-3 block text-sm font-bold text-navy">
        <span className="mb-1.5 block">{state === "failed" ? "What went wrong?" : "Evidence reference"} {state === "in_review" && <span className="font-normal text-slate-500">(optional)</span>}</span>
        <input value={evidence} maxLength={300} onChange={(event) => { setEvidence(event.target.value); setMissing(false); }} aria-invalid={missing} aria-describedby={missing ? errorId : undefined} placeholder="Where the proof is kept, e.g. a file reference" className={`${fieldClass} ${missing ? fieldErrorClass : ""}`} />
      </label>
      {missing && <FieldError id={errorId}>{state === "failed" ? "Please say briefly why this check failed." : "Add a reference so someone else can find the proof."}</FieldError>}
      <p className="mt-1.5 text-xs text-slate-500">Don't paste ID numbers or bank details. Saved to the audit log with your name and the time.</p>
      {error && <FieldError>{error}</FieldError>}
      <div className="mt-3 flex gap-2.5">
        <button type="button" disabled={busy} onClick={() => void save()} className={button.primary}>{busy ? "Saving…" : "Save result"}</button>
        <button type="button" onClick={onCancel} className={button.secondary}>Cancel</button>
      </div>
    </div>
  );
}

export function VerificationChecklist({ supplier, onSaved }: { supplier: SupplierDetail; onSaved: (detail: SupplierDetail) => void }) {
  const [editing, setEditing] = useState<SupplierCheckKey | null>(null);
  const verified = supplier.checks.filter((check) => check.state === "verified").length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy">Verification checklist</h2>
        <span className="tabular text-[13px] text-slate-600">{verified} of {supplier.checks.length} verified</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(STATE) as SupplierCheckState[]).map((state) => <Badge key={state} tone={STATE[state].tone}>{STATE[state].label}</Badge>)}</div>
      <ul className="mt-4 space-y-3">
        {supplier.checks.map((check) => (
          <li key={check.key} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-navy">{SUPPLIER_CHECK_LABELS[check.key]}</p>
                <p className="mt-0.5 break-words text-[13px] text-slate-600">{check.at ? [check.evidence, check.actor, shortDate(check.at)].filter(Boolean).join(" · ") : HINT[check.key]}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <Badge tone={STATE[check.state].tone}>{STATE[check.state].label}</Badge>
                {editing !== check.key && <button type="button" onClick={() => setEditing(check.key)} aria-label={`Update ${SUPPLIER_CHECK_LABELS[check.key]}`} className="text-sm font-semibold text-teal-text hover:underline">Update</button>}
              </div>
            </div>
            {editing === check.key && <CheckForm check={check} supplierId={supplier.supplier_id} onCancel={() => setEditing(null)} onSaved={(detail) => { onSaved(detail); setEditing(null); }} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
