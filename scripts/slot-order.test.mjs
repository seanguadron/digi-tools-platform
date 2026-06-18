import assert from "node:assert/strict";
import test from "node:test";
import { insertIntoSlots } from "../src/lib/slot-order.ts";

test("moving an equipped card earlier pushes following cards right", () => {
  assert.deepEqual(
    insertIntoSlots(["one", "two", "three", "four", ""], 0, "four", 5),
    ["four", "one", "two", "three", ""],
  );
});

test("moving into a gap preserves the requested slot", () => {
  assert.deepEqual(
    insertIntoSlots(["one", "", "three", "four", ""], 1, "four", 5),
    ["one", "four", "", "three", ""],
  );
});

test("adding to a full rack pushes the final card out", () => {
  assert.deepEqual(
    insertIntoSlots(["one", "two", "three"], 1, "new", 3),
    ["one", "new", "two"],
  );
});

test("dropping a card onto its current slot is stable", () => {
  assert.deepEqual(
    insertIntoSlots(["one", "two", "three"], 1, "two", 3),
    ["one", "two", "three"],
  );
});
