import test from "node:test";
import assert from "node:assert/strict";
import { inferOnboardingStatus, isValidOnboardingStatus } from "../utils/onboardingStatus.js";

test("infers approved status from approval metadata newer than submission", () => {
  assert.equal(inferOnboardingStatus({
    onboardingSubmittedAt: "2026-01-02T09:00:00.000Z",
    approvedAt: "2026-01-02T10:00:00.000Z",
  }), "approved");
});

test("does not restore a later submission as approved from stale approval metadata", () => {
  assert.equal(inferOnboardingStatus({
    onboardingSubmittedAt: "2026-01-02T10:00:00.000Z",
    approvedAt: "2026-01-02T09:00:00.000Z",
  }), "pending");
});

test("ignores invalid approval timestamps", () => {
  assert.equal(inferOnboardingStatus({ approvedAt: "not-a-date" }), "incomplete");
});

test("infers rejected status from the rejection note", () => {
  assert.equal(inferOnboardingStatus({
    onboardingSubmittedAt: "2026-01-02T09:00:00.000Z",
    rejectionNote: "Please correct your job title.",
  }), "rejected");
});

test("infers pending status from onboarding submission metadata", () => {
  assert.equal(inferOnboardingStatus({
    onboardingSubmittedAt: "2026-01-02T09:00:00.000Z",
  }), "pending");
});

test("defaults to incomplete when no onboarding workflow metadata exists", () => {
  assert.equal(inferOnboardingStatus({}), "incomplete");
});

test("recognizes only the supported onboarding statuses", () => {
  assert.equal(isValidOnboardingStatus("approved"), true);
  assert.equal(isValidOnboardingStatus(undefined), false);
  assert.equal(isValidOnboardingStatus("legacy"), false);
});
