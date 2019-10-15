import {
  Self,
  Clone,
  Debug,
  Display,
  format,
  IteratorBase,
  ImplPartialEq,
  Option,
  OptionType,
  Some,
  None,
  Range,
  range,
  assert,
  debug_assert,
  abstract_panic,
  maxnum,
  minnum
} from "@rusts/std";
import { ArrayVec } from "@rusts/arrayvec";
import {
  // line.ts
  BezierSegment,
  Line,
  LineSegment,
  LineEquation,
  // scalar.ts
  Scalar,
  EPSILON,
  // point.ts
  Point,
  point,
  midpoint,
  // rect.ts
  Rect,
  rect,
  // transform.ts
  Transform2D,
  // triangle.ts
  Triangle,
  triangle,
  // vector.ts
  Vector,
  // monotonic.ts
  MonotonicQuadraticBezierSegment,
  MonotonicCubicBezierSegment,
  // segment.ts
  SegmentFlattenedForEach,
  SegmentWithFlatteningStep,
  BoundingRect,
  Flattened,
  approx_length_from_flattening,
  // utils.ts
  min_max,
  cubic_polynomial_roots
} from "./internal";

export class FlattenedCubic<U = any> extends IteratorBase<Point<U>> {
  public Self!: FlattenedCubic<U>;

  public remaining_curve: CubicBezierSegment<U>;
  public current_curve: Option<CubicBezierSegment<U>>;
  public next_inflection: Option<Scalar>;
  public following_inflection: Option<Scalar>;
  public tolerance: Scalar;
  public check_inflection: boolean;
  public _unit!: U;

  public constructor(bezier: CubicBezierSegment<U>, tolerance: Scalar) {
    super();
    let inflections = new ArrayVec<Scalar>(2);
    find_cubic_bezier_inflection_points(bezier, (t: Scalar) => {
      inflections.push(t);
    });

    this.remaining_curve = bezier;
    this.current_curve = None();
    (this.next_inflection = inflections.get(0).cloned()),
      (this.following_inflection = inflections.get(1).cloned()),
      (this.tolerance = tolerance);
    this.check_inflection = false;

    let first_inflection = inflections.get(0);
    if (first_inflection.is_some()) {
      let t1 = first_inflection.unwrap();
      let [before, after] = bezier.split(t1);
      this.current_curve = Some(before);
      this.remaining_curve = after;
      inflections.get(1).map((t2: Scalar) => {
        t2 = (t2 - t1) / (1 - t1);
        this.following_inflection = Some(t2);
      });
      return;
    }

    this.current_curve = Some(bezier);
  }

  // Iterator
  public Item!: Point<U>;

  public next(): Option<this["Item"]> {
    if (this.current_curve.is_none() && this.next_inflection.is_some()) {
      if (this.following_inflection.is_some()) {
        let t2 = this.following_inflection.unwrap();
        let [before, after] = this.remaining_curve.split(t2);
        this.current_curve = Some(before);
        this.remaining_curve = after;
      } else {
        // The last chunk doesn't have inflection points, use it.
        this.current_curve = Some(this.remaining_curve);
      }

      // Pop the inflection stack.
      this.next_inflection = this.following_inflection;
      this.following_inflection = None();
      this.check_inflection = true;
    }

    if (this.current_curve.is_some()) {
      let sub_curve = this.current_curve.unwrap();
      if (this.check_inflection) {
        this.check_inflection = false;
        let r = inflection_approximation_range(sub_curve, this.tolerance);
        if (r.is_some()) {
          let tf = r.unwrap();
          let next = sub_curve.after_split(tf);
          this.current_curve = Some(next);
          return Some(next.start);
        }
      }

      // We are iterating over a sub-curve that does not have inflections
      let t = no_inflection_flattening_step(sub_curve, this.tolerance);
      if (t >= 1) {
        let to = sub_curve.end;
        this.current_curve = None();
        return Some(to);
      }

      let next_curve = sub_curve.after_split(t);
      this.current_curve = Some(next_curve);
      return Some(next_curve.start);
    }

    return None();
  }
}

export function flatten_cubic_bezier<U = any>(
  bezier: CubicBezierSegment<U>,
  tolerance: Scalar,
  callback: (p: Point<U>) => void
) {
  let inflections = new ArrayVec<Scalar>(2);
  find_cubic_bezier_inflection_points(bezier, t => {
    inflections.push(t);
  });

  let first_inflection = inflections.get(0);
  if (first_inflection.is_some()) {
    let t1 = first_inflection.unwrap();
    bezier = flatten_including_inflection(bezier, t1, tolerance, callback);
    let second_inflection = inflections.get(1);
    if (second_inflection.is_some()) {
      let t2 = second_inflection.unwrap();
      // Adjust the second inflection since we removed the part before the first
      // inflection from the bezier curve.
      t2 = (t2 - t1) / (1 - t1);
      bezier = flatten_including_inflection(bezier, t2, tolerance, callback);
    }
  }

  flatten_cubic_no_inflection(bezier, tolerance, callback);
}

// Flatten the curve up to the the inflection point and its approximation range included.
function flatten_including_inflection<U = any>(
  bezier: CubicBezierSegment<U>,
  up_to_t: Scalar,
  tolerance: Scalar,
  callback: (p: Point<U>) => void
): CubicBezierSegment<U> {
  let [before, after] = bezier.split(up_to_t);
  flatten_cubic_no_inflection(before, tolerance, callback);

  let r = inflection_approximation_range(after, tolerance);
  if (r.is_some()) {
    let tf = r.unwrap();
    after = after.after_split(tf);
    callback(after.start);
  }

  return after;
}

// The algorithm implemented here is based on:
// http://cis.usouthal.edu/~hain/general/Publications/Bezier/Bezier%20Offset%20Curves.pdf
//
// The basic premise is that for a small t the third order term in the
// equation of a cubic bezier curve is insignificantly small. This can
// then be approximated by a quadratic equation for which the maximum
// difference from a linear approximation can be much more easily determined.
function flatten_cubic_no_inflection<U = any>(
  bezier: CubicBezierSegment<U>,
  tolerance: Scalar,
  callback: (p: Point<U>) => void
) {
  let end = bezier.end;

  let t = 0;
  while (t < 1) {
    t = no_inflection_flattening_step(bezier, tolerance);

    if (t === 1) {
      break;
    }
    bezier = bezier.after_split(t);
    callback(bezier.start);
  }

  callback(end);
}

function no_inflection_flattening_step(bezier: CubicBezierSegment, tolerance: Scalar): Scalar {
  let v1 = bezier.ctrl1.sub(bezier.start);
  let v2 = bezier.ctrl2.sub(bezier.start);

  // This function assumes that the bezier segment is not starting at an
  // inflection point. otherwise the following cross product may result in very
  // small numbers which will hit floating point precision issues.
  //
  // To remove divisions and check for divide-by-zero, this is optimized from:
  // s2 = (v2.x * v1.y - v2.y * v1.x) / Math.hypot(v1.x, v1.y)
  // t = 2 * Math.sqrt(tolerance / (3 * Math.abs(s2)))
  let v2_cross_v1 = v2.cross(v1);
  if (v2_cross_v1 === 0) {
    return 1;
  }
  let s2inv = Math.hypot(v1.x, v1.y) / v2_cross_v1;

  let t = 2 * Math.sqrt((tolerance * Math.abs(s2inv)) / 3);

  // TODO: We start having floating point precision issues if this constant is
  // closer to 1.0 with a small enough tolerance threshold.
  if (t >= 0.995 || t === 0) {
    return 1;
  }

  return t;
}

export function find_cubic_bezier_inflection_points<U = any>(
  bezier: CubicBezierSegment<U>,
  callback: (s: Scalar) => void
) {
  // Find inflection points
  // See www.faculty.idc.ac.il/arik/quality/appendixa.html for an explanation
  // of this approach.
  let pa = bezier.ctrl1.sub(bezier.start);
  let pb = bezier.ctrl2
    .to_vector()
    .sub(bezier.ctrl1.to_vector().mul(2))
    .add(bezier.start.to_vector());
  let pc = bezier.end
    .to_vector()
    .sub(bezier.ctrl2.to_vector().mul(3))
    .add(bezier.ctrl1.to_vector().mul(3))
    .sub(bezier.start.to_vector());

  let a = pb.cross(pc);
  let b = pa.cross(pc);
  let c = pa.cross(pb);

  const in_range = (t: Scalar): boolean => {
    return t >= 0 && t < 1;
  };

  if (Math.abs(a) < EPSILON) {
    // Not a quadratic equation
    if (Math.abs(b) < EPSILON) {
      // Instead of a linear acceleration change we have a constant
      // acceleration change. this means the equation has no solution
      // and there are no inflection points, unless the constant is 0.
      // in that case the curve is a straight line, essentially that means
      // the easiest way to deal with it is by saying there's an inflection
      // point at t == 0. the inflection point approximation range found will
      // automatically extend into infinity.
      if (Math.abs(c) < EPSILON) {
        callback(0);
      }
    } else {
      let t = -c / b;
      if (in_range(t)) {
        callback(t);
      }
    }

    return;
  }

  let discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return;
  }

  if (discriminant < EPSILON) {
    let t = -b / (2 * a);

    if (in_range(t)) {
      callback(t);
    }

    return;
  }

  // This code is derived from https://www2.units.it/ipl/students_area/imm2/files/Numerical_Recipes.pdf page 184.
  // Computing the roots this way avoids precision issues when a, c or both are small.
  let discriminant_sqrt = Math.sqrt(discriminant);
  let sign_b = Math.sign(b);
  let q = -0.5 * (b + sign_b * discriminant_sqrt);
  let first_inflection = q / a;
  let second_inflection = c / q;

  if (first_inflection > second_inflection) {
    [first_inflection, second_inflection] = [second_inflection, first_inflection];
  }

  if (in_range(first_inflection)) {
    callback(first_inflection);
  }

  if (in_range(second_inflection)) {
    callback(second_inflection);
  }
}

// Find the range around the start of the curve where the curve can locally be approximated
// with a line segment, given a tolerance threshold.
function inflection_approximation_range(
  bezier: CubicBezierSegment,
  tolerance: Scalar
): Option<Scalar> {
  // Transform the curve such that it starts at the origin
  let p1 = bezier.ctrl1.sub(bezier.start);
  let p2 = bezier.ctrl2.sub(bezier.start);
  let p3 = bezier.end.sub(bezier.start);

  // Thus, curve(t) = t^3 * (3*p1 - 3*p2 + p3) + t^2 * (-6*p1 + 3*p2) + t * (3*p1).
  // Since curve(0) is an inflection point, cross(p1, p2) = 0, i.e. p1 and p2 are parallel.

  // Let s(t) = s3 * t^3 be the (signed) perpendicular distance of curve(t) from a line that will be determined below.
  let s3: Scalar;
  if (Math.abs(p1.x) < EPSILON && Math.abs(p1.y) < EPSILON) {
    // Assume p1 = 0
    if (Math.abs(p2.x) < EPSILON && Math.abs(p2.y) < EPSILON) {
      // Assume p2 = 0
      // The curve itself is a line or a point
      return None();
    } else {
      // In this case p2 is away from zero.
      // Choose the line in direction p2.
      s3 = p2.cross(p3) / p2.length();
    }
  } else {
    // In this case p1 is away from zero.
    // Choose the line in direction p1 and use that p1 and p2 are parallel.
    s3 = p1.cross(p3) / p1.length();
  }

  // Calculate the maximal t value such that the (absolute) distance is within
  // the tolerance.
  let tf = Math.pow(Math.abs(tolerance / s3), 1 / 3);

  return tf < 1 ? Some(tf) : None();
}

/**
 * A 2d curve segment defined by four points: the beginning of the segment, two control
 * points and the end of the segment.
 *
 * The curve is defined by equation:²
 * ```∀ t ∈ [0..1],  P(t) = (1 - t)³ * from + 3 * (1 - t)² * t * ctrl1 + 3 * t² * (1 - t) * ctrl2 + t³ * to```
 */
export class CubicBezierSegment<U = any> extends ImplPartialEq(SegmentFlattenedForEach)
  implements BoundingRect, Clone, Debug, Display {
  public Self!: CubicBezierSegment<U>;

  public start: Point<U>;
  public ctrl1: Point<U>;
  public ctrl2: Point<U>;
  public end: Point<U>;
  public _unit!: U;

  public constructor(start: Point<U>, ctrl1: Point<U>, ctrl2: Point<U>, end: Point<U>) {
    super();
    this.start = start;
    this.ctrl1 = ctrl1;
    this.ctrl2 = ctrl2;
    this.end = end;
  }

  // Start of the curve
  public from(): Point<U> {
    return this.start.clone();
  }

  // End of the curve
  public to(): Point<U> {
    return this.end.clone();
  }

  // Sample the curve at t (expecting t between 0 and 1
  public sample(t: Scalar): Point<U> {
    let t2 = t * t;
    let t3 = t2 * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;
    let one_t3 = one_t2 * one_t;
    return this.start
      .mul(one_t3)
      .add(this.ctrl1.to_vector().mul(3 * one_t2 * t))
      .add(this.ctrl2.to_vector().mul(3 * one_t * t2))
      .add(this.end.to_vector().mul(t3));
  }

  // Sample the x coordinate of the curve at t (expecting t between 0 and 1)
  public x(t: Scalar): Scalar {
    let t2 = t * t;
    let t3 = t2 * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;
    let one_t3 = one_t2 * one_t;
    return (
      this.start.x * one_t3 +
      this.ctrl1.x * 3 * one_t2 * t +
      this.ctrl2.x * 3 * one_t * t2 +
      this.end.x * t3
    );
  }

  // Sample the y coordinate of the curve at t (expecting t between 0 and 1)
  public y(t: Scalar): Scalar {
    let t2 = t * t;
    let t3 = t2 * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;
    let one_t3 = one_t2 * one_t;
    return (
      this.start.y * one_t3 +
      this.ctrl1.y * 3 * one_t2 * t +
      this.ctrl2.y * 3 * one_t * t2 +
      this.end.y * t3
    );
  }

  // Return the parameter values corresponding to a given x coordinate.
  // See also solve_t_for_x for monotonic curves.
  public solve_t_for_x(x: Scalar): ArrayVec<Scalar /*; 3*/> {
    if (this.is_a_point(0) || (this.non_point_is_linear(0) && this.start.x === this.end.x)) {
      return new ArrayVec(3);
    }

    return this.parameters_for_xy_value(x, this.start.x, this.ctrl1.x, this.ctrl2.x, this.end.x);
  }

  // Return the parameter values corresponding to a given y coordinate.
  // See also solve_t_for_y for monotonic curves.
  public solve_t_for_y(y: Scalar): ArrayVec<Scalar /*; 3*/> {
    if (this.is_a_point(0) || (this.non_point_is_linear(0) && this.start.y === this.end.y)) {
      return new ArrayVec(3);
    }

    return this.parameters_for_xy_value(y, this.start.y, this.ctrl1.y, this.ctrl2.y, this.end.y);
  }

  private parameters_for_xy_value(
    value: Scalar,
    from: Scalar,
    ctrl1: Scalar,
    ctrl2: Scalar,
    to: Scalar
  ): ArrayVec<Scalar /*; 3*/> {
    let result = new ArrayVec<Scalar>(3);

    let a = -from + 3 * ctrl1 - 3 * ctrl2 + to;
    let b = 3 * from - 6 * ctrl1 + 3 * ctrl2;
    let c = -3 * from + 3 * ctrl1;
    let d = from - value;

    let roots = cubic_polynomial_roots(a, b, c, d);
    for (let root of roots) {
      if (root > 0 && root < 1) {
        result.push(root);
      }
    }

    return result;
  }

  private derivative_coefficients(t: Scalar): [Scalar, Scalar, Scalar, Scalar] {
    let t2 = t * t;
    return [-3 * t2 + 6 * t - 3, 9 * t2 - 12 * t + 3, -9 * t2 + 6 * t, 3 * t2];
  }

  // Sample derivative at t (expecting t between 0 and 1
  public derivative(t: Scalar): Vector {
    let [c0, c1, c2, c3] = this.derivative_coefficients(t);
    return this.start
      .to_vector()
      .mul(c0)
      .add(this.ctrl1.to_vector().mul(c1))
      .add(this.ctrl2.to_vector().mul(c2))
      .add(this.end.to_vector().mul(c3));
  }

  // Sample x derivative at t (expecting t between 0 and 1)
  public dx(t: Scalar): Scalar {
    let [c0, c1, c2, c3] = this.derivative_coefficients(t);
    return this.start.x * c0 + this.ctrl1.x * c1 + this.ctrl2.x * c2 + this.end.x * c3;
  }

  // Sample y derivative at t (expecting t between 0 and 1)
  public dy(t: Scalar): Scalar {
    let [c0, c1, c2, c3] = this.derivative_coefficients(t);
    return this.start.y * c0 + this.ctrl1.y * c1 + this.ctrl2.y * c2 + this.end.y * c3;
  }

  // Return the curve inside a given range of t
  //
  // This is equivalent to splitting at the range's end points.
  public split_range(t_range: Range<number>): CubicBezierSegment<U> {
    let t0 = t_range.start;
    let t1 = t_range.end;
    let from = this.sample(t0);
    let to = this.sample(t1);

    let d = new QuadraticBezierSegment(
      this.ctrl1.sub(this.start).to_point(),
      this.ctrl2.sub(this.ctrl1).to_point(),
      this.end.sub(this.ctrl2).to_point()
    );

    let dt = t1 - t0;
    let ctrl1 = from.add(
      d
        .sample(t0)
        .to_vector()
        .mul(dt)
    );
    let ctrl2 = to.sub(
      d
        .sample(t1)
        .to_vector()
        .mul(dt)
    );

    return new CubicBezierSegment(from, ctrl1, ctrl2, to);
  }

  // Split the curve into two sub-curves
  public split(t: Scalar): [CubicBezierSegment<U>, CubicBezierSegment<U>] {
    let ctrl1a = this.start.add(this.ctrl1.sub(this.start).mul(t));
    let ctrl2a = this.ctrl1.add(this.ctrl2.sub(this.ctrl1).mul(t));
    let ctrl1aa = ctrl1a.add(ctrl2a.sub(ctrl1a).mul(t));
    let ctrl3a = this.ctrl2.add(this.end.sub(this.ctrl2).mul(t));
    let ctrl2aa = ctrl2a.add(ctrl3a.sub(ctrl2a).mul(t));
    let ctrl1aaa = ctrl1aa.add(ctrl2aa.sub(ctrl1aa).mul(t));

    return [
      new CubicBezierSegment(this.from(), ctrl1a, ctrl1aa, ctrl1aaa),
      new CubicBezierSegment(ctrl1aaa, ctrl2aa, ctrl3a, this.to())
    ];
  }

  // Return the curve before the split point
  public before_split(t: Scalar): CubicBezierSegment<U> {
    let ctrl1a = this.start.add(this.ctrl1.sub(this.start).mul(t));
    let ctrl2a = this.ctrl1.add(this.ctrl2.sub(this.ctrl1).mul(t));
    let ctrl1aa = ctrl1a.add(ctrl2a.sub(ctrl1a).mul(t));
    let ctrl3a = this.ctrl2.add(this.end.sub(this.ctrl2).mul(t));
    let ctrl2aa = ctrl2a.add(ctrl3a.sub(ctrl2a).mul(t));
    let ctrl1aaa = ctrl1aa.add(ctrl2aa.sub(ctrl1aa).mul(t));

    return new CubicBezierSegment(this.from(), ctrl1a, ctrl1aa, ctrl1aaa);
  }

  // Return the curve after the split point
  public after_split(t: Scalar): CubicBezierSegment<U> {
    let ctrl1a = this.start.add(this.ctrl1.sub(this.start).mul(t));
    let ctrl2a = this.ctrl1.add(this.ctrl2.sub(this.ctrl1).mul(t));
    let ctrl1aa = ctrl1a.add(ctrl2a.sub(ctrl1a).mul(t));
    let ctrl3a = this.ctrl2.add(this.end.sub(this.ctrl2).mul(t));
    let ctrl2aa = ctrl2a.add(ctrl3a.sub(ctrl2a).mul(t));
    let ctrl1aaa = ctrl1aa.add(ctrl2aa.sub(ctrl1aa).mul(t));

    return new CubicBezierSegment(
      ctrl1aa.add(ctrl2aa.sub(ctrl1aa).mul(t)),
      ctrl2a.add(ctrl3a.sub(ctrl2a).mul(t)),
      ctrl3a,
      this.to()
    );
  }

  public baseline(): LineSegment {
    return new LineSegment(this.from(), this.to());
  }

  public is_linear(tolerance: Scalar): boolean {
    if (this.start.sub(this.end).square_length() < EPSILON) {
      return false;
    }

    return this.non_point_is_linear(tolerance);
  }

  private non_point_is_linear(tolerance: Scalar): boolean {
    let line = this.baseline()
      .to_line()
      .equation();
    return (
      line.distance_to_point(this.ctrl1) <= tolerance &&
      line.distance_to_point(this.ctrl2) <= tolerance
    );
  }

  public is_a_point(tolerance: Scalar): boolean {
    let tolerance_squared = tolerance * tolerance;
    // Use <= so that tolerance can be zero
    return (
      this.start.sub(this.end).square_length() <= tolerance_squared &&
      this.start.sub(this.ctrl1).square_length() <= tolerance_squared &&
      this.end.sub(this.ctrl2).square_length() <= tolerance_squared
    );
  }

  public fat_line_min_max(): [Scalar, Scalar] {
    let baseline = this.baseline()
      .to_line()
      .equation();
    let [d1, d2] = min_max(
      baseline.signed_distance_to_point(this.ctrl1),
      baseline.signed_distance_to_point(this.ctrl2)
    );

    let factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9;

    let d_min = factor * minnum(d1, 0);
    let d_max = factor * maxnum(d2, 0);

    return [d_min, d_max];
  }

  public fat_line(): [LineEquation, LineEquation] {
    let baseline = this.baseline()
      .to_line()
      .equation();
    let [d1, d2] = this.fat_line_min_max();

    return [baseline.offset(d1), baseline.offset(d2)];
  }

  public transform(transform: Transform2D): CubicBezierSegment<U> {
    return new CubicBezierSegment(
      transform.transform_point(this.start),
      transform.transform_point(this.ctrl1),
      transform.transform_point(this.ctrl2),
      transform.transform_point(this.end)
    );
  }

  // Swap the direction of the segment
  public flip(): CubicBezierSegment<U> {
    return new CubicBezierSegment(this.to(), this.ctrl2.clone(), this.ctrl1.clone(), this.from());
  }

  public flattened(tolerance: Scalar): FlattenedCubic<U> {
    return new FlattenedCubic(this, tolerance);
  }

  public for_each_monotonic_t(callback: (s: Scalar) => void) {
    let x_extrema = new ArrayVec<Scalar>(3);
    this.for_each_local_x_extremum_t(t => x_extrema.push(t));

    let y_extrema = new ArrayVec<Scalar>(3);
    this.for_each_local_y_extremum_t(t => y_extrema.push(t));

    let it_x = x_extrema.into_iter().cloned();
    let it_y = y_extrema.into_iter().cloned();
    let tx = it_x.next();
    let ty = it_y.next();
    do {
      let next = (() => {
        if (tx.is_some()) {
          let a = tx.unwrap();
          if (ty.is_some()) {
            let b = ty.unwrap();
            if (a < b) {
              tx = it_x.next();
              return a;
            } else {
              ty = it_y.next();
              return b;
            }
          }
          tx = it_x.next();
          return a;
        } else {
          if (ty.is_some()) {
            let b = ty.unwrap();
            ty = it_y.next();
            return b;
          }
          return 0;
        }
      })();
      if (next > 0 && next < 1) {
        return callback(next);
      }
    } while (true);
  }

  // Invokes a callback for each monotonic part of the segment..
  public for_each_monotonic_range(callback: (r: Range<number>) => void) {
    let t0 = 0;
    this.for_each_monotonic_t((t: Scalar) => {
      callback(range(t0, t));
      t0 = t;
    });
    callback(range(t0, 1));
  }

  // Approximates the cubic bézier curve with sequence of quadratic ones,
  // invoking a callback at each step.
  public for_each_quadratic_bezier(tolerance: Scalar, cb: (s: QuadraticBezierSegment) => void) {
    cubic_to_quadratics(this, tolerance, cb);
  }

  // Approximates the cubic bézier curve with sequence of monotonic quadratic
  // ones, invoking a callback at each step.
  public for_each_monotonic_quadratic(
    tolerance: Scalar,
    cb: (s: MonotonicQuadraticBezierSegment) => void
  ) {
    cubic_to_monotonic_quadratics(this, tolerance, cb);
  }

  // Iterates through the curve invoking a callback at each point.
  public for_each_flattened(tolerance: Scalar, cb: (p: Point<U>) => void) {
    flatten_cubic_bezier(this, tolerance, cb);
  }

  // Compute the length of the segment using a flattened approximation
  public approx_length(tolerance: Scalar): Scalar {
    return approx_length_from_flattening(this, tolerance);
  }

  public for_each_inflection_t(cb: (s: Scalar) => void) {
    find_cubic_bezier_inflection_points(this, cb);
  }

  // Return local x extrema or None if this curve is monotonic.
  //
  // This returns the advancements along the curve, not the actual x position.
  public for_each_local_x_extremum_t(cb: (s: Scalar) => void) {
    this.for_each_local_extremum(this.start.x, this.ctrl1.x, this.ctrl2.x, this.end.x, cb);
  }

  // Return local y extrema or None if this curve is monotonic.
  //
  // This returns the advancements along the curve, not the actual y position.
  public for_each_local_y_extremum_t(cb: (s: Scalar) => void) {
    this.for_each_local_extremum(this.start.y, this.ctrl1.y, this.ctrl2.y, this.end.y, cb);
  }

  private for_each_local_extremum(
    p0: Scalar,
    p1: Scalar,
    p2: Scalar,
    p3: Scalar,
    callback: (s: Scalar) => void
  ) {
    // See www.faculty.idc.ac.il/arik/quality/appendixa.html for an explanation
    // The derivative of a cubic bezier curve is a curve representing a second degree polynomial function
    // f(x) = a * x² + b * x + c such as :

    let a = 3 * (p3 + 3 * (p1 - p2) - p0);
    let b = 6 * (p2 - 2 * p1 + p0);
    let c = 3 * (p1 - p0);

    const in_range = function(t: Scalar): boolean {
      return t > 0 && t < 1;
    };

    // If the derivative is a linear function
    if (a === 0) {
      if (b !== 0) {
        let t = -c / b;
        if (in_range(t)) {
          callback(t);
        }
      }
      return;
    }

    let discriminant = b * b - 4 * a * c;

    // There is no Real solution for the equation
    if (discriminant < 0) {
      return;
    }

    // There is one Real solution for the equation
    if (discriminant === 0) {
      let t = -b / (2 * a);
      if (in_range(t)) {
        callback(t);
      }
      return;
    }

    // There are two Real solutions for the equation
    let discriminant_sqrt = Math.sqrt(discriminant);

    let first_extremum = (-b - discriminant_sqrt) / (2 * a);
    let second_extremum = (-b + discriminant_sqrt) / (2 * a);

    if (in_range(first_extremum)) {
      callback(first_extremum);
    }

    if (in_range(second_extremum)) {
      callback(second_extremum);
    }
  }

  public y_maximum_t(): Scalar {
    let max_t = 0;
    let max_y = this.start.y;
    if (this.end.y > max_y) {
      max_t = 1;
      max_y = this.end.y;
    }
    this.for_each_local_y_extremum_t(t => {
      let y = this.y(t);
      if (y > max_y) {
        max_t = t;
        max_y = y;
      }
    });
    return max_t;
  }

  public y_minimum_t(): Scalar {
    let min_t = 0;
    let min_y = this.start.y;
    if (this.end.y < min_y) {
      min_t = 1;
      min_y = this.end.y;
    }
    this.for_each_local_y_extremum_t(t => {
      let y = this.y(t);
      if (y < min_y) {
        min_t = t;
        min_y = y;
      }
    });
    return min_t;
  }

  public x_maximum_t(): Scalar {
    let max_t = 0;
    let max_x = this.start.x;
    if (this.end.x > max_x) {
      max_t = 1;
      max_x = this.end.x;
    }
    this.for_each_local_x_extremum_t(t => {
      let x = this.x(t);
      if (x > max_x) {
        max_t = t;
        max_x = x;
      }
    });
    return max_t;
  }

  public x_minimum_t(): Scalar {
    let min_t = 0;
    let min_x = this.start.x;
    if (this.end.x < min_x) {
      min_t = 1;
      min_x = this.end.x;
    }
    this.for_each_local_x_extremum_t(t => {
      let x = this.x(t);
      if (x < min_x) {
        min_t = t;
        min_x = x;
      }
    });
    return min_t;
  }

  // Returns a rectangle that contains the curve
  //
  // This does not necessarily return the smallest possible bounding rectangle
  public fast_bounding_rect(): Rect {
    let [min_x, max_x] = this.fast_bounding_range_x();
    let [min_y, max_y] = this.fast_bounding_range_y();

    return rect(min_x, min_y, max_x - min_x, max_y - min_y);
  }

  // Returns a range of x values that contain the curve.
  public fast_bounding_range_x(): [Scalar, Scalar] {
    let min_x = minnum(minnum(minnum(this.start.x, this.ctrl1.x), this.ctrl2.x), this.end.x);
    let max_x = maxnum(maxnum(maxnum(this.start.x, this.ctrl1.x), this.ctrl2.x), this.end.x);

    return [min_x, max_x];
  }

  // Returns a range of y values that contain the curve.
  public fast_bounding_range_y(): [Scalar, Scalar] {
    let min_y = minnum(minnum(minnum(this.start.y, this.ctrl1.y), this.ctrl2.y), this.end.y);
    let max_y = maxnum(maxnum(maxnum(this.start.y, this.ctrl1.y), this.ctrl2.y), this.end.y);

    return [min_y, max_y];
  }

  // Returns a rectangle that contains the curve
  public bounding_rect(): Rect {
    let [min_x, max_x] = this.bounding_range_x();
    let [min_y, max_y] = this.bounding_range_y();

    return rect(min_x, min_y, max_x - min_x, max_y - min_y);
  }

  // Returns a range of x values that contain the curve.
  public bounding_range_x(): [Scalar, Scalar] {
    let min_x = this.x(this.x_minimum_t());
    let max_x = this.x(this.x_maximum_t());

    return [min_x, max_x];
  }

  // Returns a range of y values that contain the curve.
  public bounding_range_y(): [Scalar, Scalar] {
    let min_y = this.y(this.y_minimum_t());
    let max_y = this.y(this.y_maximum_t());

    return [min_y, max_y];
  }

  public assume_monotonic(): MonotonicCubicBezierSegment<U> {
    return new MonotonicCubicBezierSegment(this);
  }

  // Returns whether this segment is monotonic on the x axis.
  public is_x_monotonic(): boolean {
    let found = false;
    this.for_each_local_x_extremum_t(() => {
      found = true;
    });
    return !found;
  }

  // Returns whether this segment is monotonic on the y axis.
  public is_y_monotonic(): boolean {
    let found = false;
    this.for_each_local_y_extremum_t(() => {
      found = true;
    });
    return !found;
  }

  // Returns whether this segment is fully monotonic
  public is_monotonic(): boolean {
    return this.is_x_monotonic() && this.is_y_monotonic();
  }

  // Computes the intersections (if any) between this segment and another one.
  //
  // The result is provided in the form of the `t` parameters of each point along the curves. To
  // get the intersection points, sample the curves at the corresponding values.
  //
  // Returns endpoint intersections where an endpoint intersects the interior of the other curve,
  // but not endpoint/endpoint intersections.
  //
  // Returns no intersections if either curve is a point.
  // @returns ArrayVec<[[Scalar, Scalar]; 9]>
  public cubic_intersections_t(curve: this["Self"]): ArrayVec<[Scalar, Scalar]> {
    return cubic_bezier_intersections_t(this, curve);
  }

  // Computes the intersection points (if any) between this segment and another one.
  // @returns ArrayVec<[Point; 9]>
  public cubic_intersections(curve: this["Self"]): ArrayVec<Point<U> /*; 9*/> {
    let intersections = this.cubic_intersections_t(curve);

    let result_with_repeats = new ArrayVec<Point<U>>(9);
    for (let [t, _] of intersections) {
      result_with_repeats.push(this.sample(t));
    }

    // We can have up to nine "repeated" values here (for example: two lines, each of which
    // overlaps itself 3 times, intersecting in their 3-fold overlaps). We make an effort to
    // dedupe the results, but that's hindered by not having predictable control over how far
    // the repeated intersections can be from each other (and then by the fact that true
    // intersections can be arbitrarily close), so the results will never be perfect.

    let pair_cmp = (s: Point<U>, t: Point<U>) => {
      if (s.x < t.x || (s.x === t.x && s.y < t.y)) {
        return -1;
      } else if (s.x === t.x && s.y === t.y) {
        return 0;
      } else {
        return 1;
      }
    };
    result_with_repeats.sort(pair_cmp);
    if (result_with_repeats.len() <= 1) {
      return result_with_repeats;
    }

    const dist_sq = (p1: Point<U>, p2: Point<U>): Scalar => {
      return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
    };

    let epsilon_squared = EPSILON * EPSILON;
    let result = new ArrayVec<Point<U>>(result_with_repeats.len());
    let reference_intersection = result_with_repeats.get_unchecked(0);
    result.push(reference_intersection);
    for (let i of range(1, result_with_repeats.len())) {
      let intersection = result_with_repeats.get_unchecked(i);
      if (dist_sq(reference_intersection, intersection) < epsilon_squared) {
        continue;
      } else {
        result.push(intersection);
        reference_intersection = intersection;
      }
    }

    return result;
  }

  // Computes the intersections (if any) between this segment a quadratic bézier segment.
  //
  // The result is provided in the form of the `t` parameters of each point along the curves. To
  // get the intersection points, sample the curves at the corresponding values.
  //
  // Returns endpoint intersections where an endpoint intersects the interior of the other curve,
  // but not endpoint/endpoint intersections.
  //
  // Returns no intersections if either curve is a point.
  public quadratic_intersections_t(
    curve: QuadraticBezierSegment
  ): ArrayVec<[Scalar, Scalar]> /* ArrayVec<[Scalar, Scalar]; 9> */ {
    return this.cubic_intersections_t(curve.to_cubic());
  }

  // COmputes the intersection points (if any) between this segment and a quadratic bezier segment.
  public quadratic_intersections(
    curve: QuadraticBezierSegment
  ): ArrayVec<Point<U>> /* ArrayVec<Point; 9> */ {
    return this.cubic_intersections(curve.to_cubic());
  }

  // Computes the intersections (if any) between this segment and a line.
  //
  // The result is provided in the form of the `t` parameters of each
  // point along curve. To get the intersection points, sample the curve
  // at the corresponding values.
  public line_intersections_t(line: Line): ArrayVec<Scalar /*; 3*/> {
    if (line.vector.square_length() < EPSILON) {
      return new ArrayVec(3);
    }

    let from = this.start.to_vector();
    let ctrl1 = this.ctrl1.to_vector();
    let ctrl2 = this.ctrl2.to_vector();
    let to = this.end.to_vector();

    let p1 = to.sub(from).add(ctrl1.sub(ctrl2).mul(3));
    let p2 = from.mul(3).add(ctrl2.sub(ctrl1.mul(2)).mul(3));
    let p3 = ctrl1.sub(from).mul(3);
    let p4 = from;

    let c = line.point.y * line.vector.x - line.point.x * line.vector.y;

    let roots = cubic_polynomial_roots(
      line.vector.y * p1.x - line.vector.x * p1.y,
      line.vector.y * p2.x - line.vector.x * p2.y,
      line.vector.y * p3.x - line.vector.x * p3.y,
      line.vector.y * p4.x - line.vector.x * p4.y + c
    );

    let result = new ArrayVec<Scalar>(3);

    for (let root of roots) {
      if (root > 0 && root < 1) {
        result.push(root);
      }
    }

    return result;
  }

  public line_intersections(line: Line<U>): ArrayVec<Point /*; 3*/> {
    let intersections = this.line_intersections_t(line);

    let result = new ArrayVec<Point>(3);
    for (let t of intersections) {
      result.push(this.sample(t));
    }

    return result;
  }

  // Computes the intersections (if any) between this segment and a line segment.
  //
  // The result is provided in the form of the `t` parameters of each
  // point along curve and segment. To get the intersection points, sample
  // the segments at the corresponding values.
  public line_segment_intersections_t(
    segment: LineSegment
  ): ArrayVec<[Scalar, Scalar]> /* ArrayVec<[Scalar, Scalar]; 3> */ {
    if (!this.fast_bounding_rect().intersects(segment.bounding_rect())) {
      return new ArrayVec(3);
    }

    let intersections = this.line_intersections_t(segment.to_line());

    let result = new ArrayVec<[Scalar, Scalar]>(3);
    if (intersections.len() === 0) {
      return result;
    }

    let seg_is_mostly_vertical =
      Math.abs(segment.start.y - segment.end.y) >= Math.abs(segment.start.x - segment.end.x);
    let [seg_long_axis_min, seg_long_axis_max] = seg_is_mostly_vertical
      ? segment.bounding_range_y()
      : segment.bounding_range_x();

    for (let t of intersections) {
      let intersection_xy = seg_is_mostly_vertical ? this.y(t) : this.x(t);
      if (intersection_xy >= seg_long_axis_min && intersection_xy <= seg_long_axis_max) {
        let t2 =
          this.sample(t)
            .sub(segment.start)
            .length() / segment.length();
        result.push([t, t2]);
      }
    }

    return result;
  }

  public line_segment_intersections(
    segment: LineSegment
  ): ArrayVec<Point<U>> /* ArrayVec<Point; 3> */ {
    let intersections = this.line_segment_intersections_t(segment);

    let result = new ArrayVec<Point<U>>(3);
    for (let [t, _] of intersections) {
      result.push(this.sample(t));
    }

    return result;
  }

  // Clone
  public clone(): this["Self"] {
    return new CubicBezierSegment(
      this.start.clone(),
      this.ctrl1.clone(),
      this.ctrl2.clone(),
      this.end.clone()
    );
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.start.eq(other.start) &&
      this.ctrl1.eq(other.ctrl1) &&
      this.ctrl2.eq(other.ctrl2) &&
      this.end.eq(other.end)
    );
  }

  public fmt_debug(): string {
    return format(
      "CubicBezierSegment({:?},{:?},{:?},{:?})",
      this.start,
      this.ctrl1,
      this.ctrl2,
      this.end
    );
  }

  public fmt_display(): string {
    return format(
      "CubicBezierSegment({:?},{:?},{:?},{:?})",
      this.start,
      this.ctrl1,
      this.ctrl2,
      this.end
    );
  }
}

// A flattening iterator for quadratic bezier segments.
export type FlattenedQuadratic<U = any> = Flattened<QuadraticBezierSegment<U>>;

// A 2d curve segment defined by three points: the beginning of the segment, a control
// point and the end of the segment.
//
// The curve is defined by equation:
// ```∀ t ∈ [0..1],  P(t) = (1 - t)² * from + 2 * (1 - t) * t * ctrl + 2 * t² * to```
export class QuadraticBezierSegment<U = any> extends ImplPartialEq(SegmentWithFlatteningStep)
  implements BoundingRect, Clone, Debug, Display {
  public Self!: QuadraticBezierSegment<U>;

  public start: Point<U>;
  public ctrl: Point<U>;
  public end: Point<U>;

  public constructor(start: Point<U>, ctrl: Point<U>, end: Point<U>) {
    super();
    this.start = start;
    this.ctrl = ctrl;
    this.end = end;
  }

  // Start of the curve
  public from(): Point<U> {
    return this.start.clone();
  }

  // End of the curve
  public to(): Point<U> {
    return this.end.clone();
  }

  // Sample the curve at t (expecting t between 0 and 1)
  public sample(t: Scalar): Point<U> {
    let t2 = t * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;
    return this.start
      .mul(one_t2)
      .add(this.ctrl.to_vector().mul(2 * one_t * t))
      .add(this.end.to_vector().mul(t2));
  }

  // Sample the x coordinate of the curve at t (expecting t between 0 and 1)
  public x(t: Scalar): Scalar {
    let t2 = t * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;
    return this.start.x * one_t2 + this.ctrl.x * 2 * one_t * t + this.end.x * t2;
  }

  // Sample the y coordinate of the curve at t (expecting t between 0 and 1)
  public y(t: Scalar): Scalar {
    let t2 = t * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;
    return this.start.y * one_t2 + this.ctrl.y * 2 * one_t * t + this.end.y * t2;
  }

  private derivative_coefficients(t: Scalar): [Scalar, Scalar, Scalar] {
    return [2 * t - 2, -4 * t + 2, 2 * t];
  }

  // Sample derivative at t (expecting t between 0 and 1
  public derivative(t: Scalar): Vector<U> {
    let [c0, c1, c2] = this.derivative_coefficients(t);
    return this.start
      .to_vector()
      .mul(c0)
      .add(this.ctrl.to_vector().mul(c1))
      .add(this.end.to_vector().mul(c2));
  }

  // Sample x derivative at t (expecting t between 0 and 1)
  public dx(t: Scalar): Scalar {
    let [c0, c1, c2] = this.derivative_coefficients(t);
    return this.start.x * c0 + this.ctrl.x * c1 + this.end.x * c2;
  }

  // Sample y derivative at t (expecting t between 0 and 1)
  public dy(t: Scalar): Scalar {
    let [c0, c1, c2] = this.derivative_coefficients(t);
    return this.start.y * c0 + this.ctrl.y * c1 + this.end.y * c2;
  }

  // Swap the direction of the segment
  public flip(): QuadraticBezierSegment<U> {
    return new QuadraticBezierSegment(this.to(), this.ctrl.clone(), this.from());
  }

  // Find the advancement of the y-most position in the curve.
  //
  // This returns the advancement along the curve, not the actual y position.
  public y_maximum_t(): Scalar {
    let t_opt = this.local_y_extremum_t();
    if (t_opt.is_some()) {
      let t = t_opt.unwrap();
      let y = this.y(t);
      if (y > this.start.y && y > this.end.y) {
        return t;
      }
    }
    return this.start.y > this.end.y ? 0 : 1;
  }

  // Find the advancement of the y-least position in the curve.
  //
  // This returns the advancement along the curve, not the actual y position.
  public y_minimum_t(): Scalar {
    let t_opt = this.local_y_extremum_t();
    if (t_opt.is_some()) {
      let t = t_opt.unwrap();
      let y = this.y(t);
      if (y < this.start.y && y < this.end.y) {
        return t;
      }
    }
    return this.start.y < this.end.y ? 0 : 1;
  }

  // Return the y inflection point or None if this curve is y-monotonic.
  public local_y_extremum_t(): Option<Scalar> {
    let div = this.start.y - 2 * this.ctrl.y + this.end.y;
    if (div === 0) {
      return None();
    }
    let t = (this.start.y - this.ctrl.y) / div;
    if (t > 0 && t < 1) {
      return Some(t);
    }
    return None();
  }

  // Find the advancement of the x-most position in the curve.
  //
  // This returns the advancement along the curve, not the actual x position.
  public x_maximum_t(): Scalar {
    let t_opt = this.local_x_extremum_t();
    if (t_opt.is_some()) {
      let t = t_opt.unwrap();
      let x = this.x(t);
      if (x > this.start.x && x > this.end.x) {
        return t;
      }
    }
    return this.start.x > this.end.x ? 0 : 1;
  }

  // Find the advancement of the x-least position in the curve.
  //
  // This returns the advancement along the curve, not the actual x position.
  public x_minimum_t(): Scalar {
    let t_opt = this.local_x_extremum_t();
    if (t_opt.is_some()) {
      let t = t_opt.unwrap();
      let x = this.x(t);
      if (x < this.start.x && x < this.end.x) {
        return t;
      }
    }
    return this.start.x < this.end.x ? 0 : 1;
  }

  // Return the x inflection point or None if this curve is x-monotonic.
  public local_x_extremum_t(): Option<Scalar> {
    let div = this.start.x - 2 * this.ctrl.x + this.end.x;
    if (div === 0) {
      return None();
    }
    let t = (this.start.x - this.ctrl.x) / div;
    if (t > 0 && t < 1) {
      return Some(t);
    }
    return None();
  }

  // Return the sub-curve inside a given range of t
  //
  // This is equivalent to splitting at the range's end points.
  public split_range(t_range: Range<number>): QuadraticBezierSegment<U> {
    let t0 = t_range.start;
    let t1 = t_range.end;

    let from = this.sample(t0);
    let to = this.sample(t1);
    let ctrl = from.add(
      this.ctrl
        .sub(this.start)
        .lerp(this.end.sub(this.ctrl), t0)
        .mul(t1 - t0)
    );

    return new QuadraticBezierSegment(from, ctrl, to);
  }

  // Split the curve into two sub-curves
  public split(t: Scalar): [QuadraticBezierSegment<U>, QuadraticBezierSegment<U>] {
    let split_point = this.sample(t);

    return [
      new QuadraticBezierSegment(this.from(), this.start.lerp(this.ctrl, t), split_point),
      new QuadraticBezierSegment(split_point, this.ctrl.lerp(this.end, t), this.to())
    ];
  }

  // Return the curve before the split point
  public before_split(t: Scalar): QuadraticBezierSegment<U> {
    return new QuadraticBezierSegment(this.from(), this.start.lerp(this.ctrl, t), this.sample(t));
  }

  // Return the curve after the split point
  public after_split(t: Scalar): QuadraticBezierSegment<U> {
    return new QuadraticBezierSegment(this.sample(t), this.ctrl.lerp(this.end, t), this.to());
  }

  // Elevate this curve to a third order bezier.
  public to_cubic(): CubicBezierSegment<U> {
    return new CubicBezierSegment(
      this.from(),
      this.start.add(this.ctrl.to_vector().mul(2)).div(3),
      this.end.add(this.ctrl.to_vector().mul(2)).div(3),
      this.to()
    );
  }

  public baseline(): LineSegment<U> {
    return new LineSegment(this.from(), this.to());
  }

  public is_linear(tolerance: Scalar): boolean {
    if (this.start.sub(this.end).square_length() < EPSILON) {
      return false;
    }
    let ln = this.baseline()
      .to_line()
      .equation();

    return ln.distance_to_point(this.ctrl) < tolerance;
  }

  // Computes a "fat line" of this segment.
  //
  // A fat line is two convervative lines between which the segment
  // is fully contained.
  public fat_line(): [LineEquation<U>, LineEquation<U>] {
    let l1 = this.baseline()
      .to_line()
      .equation();
    let d = 0.5 * l1.signed_distance_to_point(this.ctrl);
    let l2 = l1.offset(d);

    return d >= 0 ? [l1, l2] : [l2, l1];
  }

  // Applies the transform to this curve and returns the results.
  public transform<Dst>(transform: Transform2D<U, Dst>): QuadraticBezierSegment<Dst> {
    return new QuadraticBezierSegment(
      transform.transform_point(this.start),
      transform.transform_point(this.ctrl),
      transform.transform_point(this.end)
    );
  }

  // Find the interval of the beginning of the curve that cen be approximated with a line segment.
  public flattening_step(tolerance: Scalar): Scalar {
    let v1 = this.ctrl.sub(this.start);
    let v2 = this.end.sub(this.start);

    let v2_cross_v1 = v2.cross(v1);
    let h = Math.hypot(v1.x, v1.y);

    if (Math.abs(v2_cross_v1 * h) <= EPSILON) {
      return 1;
    }

    let s2inv = h / v2_cross_v1;

    let t = 2 * Math.sqrt((tolerance * Math.abs(s2inv)) / 3);

    if (t > 1) {
      return 1;
    }

    return t;
  }

  public flattened(tolerance: Scalar): FlattenedQuadratic {
    return new Flattened<this["Self"]>(this, tolerance);
  }

  // Invokes a callback between each monotonic part of the segment.
  public for_each_monotonic_t(callback: (s: Scalar) => void) {
    let t0 = this.local_x_extremum_t();
    let t1 = this.local_y_extremum_t();

    let swap = false;
    let match = t0.match();
    switch (match.type) {
      case OptionType.Some:
        let tx = match.value;
        swap = t1.map_or(false, (ty: Scalar) => tx > ty);
        break;
      case OptionType.None:
        swap = t1.map_or(false, () => true);
        break;
    }

    if (swap) {
      [t0, t1] = [t1, t0];
    }

    t0.map((t: Scalar) => {
      if (t < 1) {
        callback(t);
      }
    });

    t1.map((t: Scalar) => {
      if (t < 1) {
        callback(t);
      }
    });
  }

  // Invokes a callback for each monotonic part of the segment..
  public for_each_monotonic_range(callback: (r: Range<number>) => void) {
    let t0 = 0;
    this.for_each_monotonic_t((t: Scalar) => {
      callback(range(t0, t));
      t0 = t;
    });
    callback(range(t0, 1));
  }

  public for_each_monotonic(callback: (s: MonotonicQuadraticBezierSegment<U>) => void) {
    this.for_each_monotonic_range((range: Range<number>) => {
      callback(this.split_range(range).assume_monotonic());
    });
  }

  // Compute the length of the segment using a flattened approximation
  public approx_length(tolerance: Scalar): Scalar {
    return approx_length_from_flattening(this, tolerance);
  }

  // Returns a triangle containing this curve segment.
  public bouding_triangle(): Triangle<U> {
    return triangle(this.from(), this.ctrl.clone(), this.to());
  }

  // Returns a conservative rectangle that contains the curve
  public fast_bounding_rect(): Rect<U> {
    let [min_x, max_x] = this.fast_bounding_range_x();
    let [min_y, max_y] = this.fast_bounding_range_y();

    return rect(min_x, min_y, max_x - min_x, max_y - min_y);
  }

  // Returns a conservative range of x values that contain the curve.
  public fast_bounding_range_x(): [Scalar, Scalar] {
    let min_x = minnum(minnum(this.start.x, this.ctrl.x), this.end.x);
    let max_x = maxnum(maxnum(this.start.x, this.ctrl.x), this.end.x);

    return [min_x, max_x];
  }

  // Returns a conservative range of y values that contain the curve.
  public fast_bounding_range_y(): [Scalar, Scalar] {
    let min_y = minnum(minnum(this.start.y, this.ctrl.y), this.end.y);
    let max_y = maxnum(maxnum(this.start.y, this.ctrl.y), this.end.y);

    return [min_y, max_y];
  }

  // Returns the smallest rectangle that contains the curve
  public bounding_rect(): Rect<U> {
    let [min_x, max_x] = this.bounding_range_x();
    let [min_y, max_y] = this.bounding_range_y();

    return rect(min_x, min_y, max_x - min_x, max_y - min_y);
  }

  // Returns the smallest range of x values that contain the curve.
  public bounding_range_x(): [Scalar, Scalar] {
    let min_x = this.x(this.x_minimum_t());
    let max_x = this.x(this.x_maximum_t());

    return [min_x, max_x];
  }

  // Returns the smallest range of y values that contain the curve.
  public bounding_range_y(): [Scalar, Scalar] {
    let min_y = this.y(this.y_minimum_t());
    let max_y = this.y(this.y_maximum_t());

    return [min_y, max_y];
  }

  // Cast this curve into a monotonic curve without checking that the monotonicity assumption is
  // correct.
  public assume_monotonic(): MonotonicQuadraticBezierSegment {
    return new MonotonicQuadraticBezierSegment(this);
  }

  // Returns whether this segment is monotonic on the x axis.
  public is_x_monotonic(): boolean {
    return this.local_x_extremum_t().is_none();
  }

  // Returns whether this segment is monotonic on the y axis.
  public is_y_monotonic(): boolean {
    return this.local_y_extremum_t().is_none();
  }

  // Returns whether this segment is fully monotonic
  public is_monotonic(): boolean {
    return this.is_x_monotonic() && this.is_y_monotonic();
  }

  // Computes the intersections (if any) between this segment and a line.
  //
  // The result is provided in the form of the `t` parameters of each
  // point along curve. To get the intersection points, sample the curve
  // at the corresponding values.
  public line_intersections_t(line: Line<U>): ArrayVec<Scalar> /* ArrayVec<Scalar; 2> */ {
    // TODO: a specific quadratic bezier vs line intersection function
    // would allow for better performance.
    let intersections = this.to_cubic().line_intersections_t(line);

    let result = new ArrayVec<Scalar>(2);
    for (let t of intersections) {
      result.push(t);
    }

    return result;
  }

  // Computes the intersections (if any) between this segment and a line.
  public line_intersections(line: Line<U>): ArrayVec<Point<U>> /* ArrayVec<Point; 2> */ {
    // TODO: a specific quadratic bezier vs line intersection function
    // would allow for better performance.
    let intersections = this.to_cubic().line_intersections_t(line);

    let result = new ArrayVec<Point<U>>(2);
    for (let t of intersections) {
      result.push(this.sample(t));
    }

    return result;
  }

  // Computes the intersections (if any) between this segment and a line segment.
  //
  // The result is provided in the form of the `t` parameters of each
  // point along curve and segment. To get the intersection points, sample
  // the segments at the corresponding values.
  public line_segment_intersections_t(
    segment: LineSegment<U>
  ): ArrayVec<[Scalar, Scalar]> /* ArrayVec<[Scalar, Scalar]; 2> */ {
    // TODO: a specific quadratic bezier vs line intersection function
    // would allow for better performance.
    let intersections = this.to_cubic().line_segment_intersections_t(segment);
    assert(intersections.len() <= 2);

    let result = new ArrayVec<[Scalar, Scalar]>(2);
    for (let t of intersections) {
      result.push(t);
    }

    return result;
  }

  public line_segment_intersections(
    segment: LineSegment<U>
  ): ArrayVec<Point<U>> /* ArrayVec<Point; 2> */ {
    let intersections = this.to_cubic().line_segment_intersections_t(segment);
    assert(intersections.len() <= 2);

    let result = new ArrayVec<Point<U>>(2);
    for (let [t, _] of intersections) {
      result.push(this.sample(t));
    }

    return result;
  }

  // Clone
  public clone(): this["Self"] {
    return new QuadraticBezierSegment(this.start.clone(), this.ctrl.clone(), this.end.clone());
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return this.start.eq(other.start) && this.ctrl.eq(other.ctrl) && this.end.eq(other.end);
  }

  // Debug
  public fmt_debug(): string {
    return format("QuadraticBezierSegment({:?},{:?},{:?})", this.start, this.ctrl, this.end);
  }

  // Display
  public fmt_display(): string {
    return format("QuadraticBezierSegment({:?},{:?},{:?})", this.start, this.ctrl, this.end);
  }
}

// Approximates a cubic bezier segment with a sequence of quadratic beziers.
export function cubic_to_quadratics<U = any>(
  curve: CubicBezierSegment<U>,
  tolerance: Scalar,
  callback: (c: QuadraticBezierSegment<U>) => void
) {
  debug_assert(tolerance >= EPSILON);

  let sub_curve = curve.clone();
  let r = range(0, 1);
  do {
    if (single_curve_approximation_test(sub_curve, tolerance)) {
      callback(single_curve_approximation(sub_curve));
      if (r.end >= 1) {
        return;
      }
      r.start = r.end;
      r.end = 1;
    } else {
      r.end = (r.start + r.end) * 0.5;
    }
    sub_curve = curve.split_range(r.clone());
  } while (true);
}

// This is terrible as a general approximation but works if the cubic curve does not have inflection
// points and is "flat" enough. Typically usable after subdividing the curve a few times.
export function single_curve_approximation<U = any>(
  cubic: CubicBezierSegment<U>
): QuadraticBezierSegment<U> {
  let c1 = cubic.ctrl1
    .mul(3)
    .sub(cubic.start)
    .mul(0.5);
  let c2 = cubic.ctrl2
    .mul(3)
    .sub(cubic.end)
    .mul(0.5);
  return new QuadraticBezierSegment(
    cubic.from(),
    c1
      .add(c2)
      .mul(0.5)
      .to_point(),
    cubic.to()
  );
}

// Evaluates an upper bound on the maximum distance between the curve and its quadratic
// approximation obtained using the single curve approximation.
export function single_curve_approximation_error(curve: CubicBezierSegment): Scalar {
  // See http://caffeineowl.com/graphics/2d/vectorial/cubic2quad01.html
  return (
    (Math.sqrt(3) / 36) *
    curve.end
      .sub(curve.ctrl2.mul(3))
      .add(curve.ctrl1.mul(3).sub(curve.start))
      .length()
  );
}

// Similar to single_curve_approximation_error avoiding the square root.
function single_curve_approximation_test(curve: CubicBezierSegment, tolerance: Scalar): boolean {
  return (
    (3 / 1296) *
      curve.end
        .sub(curve.ctrl2.mul(3))
        .add(curve.ctrl1.mul(3).sub(curve.start))
        .square_length() <=
    tolerance * tolerance
  );
}

export function cubic_to_monotonic_quadratics<U = any>(
  curve: CubicBezierSegment<U>,
  tolerance: Scalar,
  callback: (c: MonotonicQuadraticBezierSegment<U>) => void
) {
  curve.for_each_monotonic_range((r: Range<number>) => {
    cubic_to_quadratics(curve.split_range(r), tolerance, c => callback(make_monotonic(c)));
  });
}

// Unfortunately the single curve approximation can turn a monotonic cubic curve into an
// almost-but-exactly monotonic quadratic segment, so we may need to nudge the control point
// slightly to not break downstream code that rely on the monotonicity.
function make_monotonic<U = any>(
  curve: QuadraticBezierSegment<U>
): MonotonicQuadraticBezierSegment<U> {
  return new MonotonicQuadraticBezierSegment(
    new QuadraticBezierSegment(
      curve.start,
      point<U>(
        minnum(maxnum(curve.start.x, curve.ctrl.x), curve.end.x),
        minnum(maxnum(curve.start.y, curve.ctrl.y), curve.end.y)
      ),
      curve.end
    )
  );
}

// Computes the intersections (if any) between two cubic bézier curves in the form of the `t`
// parameters of each intersection point along the curves.
//
// Returns endpoint intersections where an endpoint intersects the interior of the other curve,
// but not endpoint/endpoint intersections.
//
// Returns no intersections if either curve is a point or if the curves are parallel lines.
export function cubic_bezier_intersections_t(
  curve1: CubicBezierSegment,
  curve2: CubicBezierSegment
): ArrayVec<[Scalar, Scalar] /*;9*/> {
  if (
    !curve1.fast_bounding_rect().intersects(curve2.fast_bounding_rect()) ||
    curve1.eq(curve2) ||
    (curve1.start.eq(curve2.end) &&
      curve1.ctrl1.eq(curve2.ctrl2) &&
      curve1.ctrl2.eq(curve2.ctrl1) &&
      curve1.end.eq(curve2.start))
  ) {
    return new ArrayVec(9);
  }

  let result = new ArrayVec<[Scalar, Scalar]>(9);

  let curve1_is_a_point = curve1.is_a_point(EPSILON);
  let curve2_is_a_point = curve2.is_a_point(EPSILON);
  if (curve1_is_a_point && !curve2_is_a_point) {
    let point1 = midpoint(curve1.start, curve1.end);
    let curve_params = point_curve_intersections(point1, curve2, EPSILON);
    for (let t of curve_params) {
      if (t > EPSILON && t < 1 - EPSILON) {
        result.push([0, t]);
      }
    }
  } else if (!curve1_is_a_point && curve2_is_a_point) {
    let point2 = midpoint(curve2.start, curve2.end);
    let curve_params = point_curve_intersections(point2, curve1, EPSILON);
    for (let t of curve_params) {
      if (t > EPSILON && t < 1 - EPSILON) {
        result.push([t, 0]);
      }
    }
  }
  if (curve1_is_a_point || curve2_is_a_point) {
    // Caller is always responsible for checking endpoints and overlaps, in the
    // case that both curves were points.
    return result;
  }

  let linear1 = curve1.is_linear(EPSILON);
  let linear2 = curve2.is_linear(EPSILON);
  if (linear1 && !linear2) {
    result = line_curve_intersections(curve1, curve2, /* flip */ false);
  } else if (!linear1 && linear2) {
    result = line_curve_intersections(curve2, curve1, /* flip */ true);
  } else if (linear1 && linear2) {
    result = line_line_intersections(curve1, curve2);
  } else {
    add_curve_intersections(
      curve1,
      curve2,
      range(0, 1),
      range(0, 1),
      result,
      /* flip */ false,
      /* recursion_count */ 0,
      /* call_count */ 0,
      /* original curve1 */ curve1,
      /* original curve2 */ curve2
    );
  }

  return result;
}

function point_curve_intersections(
  pt: Point,
  curve: CubicBezierSegment,
  epsilon: Scalar
): ArrayVec<Scalar /*;9*/> {
  let result = new ArrayVec<Scalar>(9);

  // If both endpoints are epsilon close, we only return 0.
  if (pt.sub(curve.start).square_length() < epsilon) {
    result.push(0);
    return result;
  }
  if (pt.sub(curve.end).square_length() < epsilon) {
    result.push(1);
    return result;
  }

  let curve_x_t_params = curve.solve_t_for_x(pt.x);
  let curve_y_t_params = curve.solve_t_for_y(pt.y);

  // We want to coalesce parameters representing the same intersection from the x and y
  // directions, but the parameter calculations aren't very accurate, so give a little more
  // leeway there (TODO: this isn't perfect, as you might expect - the dupes that pass here are
  // currently being detected in add_intersection).
  let params_eps = 10 * epsilon;
  for (let params of [curve_x_t_params, curve_y_t_params]) {
    for (let t of params) {
      if (pt.sub(curve.sample(t)).square_length() > epsilon) {
        continue;
      }
      let already_found_t = false;
      for (let u of result) {
        if (Math.abs(t - u) < params_eps) {
          already_found_t = true;
          break;
        }
      }
      if (!already_found_t) {
        result.push(t);
      }
    }
  }

  if (result.len() > 0) {
    return result;
  }

  // The remaining case is if pt is within epsilon of an interior point of curve, but not within
  // the x-range or y-range of the curve (which we already checked) - for example if curve is a
  // horizontal line that extends beyond its endpoints, and pt is just outside an end of the line;
  // or if the curve has a cusp in one of the corners of its convex hull and pt is
  // diagonally just outside the hull.  This is a rare case (could we even ignore it?).
  const maybe_add = (
    t: Scalar,
    pt: Point,
    curve: CubicBezierSegment,
    epsilon: Scalar,
    result: ArrayVec<Scalar /*;9*/>
  ): boolean => {
    if (
      curve
        .sample(t)
        .sub(pt)
        .square_length() < epsilon
    ) {
      result.push(t);
      return true;
    }
    return false;
  };

  let _ =
    maybe_add(curve.x_minimum_t(), pt, curve, epsilon, result) ||
    maybe_add(curve.x_maximum_t(), pt, curve, epsilon, result) ||
    maybe_add(curve.y_minimum_t(), pt, curve, epsilon, result) ||
    maybe_add(curve.y_maximum_t(), pt, curve, epsilon, result);

  return result;
}

function line_curve_intersections(
  line_as_curve: CubicBezierSegment,
  curve: CubicBezierSegment,
  flip: boolean
): ArrayVec<[Scalar, Scalar] /*; 9*/> {
  let result = new ArrayVec<[Scalar, Scalar]>(9);
  let baseline = line_as_curve.baseline();
  let curve_intersections = curve.line_intersections_t(baseline.to_line());
  let line_is_mostly_vertical =
    Math.abs(baseline.start.y - baseline.end.y) >= Math.abs(baseline.start.x - baseline.end.x);
  for (let curve_t of curve_intersections) {
    let line_intersections = line_is_mostly_vertical
      ? line_as_curve.solve_t_for_y(curve.y(curve_t))
      : line_as_curve.solve_t_for_x(curve.x(curve_t));

    for (let line_t of line_intersections) {
      add_intersection(line_t, line_as_curve, curve_t, curve, flip, result);
    }
  }

  return result;
}

function line_line_intersections(
  curve1: CubicBezierSegment,
  curve2: CubicBezierSegment
): ArrayVec<[Scalar, Scalar] /*; 9*/> {
  let result = new ArrayVec<[Scalar, Scalar]>(9);

  let opt_intersection = curve1
    .baseline()
    .to_line()
    .intersection(curve2.baseline().to_line());
  if (opt_intersection.is_none()) {
    return result;
  }

  let intersection = opt_intersection.unwrap();

  const parameters_for_line_point = (
    curve: CubicBezierSegment,
    pt: Point
  ): ArrayVec<Scalar /*: 3*/> => {
    let line_is_mostly_vertical =
      Math.abs(curve.start.y - curve.end.y) >= Math.abs(curve.start.x - curve.end.x);
    if (line_is_mostly_vertical) {
      return curve.solve_t_for_y(pt.y);
    } else {
      return curve.solve_t_for_x(pt.x);
    }
  };

  let line1_params = parameters_for_line_point(curve1, intersection);
  if (line1_params.len() === 0) {
    return result;
  }

  let line2_params = parameters_for_line_point(curve2, intersection);
  if (line2_params.len() === 0) {
    return result;
  }

  for (let t1 of line1_params) {
    for (let t2 of line2_params) {
      // It could be argued that an endpoint intersections located in the
      // interior of one or both curves should be returned here; we currently
      // don't.
      add_intersection(t1, curve1, t2, curve2, /* flip */ false, result);
    }
  }

  return result;
}

// This function implements the main bézier clipping algorithm by recursively subdividing curve1 and
// curve2 in to smaller and smaller portions of the original curves with the property that one of
// the curves intersects the fat line of the other curve at each stage.
//
// curve1 and curve2 at each stage are sub-bézier curves of the original curves; flip tells us
// whether curve1 at a given stage is a subcurve of the original curve1 or the original curve2;
// similarly for curve2.  domain1 and domain2 shrink (or stay the same) at each stage and describe
// which subdomain of an original curve the current curve1 and curve2 correspond to. (The domains of
// curve1 and curve2 are 0..1 at every stage.)
function add_curve_intersections(
  curve1: CubicBezierSegment,
  curve2: CubicBezierSegment,
  domain1: Range<number>,
  domain2: Range<number>,
  intersections: ArrayVec<[Scalar, Scalar] /*; 9*/>,
  flip: boolean,
  recursion_count: number,
  call_count: number,
  orig_curve1: CubicBezierSegment,
  orig_curve2: CubicBezierSegment
): number {
  assert(intersections.capacity() === 9);
  call_count += 1;
  recursion_count += 1;
  if (call_count >= 4096 || recursion_count >= 60) {
    return call_count;
  }

  let epsilon = 1e-9;

  if (domain2.start === domain2.end || curve2.is_a_point(0)) {
    add_point_curve_intersection(
      curve2,
      /* point is curve1 */ false,
      curve1,
      domain2,
      domain1,
      intersections,
      flip
    );
    return call_count;
  } else if (curve2.start.eq(curve2.end)) {
    // There's no curve2 baseline to fat-line against (and we'll (debug) crash if we try with
    // the current implementation), so split curve2 and try again.
    let new_2_curves = orig_curve2.split_range(domain2.clone()).split(0.5);
    let domain2_mid = (domain2.start + domain2.end) * 0.5;
    call_count = add_curve_intersections(
      curve1,
      new_2_curves[0],
      domain1,
      range(domain2.start, domain2_mid),
      intersections,
      flip,
      recursion_count,
      call_count,
      orig_curve1,
      orig_curve2
    );
    call_count = add_curve_intersections(
      curve1,
      new_2_curves[1],
      domain1,
      range(domain2_mid, domain2.end),
      intersections,
      flip,
      recursion_count,
      call_count,
      orig_curve1,
      orig_curve2
    );
    return call_count;
  }

  // (Don't call this before checking for point curves: points are inexact and can lead to false
  // negatives here.)
  if (!rectangles_overlap(curve1.fast_bounding_rect(), curve2.fast_bounding_rect())) {
    return call_count;
  }

  let t_min_clip: Scalar = 0;
  let t_max_clip: Scalar = 0;
  let match = restrict_curve_to_fat_line(curve1, curve2).match();
  switch (match.type) {
    case OptionType.Some:
      [t_min_clip, t_max_clip] = match.value;
      break;
    case OptionType.None:
      return call_count;
  }

  // t_min_clip and t_max_clip are (0, 1)-based, so project them back to get the new restricted
  // range:
  let new_domain1 = range(
    domain_value_at_t(domain1, t_min_clip),
    domain_value_at_t(domain1, t_max_clip)
  );

  if (maxnum(domain2.end - domain2.start, new_domain1.end - new_domain1.start) < epsilon) {
    let t1 = (new_domain1.start + new_domain1.end) * 0.5;
    let t2 = (domain2.start + domain2.end) * 0.5;

    // TODO: There MAY be an unfortunate tendency for curve2 endpoints that end near (but not all
    // that near) to the interior of curve1 to register as intersections, so try to avoid
    // that. (We could be discarding a legitimate intersection here.)
    // This should potentially not be an issue, because javascript uses f64 floats
    // https://github.com/nical/lyon/blob/master/geom/src/cubic_bezier_intersections.rs#L305

    add_intersection(t1, orig_curve1, t2, orig_curve2, flip, intersections);
    return call_count;
  }

  // Reduce curve1 to the part that might intersect curve2.
  curve1 = orig_curve1.split_range(new_domain1.clone());

  // (Note: it's possible for new_domain1 to have become a point, even if
  // t_min_clip < t_max_clip. It's also possible for curve1 to not be a point
  // even if new_domain1 is a point (but then curve1 will be very small).)
  if (new_domain1.start === new_domain1.end || curve1.is_a_point(0)) {
    add_point_curve_intersection(
      curve1,
      /* point is curve1 */ true,
      curve2,
      new_domain1,
      domain2,
      intersections,
      flip
    );
    return call_count;
  }

  // If the new range is still 80% or more of the old range, subdivide and try again.
  if (t_max_clip - t_min_clip > 8 / 10) {
    // Subdivide the curve which has converged the least.
    if (new_domain1.end - new_domain1.start > domain2.end - domain2.start) {
      let new_1_curves = curve1.split(0.5);
      let new_domain1_mid = (new_domain1.start + new_domain1.end) * 0.5;
      call_count = add_curve_intersections(
        curve2,
        new_1_curves[0],
        domain2,
        range(new_domain1.start, new_domain1_mid),
        intersections,
        !flip,
        recursion_count,
        call_count,
        orig_curve2,
        orig_curve1
      );
      call_count = add_curve_intersections(
        curve2,
        new_1_curves[1],
        domain2,
        range(new_domain1_mid, new_domain1.end),
        intersections,
        !flip,
        recursion_count,
        call_count,
        orig_curve2,
        orig_curve1
      );
    } else {
      let new_2_curves = orig_curve2.split_range(domain2.clone()).split(0.5);
      let domain2_mid = (domain2.start + domain2.end) * 0.5;
      call_count = add_curve_intersections(
        new_2_curves[0],
        curve1,
        range(domain2.start, domain2_mid),
        new_domain1,
        intersections,
        !flip,
        recursion_count,
        call_count,
        orig_curve2,
        orig_curve1
      );
      call_count = add_curve_intersections(
        new_2_curves[1],
        curve1,
        range(domain2_mid, domain2.end),
        new_domain1,
        intersections,
        !flip,
        recursion_count,
        call_count,
        orig_curve2,
        orig_curve1
      );
    }
  } else {
    // Iterate
    if (domain2.end - domain2.start >= epsilon) {
      call_count = add_curve_intersections(
        curve2,
        curve1,
        domain2,
        new_domain1,
        intersections,
        !flip,
        recursion_count,
        call_count,
        orig_curve2,
        orig_curve1
      );
    } else {
      // The interval on curve2 is already tight enough, so just continue iterating on curve1.
      call_count = add_curve_intersections(
        curve1,
        curve2,
        new_domain1,
        domain2,
        intersections,
        flip,
        recursion_count,
        call_count,
        orig_curve1,
        orig_curve2
      );
    }
  }

  return call_count;
}

function add_point_curve_intersection(
  pt_curve: CubicBezierSegment,
  pt_curve_is_curve1: boolean,
  curve: CubicBezierSegment,
  pt_domain: Range<number>,
  curve_domain: Range<number>,
  intersections: ArrayVec<[Scalar, Scalar] /*; 9*/>,
  flip: boolean
) {
  assert(intersections.capacity() === 9);
  let pt = pt_curve.start;
  // We assume pt is curve1 when we add intersections below.
  flip = pt_curve_is_curve1 ? flip : !flip;

  // Generally speeking |curve| will be quite small at this point, so see if we can get away with
  // just sampling here.

  let epsilon = epsilon_for_point(pt);
  let pt_t = (pt_domain.start + pt_domain.end) * 0.5;

  let curve_t: Scalar;
  {
    let t_for_min = 0;
    let min_dist_sq = epsilon;
    let tenths = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    for (let t of tenths) {
      let d = pt.sub(curve.sample(t)).square_length();
      if (d < min_dist_sq) {
        t_for_min = t;
        min_dist_sq = d;
      }
    }
    if (min_dist_sq === epsilon) {
      curve_t = -1;
    } else {
      curve_t = domain_value_at_t(curve_domain, t_for_min);
    }
  }

  if (curve_t !== -1) {
    add_intersection(pt_t, pt_curve, curve_t, curve, flip, intersections);
    return;
  }

  // If sampling didn't work, try a different approach.
  let results = point_curve_intersections(pt, curve, epsilon);
  for (let t of results) {
    let curve_t = domain_value_at_t(curve_domain, t);
    add_intersection(pt_t, pt_curve, curve_t, curve, flip, intersections);
  }
}

// If we're comparing distances between samples of curves, our epsilon should depend on how big the
// points we're comparing are. This function returns an epsilon appropriate for the size of pt.
function epsilon_for_point(pt: Point): Scalar {
  let max = maxnum(Math.abs(pt.x), Math.abs(pt.y));
  let epsilon =
    max >= 0 && max < 100000
      ? EPSILON
      : max >= 100000 && max < 100000000
      ? 1e-5
      : max >= 100000000 && max < 10000000000
      ? 1e-3
      : 1e-1;

  return epsilon;
}

function add_intersection(
  t1: Scalar,
  orig_curve1: CubicBezierSegment,
  t2: Scalar,
  orig_curve2: CubicBezierSegment,
  flip: boolean,
  intersections: ArrayVec<[Scalar, Scalar] /*; 9*/>
) {
  assert(intersections.capacity() === 9);
  [t1, t2] = flip ? [t2, t1] : [t1, t2];
  // (This should probably depend in some way on how large our input coefficients are.)
  let epsilon = EPSILON;
  // Discard endpoint/endpoint intersections.
  let t1_is_an_endpoint = t1 < epsilon || t1 > 1 - epsilon;
  let t2_is_an_endpoint = t2 < epsilon || t2 > 1 - epsilon;
  if (t1_is_an_endpoint && t2_is_an_endpoint) {
    return;
  }

  // We can get repeated intersections when we split a curve at an intersection point, or when two
  // curves intersect at a point where the curves are very close together, or when the fat line
  // process breaks down.
  for (let i of range(0, intersections.len())) {
    let [old_t1, old_t2] = intersections.get_unchecked(i);
    if (Math.abs(t1 - old_t1) < epsilon && Math.abs(t2 - old_t2) < epsilon) {
      let cur_dist = orig_curve1
        .sample(old_t1)
        .sub(orig_curve2.sample(old_t2))
        .square_length();
      let new_dist = orig_curve1
        .sample(t1)
        .sub(orig_curve2.sample(t2))
        .square_length();
      if (new_dist < cur_dist) {
        intersections.set(i, [t1, t2]);
      }
      return;
    }
  }

  if (intersections.len() < 9) {
    intersections.push([t1, t2]);
  }
}

// Returns an interval (t_min, t_max) with the property that for parameter values outside that
// interval, curve1 is guaranteed to not intersect curve2; uses the fat line of curve2 as its basis
// for the guarantee. (See the Sederberg document for what's going on here.)
function restrict_curve_to_fat_line(
  curve1: CubicBezierSegment,
  curve2: CubicBezierSegment
): Option<[Scalar, Scalar]> {
  // TODO: Consider clipping against the perpendicular fat line as well (recommended by Sederberg).
  // TODO: The current algorithm doesn't handle the (rare) case where curve1 and curve2 are
  // overlapping lines.

  let baseline2 = curve2
    .baseline()
    .to_line()
    .equation();

  let d_0 = baseline2.signed_distance_to_point(curve1.start);
  let d_1 = baseline2.signed_distance_to_point(curve1.ctrl1);
  let d_2 = baseline2.signed_distance_to_point(curve1.ctrl2);
  let d_3 = baseline2.signed_distance_to_point(curve1.end);

  let [top, bottom] = convex_hull_of_distance_curve(d_0, d_1, d_2, d_3);
  let [d_min, d_max] = curve2.fat_line_min_max();

  return clip_convex_hull_to_fat_line(top, bottom, d_min, d_max);
}

// Returns the convex hull of the curve that's the graph of the function
// t -> d(curve(t), baseline(curve2)). The convex hull is described as a top and a bottom, where
// each of top and bottom is described by the list of its vertices from left to right (the number of
// vertices for each is variable)
function convex_hull_of_distance_curve<U = any>(
  d0: Scalar,
  d1: Scalar,
  d2: Scalar,
  d3: Scalar
): [Point<U>[], Point<U>[]] {
  let p0 = point(0, d0);
  let p1 = point(1 / 3, d1);
  let p2 = point(2 / 3, d2);
  let p3 = point(1, d3);
  // Compute the vertical signed distance of p1 and p2 from [p0, p3].
  let dist1 = d1 - (2 * d0 + d3) / 3;
  let dist2 = d2 - (d0 + 2 * d3) / 3;

  // Compute the hull assuming p1 is on top - we'll switch later if needed.
  let hull: [Point<U>[], Point<U>[]];
  if (dist1 * dist2 < 0) {
    // p1 and p2 lie on opposite sides of [p0, p3], so the hull is a quadrailateral:
    hull = [[p0, p1, p3], [p0, p2, p3]];
  } else {
    // p1 and p2 lie on the same side of [p0, p3]. The hull can be a triangle or a quadrilateral,
    // and [p0, p3] is part of the hull. The hull is a triangle if the vertical distance of one of
    // the middle points p1, p2 is <= half the vertical distance of the other middle point.
    let dist1_scalar = Math.abs(dist1);
    let dist2_scalar = Math.abs(dist2);
    if (dist1_scalar >= 2 * dist2_scalar) {
      hull = [[p0, p1, p3], [p0, p3]];
    } else if (dist2_scalar >= 2 * dist1_scalar) {
      hull = [[p0, p2, p3], [p0, p3]];
    } else {
      hull = [[p0, p1, p2, p3], [p0, p3]];
    }
  }

  // Flip the hull if needed
  if (dist1 < 0 || (dist1 === 0 && dist2 < 0)) {
    hull = [hull[1], hull[0]];
  }

  return hull;
}

// Returns the min and max values at which the convex hll enters the fat line min/max offset lines.
function clip_convex_hull_to_fat_line(
  hull_top: Point[],
  hull_bottom: Point[],
  d_min: Scalar,
  d_max: Scalar
): Option<[Scalar, Scalar]> {
  // Walk from the left corner of the convex hull until we enter the fat line limits:
  let t_clip_min = walk_convex_hull_start_to_fat_line(hull_top, hull_bottom, d_min, d_max);
  if (t_clip_min.is_none()) {
    return None();
  }
  // Now walk from the right corner of the convex hull until we enter the fat line limits - to walk
  // right to left we just reverse the order of the hull vertices, so that hull_top and hull_bottom
  // start at the right corner now:
  hull_top.reverse();
  hull_bottom.reverse();
  let t_clip_max = walk_convex_hull_start_to_fat_line(hull_top, hull_bottom, d_min, d_max);
  if (t_clip_max.is_none()) {
    return None();
  }
  return Some([t_clip_min.unwrap(), t_clip_max.unwrap()]);
}

// Walk the edges of the convex hull until you hit a fat line offset value, starting from the
// (first vertex in hull_top vertices === first vertex in hull_bottom vertices).
function walk_convex_hull_start_to_fat_line(
  hull_top_vertices: Point[],
  hull_bottom_vertices: Point[],
  d_min: Scalar,
  d_max: Scalar
): Option<Scalar> {
  let start_corner = hull_top_vertices[0];

  if (start_corner.y < d_min) {
    return walk_convex_hull_edges_to_fat_line(hull_top_vertices, true, d_min);
  } else if (start_corner.y > d_max) {
    return walk_convex_hull_edges_to_fat_line(hull_bottom_vertices, false, d_max);
  } else {
    return Some(start_corner.x);
  }
}

// Do the actual walking, starting from the first vertex of hull_vertices.
function walk_convex_hull_edges_to_fat_line(
  hull_vertices: Point[],
  vertices_are_for_top: boolean,
  threshold: Scalar
): Option<Scalar> {
  for (let i of range(0, hull_vertices.len() - 1)) {
    let p = hull_vertices[i];
    let q = hull_vertices[i + 1];
    if ((vertices_are_for_top && q.y >= threshold) || (!vertices_are_for_top && q.y <= threshold)) {
      if (q.y === threshold) {
        return Some(q.x);
      } else {
        return Some(p.x + ((threshold - p.y) * (q.x - p.x)) / (q.y - p.y));
      }
    }
  }
  // All points of the hull are outside the threshold:
  return None();
}

// Return the point of domain corresponding to the point t, 0 <= t <= 1
function domain_value_at_t(domain: Range<number>, t: Scalar): Scalar {
  return domain.start + (domain.end - domain.start) * t;
}

// Rect.intersects doesn't count edge/corner intersections, this version does.
function rectangles_overlap(r1: Rect, r2: Rect): boolean {
  return (
    r1.origin.x <= r2.origin.x + r2.size.width &&
    r2.origin.x <= r1.origin.x + r1.size.width &&
    r1.origin.y <= r2.origin.y + r2.size.height &&
    r2.origin.y <= r1.origin.y + r1.size.height
  );
}
