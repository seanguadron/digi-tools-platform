import assert from "node:assert/strict";
import test from "node:test";
import { getCardTilt } from "../src/lib/card-motion.ts";

const rect = {
  left: 100,
  top: 100,
  right: 200,
  bottom: 240,
  width: 100,
  height: 140,
};

test("card tilt follows pointer position inside the card", () => {
  const tilt = getCardTilt(190, 120, rect);
  assert.ok(tilt);
  assert.ok(tilt.rotateX > 0);
  assert.ok(tilt.rotateY > 0);
});

test("card tilt fades out beyond the proximity radius", () => {
  assert.equal(getCardTilt(400, 400, rect), null);
});

test("card center produces a neutral tilt", () => {
  assert.deepEqual(getCardTilt(150, 170, rect), {
    rotateX: -0,
    rotateY: 0,
  });
});
