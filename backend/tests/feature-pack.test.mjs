import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { filterRows, toCsv, buildCommissionInsights } from "../featurePack.mjs";

// Offline only: never set provider keys here; fallback must work without them.
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;

test("search/filter keeps false and 0 values searchable", () => {
  const rows = [
    { id: "a", reference: "COM-1", title: "Alpha closing", status: "Open", amount: 0, verified: false },
    { id: "b", reference: "COM-2", title: "Beta closing", status: "Closed", amount: 75, verified: true },
  ];
  assert.equal(filterRows(rows, { q: "alpha" }).length, 1);
  assert.equal(filterRows(rows, { q: "false" }).length, 1);
  assert.equal(filterRows(rows, { status: "Closed" }).length, 1);
  assert.equal(filterRows(rows, {}).length, 2);
});

test("csv export preserves false, 0 and empty columns", () => {
  const csv = toCsv([{ id: "a", verified: false, amount: 0, note: "" }], ["id", "verified", "amount", "note"]);
  assert.equal(csv.split("\n")[1], "a,false,0,");
});

test("deterministic fallback reports aiGenerated false with zero counts intact", () => {
  const result = buildCommissionInsights([]);
  assert.equal(result.aiGenerated, false);
  assert.equal(result.features.length, 3);
  assert.equal(result.features[0].metrics.find((m) => m.label === "Commission records").value, 0);
  for (const feature of result.features) assert.ok(feature.sections.some((s) => s.title === "Limitations"));
});

test("export and insights routes are mounted behind auth", () => {
  const server = fs.readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.ok(server.includes("/api/export/records"));
  assert.ok(server.includes("/api/ai/insights"));
  assert.ok(server.includes("app.get('/api/export/records',auth"));
});
