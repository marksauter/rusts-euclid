import { Some, range } from "@rusts/std";
import {
  QuadraticBezierSegment,
  point,
  first_monotonic_segment_intersection,
  monotonic_segment_intersections
} from "../src/euclid";
const { assert, assert_eq } = require("@rusts/std/dist/lib/macros.test");

describe("Monotonic", () => {
  test("two_intersections", () => {
    let c1 = new QuadraticBezierSegment(
      point(10, 0),
      point(10, 90),
      point(100, 90)
    ).assume_monotonic();
    let c2 = new QuadraticBezierSegment(
      point(0, 10),
      point(90, 10),
      point(90, 100)
    ).assume_monotonic();

    let intersections = monotonic_segment_intersections(c1, range(0, 1), c2, range(0, 1), 0.001);

    assert_eq(intersections.len(), 2);
    assert(intersections.get_unchecked(0)[0] < 0.1);
    assert(intersections.get_unchecked(1)[1] > 0.9);
  });
});
