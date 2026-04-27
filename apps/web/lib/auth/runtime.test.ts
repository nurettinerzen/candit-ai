import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveInternalAdminEmailAllowlist,
  resolveAuthSessionMode,
  resolveAuthTokenTransport,
  resolveWebRuntimeMode
} from "./runtime";

test("production runtime forces jwt mode and cookie transport", () => {
  const runtimeMode = resolveWebRuntimeMode("production");

  assert.equal(resolveAuthSessionMode("dev_header", runtimeMode), "jwt");
  assert.equal(resolveAuthTokenTransport("header", runtimeMode, "dev_header"), "cookie");
});

test("demo runtime falls back to hybrid mode when unset", () => {
  const runtimeMode = resolveWebRuntimeMode("demo");

  assert.equal(resolveAuthSessionMode(undefined, runtimeMode), "hybrid");
  assert.equal(resolveAuthTokenTransport(undefined, runtimeMode, "hybrid"), "header");
});

test("development runtime keeps explicit transport choices", () => {
  const runtimeMode = resolveWebRuntimeMode("development");

  assert.equal(resolveAuthSessionMode("jwt", runtimeMode), "jwt");
  assert.equal(resolveAuthTokenTransport("header", runtimeMode, "jwt"), "header");
  assert.equal(resolveAuthTokenTransport(undefined, runtimeMode, "jwt"), "cookie");
});

test("configured internal admin allowlist overrides default fallback", () => {
  assert.deepEqual(resolveInternalAdminEmailAllowlist(["nurettinerzen@gmail.com"]), [
    "nurettinerzen@gmail.com"
  ]);
  assert.deepEqual(resolveInternalAdminEmailAllowlist(), ["info@candit.ai"]);
});
