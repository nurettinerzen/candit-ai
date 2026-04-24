import assert from "node:assert/strict";
import test from "node:test";
import { ScreeningSupportTaskService } from "./screening-support-task.service.js";

test("sanitizeSections rewrites low-signal screening summaries into recruiter actions", () => {
  const service = new ScreeningSupportTaskService(
    {} as never,
    {
      normalizeRecommendation: (value: unknown) => value ?? "HOLD"
    } as never,
    {} as never
  );

  const result = (service as any).sanitizeSections({
    facts: ["Aday satis hedefleriyle calistigini anlatti."],
    interpretation: ["Aday satis hedefleriyle calistigini anlatti."],
    recommendationSummary: "Recruiter degerlendirmesi gerekir.",
    recommendationAction: "Adayi degerlendir.",
    recommendedOutcome: "HOLD",
    flags: [],
    missingInformation: ["Ilk gorusmede hedef takibi ornekleri ayrica sorulmali."],
    uncertaintyReasons: [],
    evidenceLinks: [],
    confidence: 0.63
  });

  assert.notEqual(result.recommendationSummary, "Recruiter degerlendirmesi gerekir.");
  assert.match(result.recommendationSummary, /(teyit|recruiter gorusmesi|inceleme)/i);
});

test("loadRubric prefers screening rubric before fit scoring rubric for screening support", async () => {
  const queries: Array<Record<string, unknown>> = [];
  const service = new ScreeningSupportTaskService(
    {
      aiTaskRun: {
        findUnique: async () => ({
          rubricId: null
        })
      },
      scoringRubric: {
        findFirst: async (query: Record<string, unknown>) => {
          queries.push(query);
          const where = query.where as {
            key?: {
              not?: {
                startsWith?: string;
              };
            };
          };

          if (where.key?.not?.startsWith === "fit_scoring_") {
            return {
              id: "rubric_warehouse_v1",
              key: "warehouse_screening"
            };
          }

          return {
            id: "rubric_fit_warehouse_v1",
            key: "fit_scoring_warehouse"
          };
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  const rubric = await (service as any).loadRubric("ten_1", "run_1", "warehouse");

  assert.equal(rubric.key, "warehouse_screening");
  assert.equal(
    ((queries[0]?.where as { key?: { not?: { startsWith?: string } } }).key?.not?.startsWith ??
      null),
    "fit_scoring_"
  );
});
