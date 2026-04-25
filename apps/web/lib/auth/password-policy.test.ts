import assert from "node:assert/strict";
import test from "node:test";
import { getPasswordPolicyStatus } from "./password-policy";

test("password policy accepts mixed-case passwords with a special character", () => {
  const status = getPasswordPolicyStatus("LaunchPass9!");

  assert.equal(status.hasMinimumLength, true);
  assert.equal(status.hasUppercase, true);
  assert.equal(status.hasLowercase, true);
  assert.equal(status.hasSpecialCharacter, true);
  assert.equal(status.isValid, true);
});

test("password policy rejects passwords without a special character", () => {
  const status = getPasswordPolicyStatus("LaunchPass9");

  assert.equal(status.hasMinimumLength, true);
  assert.equal(status.hasUppercase, true);
  assert.equal(status.hasLowercase, true);
  assert.equal(status.hasSpecialCharacter, false);
  assert.equal(status.isValid, false);
});

test("password policy still rejects passwords without mixed case", () => {
  const status = getPasswordPolicyStatus("launchpass9");

  assert.equal(status.hasMinimumLength, true);
  assert.equal(status.hasUppercase, false);
  assert.equal(status.isValid, false);
});
