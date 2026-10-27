import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePersistenceTarget,
  PersistenceTargetConfigurationError,
} from "../../lib/pocketbase/persistence-target.ts";

test("development persistence requires an explicit local target", () => {
  const target = resolvePersistenceTarget({
    NODE_ENV: "development",
    POCKETBASE_PERSISTENCE_ENV: "development",
    POCKETBASE_DEVELOPMENT_URL: "http://127.0.0.1:8091",
  });

  assert.equal(target.environment, "development");
  assert.equal(target.url.origin, "http://127.0.0.1:8091");
});

test("development persistence rejects remote, HTTPS, and ambiguous URLs", () => {
  const base = {
    NODE_ENV: "development",
    POCKETBASE_PERSISTENCE_ENV: "development",
  };

  for (const url of [
    "https://localhost:8091",
    "http://example.invalid",
    "http://localhost:8091/path?target=other",
  ]) {
    assert.throws(
      () => resolvePersistenceTarget({ ...base, POCKETBASE_DEVELOPMENT_URL: url }),
      PersistenceTargetConfigurationError,
    );
  }
});

test("runtime and explicit persistence environment must agree", () => {
  assert.throws(
    () => resolvePersistenceTarget({
      NODE_ENV: "development",
      POCKETBASE_PERSISTENCE_ENV: "production",
      POCKETBASE_PRODUCTION_URL: "https://pb.example.invalid",
    }),
    PersistenceTargetConfigurationError,
  );
  assert.throws(
    () => resolvePersistenceTarget({
      NODE_ENV: "production",
      POCKETBASE_PERSISTENCE_ENV: "development",
      POCKETBASE_DEVELOPMENT_URL: "http://localhost:8091",
    }),
    PersistenceTargetConfigurationError,
  );
});

test("production persistence requires a non-loopback HTTPS target", () => {
  const target = resolvePersistenceTarget({
    NODE_ENV: "production",
    POCKETBASE_PERSISTENCE_ENV: "production",
    POCKETBASE_PRODUCTION_URL: "https://pb.example.invalid",
  });

  assert.equal(target.environment, "production");
  assert.equal(target.url.protocol, "https:");
  assert.throws(
    () => resolvePersistenceTarget({
      NODE_ENV: "production",
      POCKETBASE_PERSISTENCE_ENV: "production",
      POCKETBASE_PRODUCTION_URL: "http://localhost:8090",
    }),
    PersistenceTargetConfigurationError,
  );
});

test("existing ambiguous POCKETBASE_URL is never selected for persistence", () => {
  assert.throws(
    () => resolvePersistenceTarget({
      NODE_ENV: "development",
      POCKETBASE_URL: "http://localhost:8091",
    }),
    PersistenceTargetConfigurationError,
  );
});
