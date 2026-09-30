import test from "node:test";
import assert from "node:assert/strict";
import { asOfMonth, facilityCollectedAt } from "./regions";

test("keeps the population reference month separate from the facility collection date", () => {
  assert.match(asOfMonth, /^\d{4}-\d{2}$/);
  assert.match(facilityCollectedAt, /^\d{4}-\d{2}-\d{2}$/);
});
