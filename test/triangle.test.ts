import { Triangle, triangle, point, line_seg, Rect, rect } from "../src/euclid";
import { test_macros } from "@rusts/std";
const { assert, assert_eq } = test_macros;

describe("Triangle", () => {
  test("triangle_contains", () => {
    let t1 = triangle(point(0, 0), point(1, 0), point(0, 1));
    assert(t1.contains_point(point(0.2, 0.2)));
    assert(!t1.contains_point(point(1.2, 0.2)));
    // Point exactly on the edge counts as outside the triangle.
    assert(!t1.contains_point(point(0, 0)));

    // Triangle vertex winding should not matter
    let t2 = triangle(point(1, 0), point(0, 0), point(0, 1));
    assert(t1.contains_point(point(0.2, 0.2)));
  });

  test("segments", () => {
    let t = triangle(point(1, 2), point(3, 4), point(5, 6));

    assert_eq(t.ab(), t.ba().flip());
    assert_eq(t.ac(), t.ca().flip());
    assert_eq(t.bc(), t.cb().flip());
  });

  test("triangle_intersections", () => {
    let t1 = triangle(point(1, 1), point(6, 1), point(3, 6));

    let t2 = triangle(point(2, 2), point(0, 3), point(1, 6));

    assert(t1.intersects(t2));
    assert(t2.intersects(t1));

    // t3 and t1 have an overlapping edge, they are "touching" but not intersecting.
    let t3 = triangle(point(6, 5), point(6, 1), point(3, 6));

    assert(!t1.intersects(t3));
    assert(!t3.intersects(t1));

    // t4 is entirely inside t1
    let t4 = triangle(point(2, 2), point(5, 2), point(3, 4));

    assert(t1.intersects(t4));
    assert(t4.intersects(t1));

    // Triangles intersect themselves.
    assert(t1.intersects(t1));
    assert(t2.intersects(t2));
    assert(t3.intersects(t3));
    assert(t4.intersects(t4));
  });

  test("segment_intersection", () => {
    let tri = triangle(point(1, 1), point(6, 1), point(3, 6));
    let l1 = line_seg(point(2, 0), point(3, 4));

    assert(tri.intersects_line_segment(l1));

    let l2 = line_seg(point(1, 3), point(0, 4));

    assert(!tri.intersects_line_segment(l2));

    // The segment is entirely inside the triangle.
    let inside = line_seg(point(2, 2), point(5, 2));

    assert(tri.intersects_line_segment(inside));

    // A triangle does not intersect its own segments.
    assert(!tri.intersects_line_segment(tri.ab()));
    assert(!tri.intersects_line_segment(tri.bc()));
    assert(!tri.intersects_line_segment(tri.ac()));
  });

  test("bounding_rect", () => {
    let t1 = triangle(point(10, 20), point(35, 40), point(50, 10));
    let r1 = rect(10, 10, 40, 30);

    let t2 = triangle(point(5, 30), point(25, 10), point(35, 40));
    let r2 = rect(5, 10, 30, 30);

    let t3 = triangle(point(1, 1), point(2, 5), point(0, 4));
    let r3 = rect(0, 1, 2, 4);

    let cases: [Triangle, Rect][] = [[t1, r1], [t2, r2], [t3, r3]];
    for (let [tri, r] of cases) {
      assert_eq(tri.bounding_rect(), r);
    }
  });
});
