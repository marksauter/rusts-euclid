import { Range, range, format, println } from "@rusts/std";
import {
  Angle,
  Arc,
  ArcFlags,
  SvgArc,
  QuadraticBezierSegment,
  CubicBezierSegment,
  point,
  vector,
  Rect,
  rect,
  approx_eq
} from "../src/internal";
import { test_macros } from "@rusts/std";
const { assert, assert_eq, should_panic } = test_macros;

function test_endpoints(svg_arc: SvgArc) {
  let a1 = svg_arc.clone();
  a1.flags = new ArcFlags(false, false);
  do_test_endpoints(a1);

  let a2 = svg_arc.clone();
  a2.flags = new ArcFlags(true, false);
  do_test_endpoints(a2);

  let a3 = svg_arc.clone();
  a3.flags = new ArcFlags(false, true);
  do_test_endpoints(a3);

  let a4 = svg_arc.clone();
  a4.flags = new ArcFlags(true, true);
  do_test_endpoints(a4);
}

function do_test_endpoints(svg_arc: SvgArc) {
  let eps = point(0.01, 0.01);
  let arc = svg_arc.to_arc();
  assert(
    arc.from().approx_eq_eps(svg_arc.from, eps),
    `assertion failed arc.from === svg_arc.from
arc.from: {:?}
svg_arc.from: {:?}
svg_arc.flags: {:?}`,
    arc.from(),
    svg_arc.from,
    svg_arc.flags
  );
  assert(
    arc.to().approx_eq_eps(svg_arc.to, eps),
    `assertion failed arc.to === svg_arc.to
arc.to: {:?}
svg_arc.to: {:?}
svg_arc.flags: {:?}`,
    arc.to(),
    svg_arc.to,
    svg_arc.flags
  );
}

function do_test(arc: Arc, expected_quadratic_count: number, expected_cubic_count: number) {
  let last = arc.to();
  {
    let prev = arc.from();
    let count = 0;
    arc.for_each_quadratic_bezier((c: QuadraticBezierSegment) => {
      assert(c.start.approx_eq(prev));
      prev = c.end;
      count += 1;
    });
    assert(prev.approx_eq(last));
    assert_eq(count, expected_quadratic_count);
  }
  {
    let prev = arc.from();
    let count = 0;
    arc.for_each_cubic_bezier((c: CubicBezierSegment) => {
      assert(c.start.approx_eq(prev));
      prev = c.end;
      count += 1;
    });
    assert(prev.approx_eq(last));
    assert_eq(count, expected_cubic_count);
  }
}

function assert_approx_eq_rect(r1: Rect, r2: Rect) {
  assert(
    !(
      !approx_eq(r1.min_x(), r2.min_x()) ||
      !approx_eq(r1.min_x(), r2.min_x()) ||
      !approx_eq(r1.min_x(), r2.min_x()) ||
      !approx_eq(r1.min_x(), r2.min_x())
    ),
    `assertion failed (left === right)
left: {:?},
right: {:?}`,
    r1,
    r2
  );
}

describe("Arc", () => {
  test("from_svg_arc", () => {
    let flags = ArcFlags.default();

    test_endpoints(
      new SvgArc(point(0, -10), point(10, 0), vector(10, 10), Angle.radians(0), flags)
    );

    test_endpoints(
      new SvgArc(point(0, -10), point(10, 0), vector(100, 10), Angle.radians(0), flags)
    );

    test_endpoints(
      new SvgArc(point(0, -10), point(10, 0), vector(10, 30), Angle.radians(1), flags)
    );

    test_endpoints(
      new SvgArc(point(5, -10), point(5, 5), vector(10, 30), Angle.radians(-2), flags)
    );
  });

  test("to_quadratics_and_cubics", () => {
    do_test(
      new Arc(point(2, 3), vector(10, 3), Angle.radians(0.1), Angle.radians(3), Angle.radians(0.5)),
      4,
      2
    );

    do_test(
      new Arc(point(4, 5), vector(3, 5), Angle.radians(2), Angle.radians(-3), Angle.radians(1.3)),
      4,
      2
    );

    do_test(
      new Arc(
        point(0, 0),
        vector(100, 0.01),
        Angle.radians(-1),
        Angle.radians(0.1),
        Angle.radians(0.3)
      ),
      1,
      1
    );

    do_test(
      new Arc(
        point(0, 0),
        vector(1, 1),
        Angle.radians(3),
        Angle.radians(-0.1),
        Angle.radians(-0.3)
      ),
      1,
      1
    );
  });

  test("bounding_rect", () => {
    var r = new Arc(
      point(0, 0),
      vector(1, 1),
      Angle.radians(0),
      Angle.pi(),
      Angle.zero()
    ).bounding_rect();
    assert_approx_eq_rect(r, rect(-1, 0, 2, 1));

    var r = new Arc(
      point(0, 0),
      vector(1, 1),
      Angle.radians(0),
      Angle.pi(),
      Angle.pi()
    ).bounding_rect();
    assert_approx_eq_rect(r, rect(-1, -1, 2, 1));

    var r = new Arc(
      point(0, 0),
      vector(2, 1),
      Angle.radians(0),
      Angle.pi(),
      Angle.frac_pi_2()
    ).bounding_rect();
    assert_approx_eq_rect(r, rect(-1, -2, 1, 4));

    var r = new Arc(
      point(1, 1),
      vector(1, 1),
      Angle.pi(),
      Angle.pi(),
      Angle.frac_pi_4().neg_assign()
    ).bounding_rect();
    assert_approx_eq_rect(r, rect(0, 0, 1.707107, 1.707107));

    var angle = Angle.zero();
    for (let _ of range(0, 10)) {
      // println("angle: {:?}", angle);
      var r = new Arc(
        point(0, 0),
        vector(4, 4),
        angle,
        Angle.two_pi(),
        Angle.frac_pi_4()
      ).bounding_rect();
      assert_approx_eq_rect(r, rect(-4, -4, 8, 8));
      angle.add_assign(Angle.two_pi().div(10));
    }

    var angle = Angle.zero();
    for (let _ of range(0, 10)) {
      // println("angle: {:?}", angle);
      var r = new Arc(
        point(0, 0),
        vector(4, 4),
        Angle.zero(),
        Angle.two_pi(),
        angle
      ).bounding_rect();
      assert_approx_eq_rect(r, rect(-4, -4, 8, 8));
      angle.add_assign(Angle.two_pi().div(10));
    }
  });

  test("negative_flattening_step", () => {
    // These parameters were running into a precision issue which led the
    // flattening step to never converge towards 1 and cause an infinite loop.

    let arc = new Arc(
      point(-100, -150),
      vector(50, 50),
      Angle.radians(0.982944787),
      Angle.radians(-898),
      Angle.zero()
    );

    arc.for_each_flattened(0.100000001, () => {});
  });
});
