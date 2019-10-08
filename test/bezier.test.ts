import { ArrayVec } from '@rusts/arrayvec'
import { Some, None, Range, range } from '@rusts/std'
import {
  CubicBezierSegment,
  QuadraticBezierSegment,
  MonotonicQuadraticBezierSegment,
  LineSegment,
  cubic_to_quadratics,
  cubic_bezier_intersections_t,
  cubic_to_monotonic_quadratics,
  Point,
  point,
  rect,
  vector,
  sin_cos
} from '../src/internal'
import { test_macros } from '@rusts/std'
const { assert, assert_eq, should_panic } = test_macros

describe('QuadraticBezierSegment', () => {
  test('bounding_rect_for_monotonic_quadratic_bezier_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(0, 0), point(2, 0))

    let expected_bounding_rect = rect(0, 0, 2, 0)

    let actual_bounding_rect = a.bounding_rect()

    assert_eq(actual_bounding_rect, expected_bounding_rect)
  })

  test('fast_bounding_rect_for_quadratic_bezier_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, 1), point(2, 0))

    let expected_bounding_rect = rect(0, 0, 2, 1)

    let actual_bounding_rect = a.fast_bounding_rect()

    assert_eq(actual_bounding_rect, expected_bounding_rect)
  })

  test('minimum_bounding_rect_for_quadratic_bezier_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, 1), point(2, 0))

    assert_eq(a.bounding_rect(), rect(0, 0, 2, 0.5))
  })

  test('y_maximum_t_for_simple_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, 1), point(2, 0))

    assert_eq(a.y_maximum_t(), 0.5)
  })

  test('local_y_extremum_t_for_simple_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, 1), point(2, 0))

    assert_eq(a.local_y_extremum_t(), Some(0.5))
  })

  test('y_minimum_t_for_simple_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, -1), point(2, 0))

    assert_eq(a.y_minimum_t(), 0.5)
  })

  test('x_maximum_t_for_simple_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, 1), point(0, 2))

    assert_eq(a.x_maximum_t(), 0.5)
  })

  test('local_x_extremum_t_for_simple_segment', () => {
    let a = new QuadraticBezierSegment(point(0, 0), point(1, 1), point(0, 2))

    assert_eq(a.local_x_extremum_t(), Some(0.5))
  })

  test('x_minimum_t_for_simple_segment', () => {
    let a = new QuadraticBezierSegment(point(2, 0), point(1, 1), point(2, 2))

    assert_eq(a.x_minimum_t(), 0.5)
  })

  test('length_straight_line', () => {
    // Sanity check: aligned points so both these curves are straight lines
    // that go fro (0, 0) to (2, 0).

    var len = new QuadraticBezierSegment(point(0, 0), point(1, 0), point(2, 0)).approx_length(0.01)
    assert_eq(len, 2)

    var len = new CubicBezierSegment(
      point(0, 0),
      point(1, 0),
      point(1, 0),
      point(2, 0)
    ).approx_length(0.01)
    assert_eq(len, 2)
  })

  test('derivatives', () => {
    let a = new QuadraticBezierSegment(point(1, 1), point(2, 1), point(2, 2))

    assert_eq(a.dy(0), 0)
    assert_eq(a.dx(1), 0)
    assert_eq(a.dy(0.5), a.dx(0.5))
  })

  test('monotonic_solve_t_for_x', () => {
    let curve = new QuadraticBezierSegment(point(1, 1), point(5, 5), point(10, 2))

    let tolerance = 0.0001

    for (let i of range(0, 10)) {
      let t = i / 10
      let p = curve.sample(t)
      let t2 = curve.assume_monotonic().solve_t_for_x(p.x)
      // t should be pretty close to t2 but the only guarantee we have and can
      // test against is that x(t) - x(t2) is within the specified tolerance
      // threshold.
      let x_diff = Math.abs(curve.x(t) - curve.x(t2))
      assert(x_diff <= tolerance, 'x_diff: {:?} > tolerance: {:?}', x_diff, tolerance)
    }
  })

  test('fat_line', () => {
    let c1 = new QuadraticBezierSegment(point(1, 2), point(1, 3), point(11, 12))

    let [l1, l2] = c1.fat_line()

    for (let i of range(0, 100)) {
      let t = i / 99
      let l1_dist = l1.signed_distance_to_point(c1.sample(t))
      let l2_dist = l2.signed_distance_to_point(c1.sample(t))
      assert(l1_dist >= -0.0000001, 'l1.signed_distance_to_point: {:?} < -0.0000001', l1_dist)
      assert(l2_dist <= 0.0000001, 'l2.signed_distance_to_point: {:?} > -0.0000001', l2_dist)
    }
  })

  test('is_linear', () => {
    let angle = 0
    let center = point(1000, -700)
    for (let _ of range(0, 10)) {
      for (let i of range(0, 10)) {
        let [sin, cos] = sin_cos(angle)
        let endpoint = vector(cos * 100, sin * 100)
        let curve = new QuadraticBezierSegment(
          center.sub(endpoint),
          center.add(endpoint.lerp(endpoint.neg(), i / 9)),
          center.add(endpoint)
        )

        assert(curve.is_linear(1e-10))
      }
      angle += 0.001
    }
  })

  test('flattening', () => {
    let c1 = new QuadraticBezierSegment(point(0, 0), point(5, 0), point(5, 5))
    let c2 = new QuadraticBezierSegment(point(0, 0), point(50, 0), point(50, 50))
    let c3 = new QuadraticBezierSegment(point(0, 0), point(100, 100), point(5, 0))

    const check_tolerance = (curve: QuadraticBezierSegment, tolerance: number) => {
      let c = curve.clone()
      do {
        let t = c.flattening_step(tolerance)
        if (t >= 1.0) {
          break
        }
        let [before, after] = c.split(t)
        let mid_point = before.sample(0.5)
        let distance = before
          .baseline()
          .to_line()
          .equation()
          .distance_to_point(mid_point)
        assert(distance <= tolerance, 'distance: {:?} > tolerance: {:?}', distance, tolerance)
        c = after
      } while (true)
    }

    check_tolerance(c1, 1.0)
    check_tolerance(c1, 0.1)
    check_tolerance(c1, 0.01)
    check_tolerance(c1, 0.001)
    check_tolerance(c1, 0.0001)

    check_tolerance(c2, 1.0)
    check_tolerance(c2, 0.1)
    check_tolerance(c2, 0.01)
    check_tolerance(c2, 0.001)
    check_tolerance(c2, 0.0001)

    check_tolerance(c3, 1.0)
    check_tolerance(c3, 0.1)
    check_tolerance(c3, 0.01)
    check_tolerance(c3, 0.001)
    check_tolerance(c3, 0.0001)
  })
})

describe('CubicBezierSegment', () => {
  test('fast_bounding_rect_for_cubic_bezier_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(0.5, 1), point(1.5, -1), point(2, 0))

    assert_eq(rect(0, -1, 2, 2), a.fast_bounding_rect())
  })

  test('minimum_bounding_rect_for_cubic_bezier_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(0.5, 2), point(1.5, -2), point(2, 0))

    let bounding_rect = a.bounding_rect()

    assert(rect(0, -0.6, 2, 1.2).contains_rect(bounding_rect))
    assert(bounding_rect.contains_rect(rect(0.1, -0.5, 1.9, 1)))
  })

  test('y_maximum_t_for_simple_cubic_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(0.5, 1), point(1.5, 1), point(2, 2))

    assert_eq(a.y_maximum_t(), 1)
  })

  test('y_minimum_t_for_simple_cubic_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(0.5, 1), point(1.5, 1), point(2, 0))

    assert_eq(a.y_minimum_t(), 0)
  })

  test('y_extrema_for_simple_cubic_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(1, 2), point(2, 2), point(3, 0))

    let n = 0
    a.for_each_local_y_extremum_t((t: number) => {
      assert_eq(t, 0.5)
      n += 1
    })
    assert_eq(n, 1)
  })

  test('x_maximum_t_for_simple_cubic_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(0.5, 1), point(1.5, 1), point(2, 0))

    assert_eq(a.x_maximum_t(), 1)
  })

  test('x_minimum_t_for_simple_cubic_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(0.5, 1), point(1.5, 1), point(2, 0))

    assert_eq(a.x_minimum_t(), 0)
  })

  test('x_extrema_for_simple_cubic_segment', () => {
    let a = new CubicBezierSegment(point(0, 0), point(1, 2), point(1, 2), point(0, 0))

    let n = 0
    a.for_each_local_x_extremum_t((t: number) => {
      assert_eq(t, 0.5)
      n += 1
    })
    assert_eq(n, 1)
  })

  test('derivatives', () => {
    let c1 = new CubicBezierSegment(point(1, 1), point(1, 2), point(2, 1), point(2, 2))

    assert_eq(c1.dx(0), 0)
    assert_eq(c1.dx(1), 0)
    assert_eq(c1.dy(0.5), 0)
  })

  test('monotonic_solve_t_for_x', () => {
    let curve = new CubicBezierSegment(point(1, 1), point(1, 2), point(2, 1), point(2, 2))

    let tolerance = 0.0001

    for (let i of range(0, 10)) {
      let t = i / 10
      let p = curve.sample(t)
      let t2 = curve.assume_monotonic().solve_t_for_x(p.x, range(0, 1), tolerance)
      // t should be pretty close to t2 but the only guarantee we have and can
      // test against is that x(t) - x(t2) is within the specified tolerance
      // threshold.
      let x_diff = Math.abs(curve.x(t) - curve.x(t2))
      assert(x_diff <= tolerance, 'x_diff: {:?} > tolerance: {:?}', x_diff, tolerance)
    }
  })

  test('fat_line', () => {
    const check = (c: CubicBezierSegment) => {
      let [l1, l2] = c.fat_line()

      for (let i of range(0, 100)) {
        let t = i / 99
        let l1_dist = l1.signed_distance_to_point(c.sample(t))
        let l2_dist = l2.signed_distance_to_point(c.sample(t))
        assert(l1_dist >= -0.0000001, 'l1.signed_distance_to_point: {:?} < -0.0000001', l1_dist)
        assert(l2_dist <= 0.0000001, 'l2.signed_distance_to_point: {:?} > -0.0000001', l2_dist)
      }
    }

    check(new CubicBezierSegment(point(1, 2), point(1, 3), point(11, 11), point(11, 12)))
    check(new CubicBezierSegment(point(1, 2), point(1, 3), point(11, 14), point(11, 12)))
    check(new CubicBezierSegment(point(0, 1), point(0.5, 0), point(0.5, 0), point(1, 1)))
  })

  test('is_linear', () => {
    let angle = 0
    let center = point(1000, -700)
    for (let _ of range(0, 100)) {
      for (let i of range(0, 10)) {
        for (let j of range(0, 10)) {
          let [sin, cos] = sin_cos(angle)
          let endpoint = vector(cos * 100, sin * 100)
          let curve = new CubicBezierSegment(
            center.sub(endpoint),
            center.add(endpoint.lerp(endpoint.neg(), i / 9)),
            center.add(endpoint.lerp(endpoint.neg(), j / 9)),
            center.add(endpoint)
          )

          assert(curve.is_linear(1e-10))
        }
        angle += 0.001
      }
    }
  })

  test('monotonic', () => {
    let curve = new CubicBezierSegment(point(1, 1), point(10, 2), point(1, 3), point(10, 4))

    curve.for_each_monotonic_range((range: Range) => {
      let sub_curve = curve.split_range(range)
      assert(sub_curve.is_monotonic())
    })
  })

  test('line_segment_intersections', () => {
    const assert_approx_eq = (
      a: ArrayVec<[number, number] /*;3*/>,
      b: [number, number][],
      epsilon: number
    ) => {
      for (let i of range(0, a.len())) {
        assert(
          Math.abs(a.get_unchecked(i)[0] - b[i][0]) <= epsilon &&
            Math.abs(a.get_unchecked(i)[1] - b[i][1]) <= epsilon,
          'a: {:?} != b: {:?}',
          a,
          b
        )
      }
      assert_eq(a.len(), b.len())
    }

    let epsilon = 0.0001

    // Make sure we find intersections with horizontal and vertical lines.

    let c1 = new CubicBezierSegment(point(-1, -1), point(0, 4), point(10, -4), point(11, 1))
    let l1 = new LineSegment(point(0, 0), point(10, 0))
    assert_approx_eq(c1.line_segment_intersections_t(l1), [[0.5, 0.5]], epsilon)

    let c2 = new CubicBezierSegment(point(-1, 0), point(0, 5), point(0, 5), point(1, 0))
    let l2 = new LineSegment(point(0, 0), point(0, 5))
    assert_approx_eq(c2.line_segment_intersections_t(l2), [[0.5, 0.75]], epsilon)
  })

  test('parameters_for_value', () => {
    const assert_approx_eq = (a: ArrayVec<number /*;3*/>, b: number[], epsilon: number) => {
      for (let i of range(0, a.len())) {
        assert(Math.abs(a.get_unchecked(i) - b[i]) <= epsilon, 'a: {:?} != b: {:?}', a, b)
      }
      assert_eq(a.len(), b.len())
    }

    let c = new CubicBezierSegment(point(0, 0), point(0, 8), point(10, 8), point(10, 0))
    let epsilon = 1e-4
    assert_approx_eq(c.solve_t_for_x(5), [0.5], epsilon)
    assert_approx_eq(c.solve_t_for_y(6), [0.5], epsilon)
  })

  test('cubic_intersection_deduping', () => {
    let epsilon = 0.0001

    // Two "line segments" with 3-fold overlaps, intersecting in their overlaps
    // for a total of parameter intersections.
    let line1 = new CubicBezierSegment(
      point(-1000000, 0),
      point(2000000, 3000000),
      point(-2000000, -1000000),
      point(1000000, 2000000)
    )
    let line2 = new CubicBezierSegment(
      point(-1000000, 2000000),
      point(2000000, -1000000),
      point(-2000000, 3000000),
      point(1000000, 0)
    )
    var intersections = line1.cubic_intersections(line2)
    // (If you increase the coordinates above to 10s of millions, you get two
    // returned intersections points; i.e. the test fails.)
    assert_eq(intersections.len(), 1)
    assert(
      Math.abs(intersections.get_unchecked(0).x) < epsilon,
      '{:?} >= {:?}',
      intersections.get_unchecked(0).x,
      epsilon
    )
    assert(
      Math.abs(intersections.get_unchecked(0).y - 1000000) < epsilon,
      '{:?} >= {:?}',
      intersections.get_unchecked(0).y,
      epsilon
    )

    let curve1 = new CubicBezierSegment(
      point(-10.0, -13.636363636363636),
      point(15.0, 11.363636363636363),
      point(-15.0, 11.363636363636363),
      point(10.0, -13.636363636363636)
    )
    let curve2 = new CubicBezierSegment(
      point(13.636363636363636, -10.0),
      point(-11.363636363636363, 15.0),
      point(-11.363636363636363, -15.0),
      point(13.636363636363636, 10.0)
    )
    var intersections = curve1.cubic_intersections(curve2)
    assert_eq(intersections.len(), 1)
    let x = Math.abs(intersections.get_unchecked(0).x)
    let y = Math.abs(intersections.get_unchecked(0).y)
    assert(x < epsilon, 'x: {:?} >= epsilon: {:?}', x, epsilon)
    assert(y < epsilon, 'y: {:?} >= epsilon: {:?}', y, epsilon)
  })
})

describe('bezier_helpers', () => {
  test('cubic_to_quadratics', () => {
    let quadratic = new QuadraticBezierSegment(point(1, 2), point(10, 5), point(0, 1))

    let count = 0
    cubic_to_quadratics(quadratic.to_cubic(), 0.0001, c => {
      assert(count === 0)
      assert(c.start.approx_eq(quadratic.start))
      assert(c.ctrl.approx_eq(quadratic.ctrl))
      assert(c.end.approx_eq(quadratic.end))
      count += 1
    })

    let cubic = new CubicBezierSegment(point(1, 1), point(10, 20), point(1, 3), point(10, 4))

    let prev = cubic.from()
    count = 0
    cubic_to_quadratics(cubic, 0.01, c => {
      assert_eq(c.start.fmt_debug(), prev.fmt_debug())
      prev = c.to()
      count += 1
    })

    assert(prev.approx_eq(cubic.end))
    assert(count < 10)
    assert(count > 4)
  })

  test('cubic_to_monotonic_quadratics', () => {
    let cubic = new CubicBezierSegment(point(1, 1), point(10, 2), point(1, 3), point(10, 4))

    let prev = cubic.start
    let count = 0
    cubic_to_monotonic_quadratics(cubic, 0.01, (c: MonotonicQuadraticBezierSegment) => {
      assert(c.segment.start.approx_eq(prev))
      prev = c.segment.end
      assert(c.segment.is_monotonic())
      count += 1
    })
    assert(prev.approx_eq(cubic.end))
    assert(count < 10)
    assert(count > 4)
  })
})

function do_test(
  curve1: CubicBezierSegment,
  curve2: CubicBezierSegment,
  intersection_count: number
) {
  do_test_once(curve1, curve2, intersection_count)
  do_test_once(curve2, curve1, intersection_count)
}

function do_test_once(
  curve1: CubicBezierSegment,
  curve2: CubicBezierSegment,
  intersection_count: number
) {
  let intersections = cubic_bezier_intersections_t(curve1, curve2)
  for (let intersection of intersections) {
    let p1 = curve1.sample(intersection[0])
    let p2 = curve2.sample(intersection[1])
    check_dist(p1, p2)
  }

  assert_eq(intersections.len(), intersection_count)
}

function check_dist(p1: Point, p2: Point) {
  let dist = Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y))
  if (dist > 0.5) {
    assert(
      false,
      `Intersection points too far apart.
p1: {:?}
p2: {:?}`,
      p1,
      p2
    )
  }
}

describe('cubic_intersections', () => {
  test('cubic_curve_curve_intersections', () => {
    do_test(
      new CubicBezierSegment(point(0, 0), point(0, 1), point(0, 1), point(1, 1)),
      new CubicBezierSegment(point(0, 1), point(1, 1), point(1, 1), point(1, 0)),
      1
    )
    do_test(
      new CubicBezierSegment(point(48, 84), point(104, 176), point(190, 37), point(121, 75)),
      new CubicBezierSegment(point(68, 145), point(74, 6), point(143, 197), point(138, 55)),
      4
    )
    do_test(
      new CubicBezierSegment(point(0, 0), point(0.5, 1), point(0.5, 1), point(1, 0)),
      new CubicBezierSegment(point(0, 1), point(0.5, 0), point(0.5, 0), point(1, 1)),
      2
    )
    do_test(
      new CubicBezierSegment(point(0.2, 0), point(0.5, 3), point(0.5, -2), point(0.8, 1)),
      new CubicBezierSegment(point(0, 0), point(2.5, 0.5), point(-1.5, 0.5), point(1, 0)),
      9
    )
    do_test(
      new CubicBezierSegment(
        point(718133.1363092018, 673674.987999388),
        point(-53014.13135835016, 286988.87959900266),
        point(-900630.1880107201, -7527.6889376943),
        point(417822.48349384824, -149039.14932848653)
      ),
      new CubicBezierSegment(
        point(924715.3309247112, 719414.5221912428),
        point(965365.9679664494, -563421.3040676294),
        point(273552.85484064696, 643090.0890117711),
        point(-113963.134524995, 732017.9466050486)
      ),
      1
    )
    do_test(
      new CubicBezierSegment(
        point(423394.5967598548, -91342.7434613118),
        point(333212.450870987, 225564.45711810607),
        point(668108.668469816, -626100.8367380127),
        point(-481885.0610437216, 893767.5320803947)
      ),
      new CubicBezierSegment(
        point(-484505.2601961801, -222621.44229855016),
        point(22432.829984141514, -944727.7102144773),
        point(-433294.66549074976, -168018.60431004688),
        point(567688.5977972192, 13975.09633399453)
      ),
      3
    )
  })

  test('cubic_control_point_touching', () => {
    do_test(
      new CubicBezierSegment(point(-1, 0), point(0, 0), point(-1, -0.1), point(-1, -0.1)),
      new CubicBezierSegment(point(0, 0), point(5, -5), point(-5, -5), point(0, 0)),
      0
    )
  })

  test('cubic_self_intersections', () => {
    // Two self-intersecting curves intersecting at their self-intersections
    // (the origin).
    do_test(
      new CubicBezierSegment(
        point(-10.0, -13.636363636363636),
        point(15.0, 11.363636363636363),
        point(-15.0, 11.363636363636363),
        point(10.0, -13.636363636363636)
      ),
      new CubicBezierSegment(
        point(13.636363636363636, -10.0),
        point(-11.363636363636363, 15.0),
        point(-11.363636363636363, -15.0),
        point(13.636363636363636, 10.0)
      ),
      4
    )
  })

  test('cubic_loops', () => {
    // This gets up to a recursion count of 53 trying to find (0.0, 0.0) and (1.0, 1.0) (which
    // aren't actually needed) - with the curves in the opposite order it gets up to 81!
    do_test(
      new CubicBezierSegment(point(0, 0), point(-10, 10), point(10, 10), point(0, 0)),
      new CubicBezierSegment(point(0, 0), point(-1, 1), point(1, 1), point(0, 0)),
      0
    )

    do_test(
      new CubicBezierSegment(point(0, 0), point(-100, 0), point(-500, 500), point(0, 0)),
      new CubicBezierSegment(point(0, 0), point(-800, 100), point(500, 500), point(0, 0)),
      3
    )
  })

  test('cubic_line_curve_intersections', () => {
    do_test(
      new CubicBezierSegment(
        /* line */
        point(1, 2),
        point(20, 1),
        point(1, 2),
        point(20, 1)
      ),
      new CubicBezierSegment(point(1, 0), point(1, 5), point(20, 25), point(20, 0)),
      2
    )
    do_test(
      new CubicBezierSegment(
        /* line */
        point(0, 0),
        point(-10, 0),
        point(20, 0),
        point(10, 0)
      ),
      new CubicBezierSegment(point(-1, -1), point(0, 4), point(10, -4), point(11, 1)),
      5
    )
    do_test(
      new CubicBezierSegment(point(-1, -2), point(-1, 8), point(1, -8), point(1, 2)),
      new CubicBezierSegment(
        /* line */
        point(-10, -10),
        point(20, 20),
        point(-20, -20),
        point(10, 10)
      ),
      9
    )
  })

  test('cubic_line_line_intersections', () => {
    do_test(
      new CubicBezierSegment(
        /* line */
        point(-10, -10),
        point(20, 20),
        point(-20, -20),
        point(10, 10)
      ),
      new CubicBezierSegment(point(-10, 10), point(20, -20), point(-20, 20), point(10, -10)),
      9
    )

    // Overlapping line segments should return 0 intersections
    do_test(
      new CubicBezierSegment(
        /* line */
        point(0, 0),
        point(0, 0),
        point(10, 0),
        point(10, 0)
      ),
      new CubicBezierSegment(point(5, 0), point(5, 0), point(15, 0), point(15, 0)),
      0
    )
  })

  test('cubic_similar_loops', () => {
    do_test(
      new CubicBezierSegment(
        point(-0.281604145719379, -0.3129629924180608),
        point(-0.04393998118946163, 0.13714701102906668),
        point(0.4472584256288119, 0.2876115686206546),
        point(-0.281604145719379, -0.3129629924180608)
      ),
      new CubicBezierSegment(
        point(-0.281604145719379, -0.3129629924180608),
        point(-0.1560415754252551, -0.22924729391648402),
        point(-0.9224550447067958, 0.19110227764357646),
        point(-0.281604145719379, -0.3129629924180608)
      ),
      2
    )
  })

  test('cubic_no_duplicated_root', () => {
    do_test(
      new CubicBezierSegment(point(0, 0), point(-10, 1), point(10, 1), point(0, 0)),
      new CubicBezierSegment(point(0, 0), point(-1, 1), point(1, 1), point(0, 0)),
      1
    )
  })

  test('cubic_glancing_intersection', () => {
    should_panic(() => {
      do_test(
        new CubicBezierSegment(point(0, 0), point(0, 8), point(10, 8), point(10, 0)),
        new CubicBezierSegment(point(0, 12), point(0, 4), point(10, 4), point(10, 12)),
        1
      )
    })
  })

  test('cubic_duplicated_intersections', () => {
    do_test(
      new CubicBezierSegment(
        point(-33307.36, -1804.0625),
        point(-59259.727, 70098.31),
        point(98661.78, 48235.703),
        point(28422.234, 31845.219)
      ),
      new CubicBezierSegment(
        point(-21501.133, 51935.344),
        point(-95301.96, 95031.45),
        point(-25882.242, -12896.75),
        point(94618.97, 94288.66)
      ),
      2
    )
  })

  test('cubic_endpoint_not_an_intersection', () => {
    do_test(
      new CubicBezierSegment(
        point(76868.875, 47679.28),
        point(65326.86, 856.21094),
        point(-85621.64, -80823.375),
        point(-56517.53, 28062.227)
      ),
      new CubicBezierSegment(
        point(-67977.72, 77673.53),
        point(-59829.57, -41917.87),
        point(57.4375, 52822.97),
        point(51075.86, 85772.84)
      ),
      0
    )
  })

  // The endpoints of curve2 intersect the interior of curve1.
  test('cubic_interior_endpoint', () => {
    do_test(
      new CubicBezierSegment(point(-5, 0), point(-5, 8), point(5, 8), point(5, 0)),
      new CubicBezierSegment(point(0, 6), point(-5, 0), point(5, 0), point(0, 6)),
      2
    )
  })

  test('cubic_point_curve_intersections', () => {
    let epsilon = 1e-5
    {
      let curve1 = new CubicBezierSegment(point(0, 0), point(0, 1), point(0, 1), point(1, 1))
      let sample_t = 0.123456789
      let pt = curve1.sample(sample_t)
      let curve2 = new CubicBezierSegment(pt, pt, pt, pt)
      let intersections = cubic_bezier_intersections_t(curve1, curve2)
      assert_eq(intersections.len(), 1)
      let intersection_t = intersections.get_unchecked(0)[0]
      assert(Math.abs(intersection_t - sample_t) < epsilon)
    }
    {
      let curve1 = new CubicBezierSegment(
        point(-10.0, -13.636363636363636),
        point(15.0, 11.363636363636363),
        point(-15.0, 11.363636363636363),
        point(10.0, -13.636363636363636)
      )
      // curve1 has a self intersection at the following parameter values:
      let parameter1 = 0.7611164839335472
      let parameter2 = 0.23888351606645375
      let pt = curve1.sample(parameter1)
      let curve2 = new CubicBezierSegment(pt, pt, pt, pt)
      let intersections = cubic_bezier_intersections_t(curve1, curve2)
      assert_eq(intersections.len(), 2)
      let intersection_t1 = intersections.get_unchecked(0)[0]
      let intersection_t2 = intersections.get_unchecked(1)[0]
      assert(Math.abs(intersection_t1 - parameter1) < epsilon)
      assert(Math.abs(intersection_t2 - parameter2) < epsilon)
    }
    {
      let curve1 = new CubicBezierSegment(
        point(0, 0),
        point(50, 50),
        point(-50, -50),
        point(10, 10)
      )
      // curve1 is a line that passes through (5, 5) three times:
      let parameter1 = 0.96984464
      let parameter2 = 0.037427425
      let parameter3 = 0.44434106
      let pt = curve1.sample(parameter1)
      let curve2 = new CubicBezierSegment(pt, pt, pt, pt)
      let intersections = cubic_bezier_intersections_t(curve1, curve2)
      assert_eq(intersections.len(), 3)
      let intersection_t1 = intersections.get_unchecked(0)[0]
      let intersection_t2 = intersections.get_unchecked(1)[0]
      let intersection_t3 = intersections.get_unchecked(2)[0]
      assert(Math.abs(intersection_t1 - parameter1) < epsilon)
      assert(Math.abs(intersection_t2 - parameter2) < epsilon)
      assert(Math.abs(intersection_t3 - parameter3) < epsilon)
    }
  })

  test('cubic_subcurve_intersections', () => {
    let curve1 = new CubicBezierSegment(point(0, 0), point(0, 1), point(0, 1), point(1, 1))
    let curve2 = curve1.split_range(range(0.25, 0.75))
    // The algorithm will find as many intersections as you let it, basically -
    // make sure we're not allowing too many intersections to be added, and not
    // crashing on out of resources.
    do_test(curve1, curve2, 9)
  })

  test('cubic_result_distance', () => {
    do_test(
      new CubicBezierSegment(
        point(5893.133, -51377.152),
        point(-94403.984, 37668.156),
        point(-58914.684, 30339.195),
        point(4895.875, 83473.3)
      ),
      new CubicBezierSegment(
        point(-51523.734, 75047.05),
        point(-58162.76, -91093.875),
        point(82137.516, -59844.35),
        point(46856.406, 40479.64)
      ),
      3
    )
  })
})

function assert_approx_eq(a: Point[], b: Point[]) {
  assert_eq(a.len(), b.len())
  for (let i of range(0, a.len())) {
    if (Math.abs(a[i].x - b[i].x) > 0.0000001 || Math.abs(a[i].y - b[i].y) > 0.0000001) {
      assert(
        false,
        `assertion failed: (left.approx_eq(right))
 left: {:?}
right: {:?}`,
        a,
        b
      )
    }
  }
}

describe('flatten_cubic', () => {
  test('iterator_builder_1', () => {
    let tolerance = 0.01
    let c1 = new CubicBezierSegment(point(0, 0), point(1, 0), point(1, 1), point(0, 1))
    let iter_points = c1.flattened(tolerance).collect()
    let builder_points: Point[] = []
    c1.for_each_flattened(tolerance, (p: Point) => {
      builder_points.push(p)
    })

    let len = iter_points.len()
    assert(
      len > 2,
      `assertion failed: len > 2
len: {:?}`,
      len
    )
    assert_approx_eq(iter_points.slice(), builder_points.slice())
  })

  test('iterator_builder_2', () => {
    let tolerance = 0.01
    let c1 = new CubicBezierSegment(point(0, 0), point(1, 0), point(0, 1), point(1, 1))
    let iter_points = c1.flattened(tolerance).collect()
    let builder_points: Point[] = []
    c1.for_each_flattened(tolerance, (p: Point) => {
      builder_points.push(p)
    })

    let len = iter_points.len()
    assert(
      len > 2,
      `assertion failed: len > 2
len: {:?}`,
      len
    )
    assert_approx_eq(iter_points.slice(), builder_points.slice())
  })

  test('iterator_builder_3', () => {
    let tolerance = 0.01
    let c1 = new CubicBezierSegment(
      point(141, 135),
      point(141, 130),
      point(140, 130),
      point(131, 130)
    )
    let iter_points = c1.flattened(tolerance).collect()
    let builder_points: Point[] = []
    c1.for_each_flattened(tolerance, (p: Point) => {
      builder_points.push(p)
    })

    let len = iter_points.len()
    assert(
      len > 2,
      `assertion failed: len > 2
len: {:?}`,
      len
    )
    assert_approx_eq(iter_points.slice(), builder_points.slice())
  })

  test('iterator_builder_4', () => {
    let tolerance = 0.01
    let c1 = new CubicBezierSegment(
      point(11.71726, 9.07143),
      point(1.889879, 13.22917),
      point(18.142855, 19.27679),
      point(18.142855, 19.27679)
    )
    let iter_points = c1.flattened(tolerance).collect()
    let builder_points: Point[] = []
    c1.for_each_flattened(tolerance, (p: Point) => {
      builder_points.push(p)
    })

    assert_approx_eq(iter_points.slice(), builder_points.slice())

    let len = iter_points.len()
    assert(
      len > 1,
      `assertion failed: len > 2
len: {:?}`,
      len
    )
  })

  test('segment_for_each_flattened', () => {
    let segment = new CubicBezierSegment(point(0, 0), point(0, 0), point(50, 70), point(100, 100))

    let points: Point[] = []
    segment.for_each_flattened(0.1, (p: Point) => {
      points.push(p)
    })

    let len = points.len()
    assert(
      len > 2,
      `assertion failed: len > 2
len: {:?}`,
      len
    )
  })
})
