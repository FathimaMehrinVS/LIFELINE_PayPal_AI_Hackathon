import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CommerceRequestSchema,
  CommerceResultSchema,
  FinanceRequestSchema,
  FinanceResultSchema,
  SituationRequestSchema,
  SituationResultSchema,
} from "@lifeline/contracts";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

const SAMPLES_DIR = join(import.meta.dirname, "../../packages/contracts/samples");

const cases: [string, ZodType][] = [
  ["situation-request.json", SituationRequestSchema],
  ["situation-result.json", SituationResultSchema],
  ["finance-request.json", FinanceRequestSchema],
  ["finance-result.json", FinanceResultSchema],
  ["commerce-request.json", CommerceRequestSchema],
  ["commerce-result.json", CommerceResultSchema],
];

describe("contract samples", () => {
  it.each(cases)("%s matches its schema", (file, schema) => {
    const data = JSON.parse(readFileSync(join(SAMPLES_DIR, file), "utf8"));
    const result = schema.safeParse(data);
    expect(result.error?.issues ?? []).toEqual([]);
  });
});
