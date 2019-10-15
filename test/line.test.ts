import {
  Scalar,
  approx_eq,
  Point,
  point,
  Rect,
  rect,
  Vector,
  vector,
  sin_cos,
  approx_eq_eps
} from "../src/euclid";
import { LineSegment, line_seg, Line, line, LineEquation, line_eqn } from "../src/line";
import { Some, None, PI } from "@rusts/std";
import { test_macros } from "@rusts/std";
const { assert, assert_eq } = test_macros;

function fuzzy_eq_vector(a: Vector, b: Vector, epsilon: Scalar): boolean {
  return approx_eq_eps(a.x, b.x, epsilon) && approx_eq_eps(a.y, b.y, epsilon);
}

function fuzzy_eq_point(a: Point, b: Point, epsilon: Scalar): boolean {
  return approx_eq_eps(a.x, b.x, epsilon) && approx_eq_eps(a.y, b.y, epsilon);
}

describe("LineSegment", () => {
  test("to_vector", () => {
    let l = line_seg(point(0, 0), point(1, 1));
    assert_eq(l.to_vector(), vector(1, 1));
  });

  test("intersection_rotated", () => {
    let epsilon = 0.0001;
    let count = 100;

    for (let i = 0; i < count; ++i) {
      for (let j = 0; i < count; ++i) {
        if (i % (count / 2) === j % (count / 2)) {
          // avoid colinear case
          continue;
        }

        let angle1 = (i / count) * 2 * PI;
        let angle2 = (j / count) * 2 * PI;

        let l1 = line_seg(
          point(10 * Math.cos(angle1), 10 * Math.sin(angle1)),
          point(-10 * Math.cos(angle1), -10 * Math.sin(angle1))
        );

        let l2 = line_seg(
          point(10 * Math.cos(angle2), 10 * Math.sin(angle2)),
          point(-10 * Math.cos(angle2), -10 * Math.sin(angle2))
        );

        assert(l1.intersects(l2));

        assert(fuzzy_eq_point(l1.sample(l1.intersection_t(l2).unwrap()[0]), point(0, 0), epsilon));

        assert(fuzzy_eq_point(l2.sample(l1.intersection_t(l2).unwrap()[1]), point(0, 0), epsilon));
      }
    }
  });

  test("intersection_touching", () => {
    let l1 = line_seg(point(0, 0), point(0, 0));
    let l2 = line_seg(point(10, 10), point(10, 10));

    assert(!l1.intersects(l2));
    assert(l1.intersection(l2).is_none());
  });

  test("intersection_overlap", () => {
    // It's hard to define the intersection points of two segments that overlap,
    // (would be a region rather than a paoint) and more importantly, in practice
    // tha algorithms don't need to consider this special case as an intersection,
    // so we choose to treat overlapping segments as not intersecting.

    let l1 = line_seg(point(0, 0), point(10, 0));
    let l2 = line_seg(point(5, 0), point(15, 0));

    assert(!l1.intersects(l2));
    assert(l1.intersection(l2).is_none());
  });

  test("bounding_rect", () => {
    let l1 = line_seg(point(1, 5), point(5, 7));
    let r1 = rect(1, 5, 4, 2);

    let l2 = line_seg(point(5, 5), point(1, 1));
    let r2 = rect(1, 1, 4, 4);

    let l3 = line_seg(point(3, 3), point(1, 5));
    let r3 = rect(1, 3, 2, 2);

    let cases: [LineSegment, Rect][] = [[l1, r1], [l2, r2], [l3, r3]];
    for (let [ls, r] of cases) {
      assert_eq(ls.bounding_rect(), r);
    }
  });

  test("set_length", () => {
    let a = line_seg(point(100, 1), point(100, -15));
    a.set_length(1);
    assert(approx_eq(a.length(), 1));
    a.set_length(1.5);
    assert(approx_eq(a.length(), 1.5));
    a.set_length(100);
    assert(approx_eq(a.length(), 100));
    a.set_length(-1);
    assert(approx_eq(a.length(), 1));
  });

  test("overlap", () => {
    let neg_ln = line_seg(point(0, 0), point(-1, 0));
    let pos_ln = line_seg(point(0, 0), point(1, 0));
    assert(neg_ln.overlaps_line(line(point(100, 0), vector(10, 0))));

    assert(pos_ln.overlaps_line(line(point(0, 0), vector(1, 0))));

    assert(pos_ln.overlaps_segment(line_seg(point(0, 0), point(1, 0))));

    assert(!pos_ln.overlaps_line(line(point(0, 1), vector(1, 1))));
  });

  test("contains_segment", () => {
    assert(
      line_seg(point(-1, 1), point(4, 1)).contains_segment(line_seg(point(2, 1), point(1, 1)))
    );
  });

  test("horizontal_line_intersection", () => {
    let s = line_seg(point(1, 2), point(2, 3));

    assert_eq(s.horizontal_line_intersection_t(2), Some(0));
    assert_eq(s.horizontal_line_intersection_t(2.25), Some(0.25));
    assert_eq(s.horizontal_line_intersection_t(2.5), Some(0.5));
    assert_eq(s.horizontal_line_intersection_t(2.75), Some(0.75));
    assert_eq(s.horizontal_line_intersection_t(3), Some(1));

    assert_eq(s.horizontal_line_intersection_t(1.5), None());
    assert_eq(s.horizontal_line_intersection_t(3.5), None());

    s = line_seg(point(2, 3), point(1, 2));

    assert_eq(s.horizontal_line_intersection_t(2), Some(1));
    assert_eq(s.horizontal_line_intersection_t(2.25), Some(0.75));
    assert_eq(s.horizontal_line_intersection_t(2.5), Some(0.5));
    assert_eq(s.horizontal_line_intersection_t(2.75), Some(0.25));
    assert_eq(s.horizontal_line_intersection_t(3), Some(0));

    assert_eq(s.horizontal_line_intersection_t(1.5), None());
    assert_eq(s.horizontal_line_intersection_t(3.5), None());
  });
});

describe("Line", () => {
  test("distance_to_point", () => {
    let l1 = line(point(2, 3), vector(-1.5, 0));

    let l2 = line(point(3, 3), vector(1.5, 1.5));

    assert(approx_eq(l1.signed_distance_to_point(point(1.1, 4)), -1));
    assert(approx_eq(l1.signed_distance_to_point(point(2.3, 2)), 1));
    assert(approx_eq(l2.signed_distance_to_point(point(1, 0)), -Math.sqrt(2) / 2));
    assert(approx_eq(l2.signed_distance_to_point(point(0, 1)), Math.sqrt(2) / 2));

    assert(approx_eq(l1.equation().distance_to_point(point(1.1, 4)), 1));
    assert(approx_eq(l1.equation().distance_to_point(point(2.3, 2)), 1));
    assert(approx_eq(l2.equation().distance_to_point(point(1, 0)), Math.sqrt(2) / 2));
    assert(approx_eq(l2.equation().distance_to_point(point(0, 1)), Math.sqrt(2) / 2));

    assert(
      approx_eq(
        l1.equation().signed_distance_to_point(point(1.1, 4)),
        l1.signed_distance_to_point(point(1.1, 4))
      )
    );
    assert(
      approx_eq(
        l1.equation().signed_distance_to_point(point(2.3, 2)),
        l1.signed_distance_to_point(point(2.3, 2))
      )
    );
    assert(
      approx_eq(
        l2.equation().signed_distance_to_point(point(1, 0)),
        l2.signed_distance_to_point(point(1, 0))
      )
    );
    assert(
      approx_eq(
        l2.equation().signed_distance_to_point(point(0, 1)),
        l2.signed_distance_to_point(point(0, 1))
      )
    );
  });

  test("solve_y_for_x", () => {
    let ln = line(point(1, 1), vector(2, 4));
    let eqn = ln.equation();
    let epsilon = 0.000001;

    eqn.solve_y_for_x(ln.point.x).map((y: Scalar) => {
      assert(Math.abs(y - ln.point.y) < epsilon);
    });

    eqn.solve_x_for_y(ln.point.y).map((x: Scalar) => {
      assert(Math.abs(x - ln.point.x) < epsilon);
    });

    let angle = 0.1;
    for (let i = 0; i < 100; ++i) {
      let [sin, cos] = sin_cos(angle);
      let ln = line(point(-1000, 600), vector(cos * 100, sin * 100));
      let eqn = ln.equation();

      eqn.solve_y_for_x(ln.point.x).map((y: Scalar) => {
        assert(Math.abs(y - ln.point.y) < epsilon);
      });

      eqn.solve_x_for_y(ln.point.y).map((x: Scalar) => {
        assert(Math.abs(x - ln.point.x) < epsilon);
      });

      angle += 0.001;
    }
  });
});

describe("LineEquation", () => {
  test("offset", () => {
    let l1 = line_eqn(2, 3, 1);
    let p = point(10, 3);
    let d = l1.signed_distance_to_point(p);
    let l2 = l1.offset(d);
    assert(l2.distance_to_point(p) < 0.0000001);
  });
});
