import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { RedAlertQuery } from "./internal-admin.controller";

test("RedAlertQuery coerces windowDays query strings into integers", () => {
  const query = plainToInstance(RedAlertQuery, {
    windowDays: "7",
    category: "ALL",
    severity: "ALL"
  });

  assert.equal(query.windowDays, 7);
  assert.deepEqual(validateSync(query), []);
});
