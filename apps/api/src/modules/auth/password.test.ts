import assert from "node:assert/strict";
import test from "node:test";
import { isPasswordPolicySatisfied } from "./password";

test("api password policy accepts mixed-case passwords with a special character", () => {
  assert.equal(isPasswordPolicySatisfied("LaunchPass9!"), true);
});

test("api password policy rejects passwords without a special character", () => {
  assert.equal(isPasswordPolicySatisfied("LaunchPass9"), false);
});

test("api password policy rejects passwords without mixed case", () => {
  assert.equal(isPasswordPolicySatisfied("launchpass9"), false);
  assert.equal(isPasswordPolicySatisfied("LAUNCHPASS9"), false);
});
