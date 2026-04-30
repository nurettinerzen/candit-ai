import assert from "node:assert/strict";
import test from "node:test";
import { JobsService } from "./jobs.service";

test("list falls back to legacy-compatible fields when newer Job columns are missing", async () => {
  let fallbackUsed = false;

  const service = new JobsService(
    {
      job: {
        findMany: async (input: Record<string, unknown>) => {
          const select = input.select as Record<string, unknown> | undefined;
          if (!select) {
            throw {
              code: "P2022",
              message: 'The column `Job.aiDraftText` does not exist in the current database.'
            };
          }

          fallbackUsed = true;
          return [
            {
              id: "job_1",
              title: "Backend Engineer",
              roleFamily: "Engineering",
              status: "PUBLISHED",
              locationText: "Istanbul",
              shiftType: null,
              salaryMin: null,
              salaryMax: null,
              jdText: "Legacy JD",
              createdAt: new Date("2026-04-30T00:00:00.000Z"),
              requirements: [],
              _count: {
                applications: 3
              }
            }
          ];
        }
      }
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.list("ten_1");

  assert.equal(fallbackUsed, true);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.screeningMode, "BALANCED");
  assert.equal(result[0]?.aiDraftText, null);
  assert.equal(result[0]?.jobProfile, null);
  assert.equal(result[0]?._count?.applications, 3);
});
