// Deterministic feature-pack helpers: search/filter, CSV export, and
// record-based insights with a labelled offline fallback (aiGenerated:false).
// Pure functions only — no provider or database calls.

export function filterRows(rows, { q = "", status = "" } = {}) {
  const needle = String(q || "").trim().toLowerCase();
  const wanted = String(status || "").trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || typeof row !== "object") return false;
    if (wanted) {
      const actual = String(row.status ?? row.state ?? "").toLowerCase();
      if (actual !== wanted) return false;
    }
    if (!needle) return true;
    return Object.values(row).some((value) => {
      if (value === null || value === undefined) return false;
      const text = typeof value === "object" ? JSON.stringify(value) : String(value);
      return text.toLowerCase().includes(needle);
    });
  });
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function toCsv(rows, columns) {
  const list = Array.isArray(rows) ? rows : [];
  const cols = columns && columns.length ? columns : Object.keys(list[0] || { value: "" });
  return [cols.join(","), ...list.map((row) => cols.map((col) => csvCell(row?.[col])).join(","))].join("\n");
}

export function buildCommissionInsights(records = []) {
  const list = Array.isArray(records) ? records : [];
  const open = list.filter((r) => !["approved", "closed"].includes(String(r?.status || "").toLowerCase())).length;
  const highRisk = list.filter((r) => ["high", "critical"].includes(String(r?.risk || "").toLowerCase())).length;
  const totalAmount = list.reduce((sum, r) => sum + (Number(r?.amount) || 0), 0);
  const features = [
    {
      feature: "commission-variance",
      title: "Commission variance scan",
      summary: `Reviewed ${list.length} saved commission records totalling ${totalAmount}.`,
      metrics: [
        { label: "Commission records", value: list.length },
        { label: "Open records", value: open },
        { label: "Total recorded amount", value: totalAmount },
        { label: "Records with zero amount", value: list.filter((r) => !(Number(r?.amount) > 0)).length },
      ],
      sections: [
        { title: "Summary", detail: "Totals come from saved feature records only, including zero amounts shown explicitly." },
        { title: "Findings", detail: list.length ? "Records exist for reconciliation; confirm each split against the transaction file before paying out." : "No commission records are saved yet (count 0), so no variance finding can be made." },
        { title: "Limitations", detail: "Deterministic fallback over saved records only; it does not verify splits or closing statements." },
      ],
      actions: ["Reconcile open records to closing statements.", "Check zero-amount records before aggregating totals."],
    },
    {
      feature: "exception-triage",
      title: "Reconciliation exception triage",
      summary: `Flagged ${highRisk} high or critical risk records out of ${list.length}.`,
      metrics: [
        { label: "High or critical risk records", value: highRisk },
        { label: "Records without an owner", value: list.filter((r) => !r?.owner).length },
        { label: "Records without a due date", value: list.filter((r) => !r?.due_date).length },
      ],
      sections: [
        { title: "Summary", detail: "Risk and status labels come from saved records; this scan does not re-assess them." },
        { title: "Findings", detail: highRisk ? "High-risk exceptions should be cleared before routine payouts." : "No high or critical risk records were found (count 0)." },
        { title: "Limitations", detail: "Deterministic fallback over saved records only." },
      ],
      actions: ["Assign an owner to unowned exceptions.", "Clear high-risk records first."],
    },
    {
      feature: "payout-readiness",
      title: "Payout readiness check",
      summary: `${list.length - open} of ${list.length} records are approved or closed.`,
      metrics: [
        { label: "Approved or closed records", value: list.length - open },
        { label: "Open records blocking payout", value: open },
      ],
      sections: [
        { title: "Summary", detail: "Readiness reflects saved statuses only; it does not authorise any payment." },
        { title: "Findings", detail: open ? "Open records remain, so the payout set is incomplete." : "No open records were found (open count 0)." },
        { title: "Limitations", detail: "Deterministic fallback over saved records only; a broker must approve payouts." },
      ],
      actions: ["Move reviewed records to approved.", "Hold payouts for records still open."],
    },
  ];
  return {
    aiGenerated: false,
    source: "deterministic-fallback",
    disclaimer: "Offline deterministic analysis of saved commission records. Not AI-generated.",
    features,
  };
}
