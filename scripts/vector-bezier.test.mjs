import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAnchorType,
  autoHandles,
  cubicPointAt,
  fitAnchors,
  insertAnchor,
  moveHandle,
  nearestOnPath,
  pathBounds,
  pathSegments,
  pathToD,
  recomputeAutoHandles,
  removeAnchors,
  splitSegment,
  translateAnchors,
} from "../src/lib/vector-editor/bezier.ts";

function corner(x, y) {
  return { point: { x, y }, handleIn: null, handleOut: null, type: "corner" };
}

const square = [corner(0, 0), corner(100, 0), corner(100, 100), corner(0, 100)];

test("segments of straight anchors degenerate to lines", () => {
  const segments = pathSegments(square, true);
  assert.equal(segments.length, 4);
  assert.deepEqual(segments[0].c1, { x: 0, y: 0 });
  assert.deepEqual(segments[0].c2, { x: 100, y: 0 });
});

test("open path emits one fewer segment than anchors", () => {
  assert.equal(pathSegments(square, false).length, 3);
  assert.equal(pathSegments([corner(0, 0)], false).length, 0);
});

test("pathToD uses L for straight runs and Z when closed", () => {
  assert.equal(
    pathToD(square, true),
    "M 0 0 L 100 0 L 100 100 L 0 100 Z",
  );
});

test("pathToD uses C when a handle is live", () => {
  const anchors = [
    {
      point: { x: 0, y: 0 },
      handleIn: null,
      handleOut: { x: 30, y: 0 },
      type: "smooth",
    },
    corner(100, 0),
  ];
  assert.equal(pathToD(anchors, false), "M 0 0 C 30 0 100 0 100 0");
});

test("path bounds include curve extrema beyond anchor points", () => {
  // A symmetric bump: handles pull the curve above y=0.
  const anchors = [
    {
      point: { x: 0, y: 0 },
      handleIn: null,
      handleOut: { x: 0, y: -100 },
      type: "broken",
    },
    {
      point: { x: 100, y: 0 },
      handleIn: { x: 0, y: -100 },
      handleOut: null,
      type: "broken",
    },
  ];
  const box = pathBounds(anchors, false);
  assert.equal(box.x, 0);
  assert.equal(box.width, 100);
  assert.ok(box.y < -70, `curve top should reach -75, got ${box.y}`);
  assert.ok(Math.abs(box.y + box.height) < 1e-9, "bottom stays at 0");
});

test("nearest point on a straight closed path lands on the edge", () => {
  const hit = nearestOnPath(square, true, { x: 50, y: -10 });
  assert.equal(hit.segmentIndex, 0);
  assert.ok(Math.abs(hit.point.x - 50) < 0.5);
  assert.ok(Math.abs(hit.point.y) < 1e-6);
  assert.ok(Math.abs(hit.distSq - 100) < 1);
});

test("splitting a segment preserves both endpoints and the split point", () => {
  const segment = {
    p0: { x: 0, y: 0 },
    c1: { x: 40, y: -60 },
    c2: { x: 60, y: -60 },
    p1: { x: 100, y: 0 },
  };
  const mid = cubicPointAt(segment, 0.5);
  const [left, right] = splitSegment(segment, 0.5);
  assert.deepEqual(left.p0, segment.p0);
  assert.deepEqual(right.p1, segment.p1);
  assert.deepEqual(left.p1, mid);
  assert.deepEqual(right.p0, mid);
  // The halves reproduce the original curve.
  const q = cubicPointAt(segment, 0.25);
  const qLeft = cubicPointAt(left, 0.5);
  assert.ok(Math.hypot(q.x - qLeft.x, q.y - qLeft.y) < 1e-9);
});

test("auto handles run parallel to the neighbor chord", () => {
  const { handleIn, handleOut } = autoHandles(
    { x: 0, y: 0 },
    { x: 50, y: 40 },
    { x: 100, y: 0 },
  );
  assert.deepEqual(handleOut, { x: 100 / 6, y: 0 });
  assert.deepEqual(handleIn, { x: -100 / 6, y: -0 });
});

test("recomputeAutoHandles only touches auto anchors", () => {
  const anchors = [
    corner(0, 0),
    { point: { x: 50, y: 40 }, handleIn: null, handleOut: null, type: "auto" },
    corner(100, 0),
  ];
  const next = recomputeAutoHandles(anchors, false);
  assert.equal(next[0].handleOut, null);
  assert.ok(next[1].handleIn && next[1].handleOut);
  assert.equal(next[2].handleIn, null);
});

test("convert to corner drops handles; to smooth collinearizes", () => {
  const anchors = [
    corner(0, 0),
    {
      point: { x: 50, y: 0 },
      handleIn: { x: -20, y: -10 },
      handleOut: { x: 30, y: 0 },
      type: "broken",
    },
    corner(100, 0),
  ];
  const cornered = applyAnchorType(anchors, 1, "corner", false);
  assert.equal(cornered[1].handleIn, null);
  assert.equal(cornered[1].handleOut, null);

  const smoothed = applyAnchorType(anchors, 1, "smooth", false);
  const { handleIn, handleOut } = smoothed[1];
  // Opposite direction of handleOut, original handleIn length preserved.
  const inLen = Math.hypot(handleIn.x, handleIn.y);
  assert.ok(Math.abs(inLen - Math.hypot(-20, -10)) < 1e-9);
  const cross = handleIn.x * handleOut.y - handleIn.y * handleOut.x;
  assert.ok(Math.abs(cross) < 1e-9, "handles must be collinear");
  assert.ok(handleIn.x < 0 && handleOut.x > 0, "handles point apart");
});

test("moveHandle keeps smooth pairs collinear and Alt breaks the pair", () => {
  const anchors = [
    corner(0, 0),
    {
      point: { x: 50, y: 0 },
      handleIn: { x: -25, y: 0 },
      handleOut: { x: 25, y: 0 },
      type: "smooth",
    },
    corner(100, 0),
  ];
  const moved = moveHandle(anchors, 1, "out", { x: 70, y: 20 }, false);
  assert.equal(moved[1].type, "smooth");
  assert.deepEqual(moved[1].handleOut, { x: 20, y: 20 });
  const inLen = Math.hypot(moved[1].handleIn.x, moved[1].handleIn.y);
  assert.ok(Math.abs(inLen - 25) < 1e-9, "opposite keeps its length");
  const cross =
    moved[1].handleIn.x * moved[1].handleOut.y -
    moved[1].handleIn.y * moved[1].handleOut.x;
  assert.ok(Math.abs(cross) < 1e-9);

  const broken = moveHandle(anchors, 1, "out", { x: 70, y: 20 }, true);
  assert.equal(broken[1].type, "broken");
  assert.deepEqual(broken[1].handleIn, { x: -25, y: 0 }, "in untouched");
});

test("inserting on a straight segment adds a corner and keeps neighbors", () => {
  const next = insertAnchor(square, true, 0, 0.5);
  assert.equal(next.length, 5);
  assert.deepEqual(next[1].point, { x: 50, y: 0 });
  assert.equal(next[1].type, "corner");
  assert.equal(next[0].handleOut, null);
  assert.equal(next[2].handleIn, null);
});

test("inserting on a curve keeps the drawn shape at the split point", () => {
  const anchors = [
    {
      point: { x: 0, y: 0 },
      handleIn: null,
      handleOut: { x: 40, y: -60 },
      type: "broken",
    },
    {
      point: { x: 100, y: 0 },
      handleIn: { x: -40, y: -60 },
      handleOut: null,
      type: "broken",
    },
  ];
  const segment = pathSegments(anchors, false)[0];
  const mid = cubicPointAt(segment, 0.5);
  const next = insertAnchor(anchors, false, 0, 0.5);
  assert.equal(next.length, 3);
  assert.ok(Math.hypot(next[1].point.x - mid.x, next[1].point.y - mid.y) < 1e-9);
  assert.equal(next[1].type, "smooth");
});

test("translate moves points only; fit scales points and handles", () => {
  const anchors = [
    {
      point: { x: 0, y: 0 },
      handleIn: null,
      handleOut: { x: 10, y: 0 },
      type: "broken",
    },
    corner(100, 50),
  ];
  const moved = translateAnchors(anchors, 5, 7);
  assert.deepEqual(moved[0].point, { x: 5, y: 7 });
  assert.deepEqual(moved[0].handleOut, { x: 10, y: 0 });

  const fitted = fitAnchors(
    anchors,
    { x: 0, y: 0, width: 100, height: 50 },
    { x: 0, y: 0, width: 200, height: 50 },
  );
  assert.deepEqual(fitted[1].point, { x: 200, y: 50 });
  assert.deepEqual(fitted[0].handleOut, { x: 20, y: 0 });
});

test("removeAnchors drops the given indices", () => {
  const next = removeAnchors(square, [1, 3]);
  assert.equal(next.length, 2);
  assert.deepEqual(next[0].point, { x: 0, y: 0 });
  assert.deepEqual(next[1].point, { x: 100, y: 100 });
});
