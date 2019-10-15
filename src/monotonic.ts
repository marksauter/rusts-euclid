import {
  Option,
  OptionType,
  Some,
  None,
  Range,
  range,
  debug_assert,
  assert,
  maxnum,
  minnum
} from "@rusts/std";
import { ArrayVec } from "@rusts/arrayvec";
import {
  CubicBezierSegment,
  EPSILON,
  Point,
  QuadraticBezierSegment,
  Rect,
  Scalar,
  Vector
} from "./internal";
// NOTE: these separate imports are needed, because they were not importing
// correctly from internal
import { BoundingRect, Segment } from "./segment";

export interface MonotonicSegment {
  solve_t_for_x(x: Scalar, t_range?: Range<number>, tolerance?: Scalar): Scalar;
}

export class MonotonicQuadraticBezierSegment<U = any> extends Segment<U>
  implements BoundingRect, MonotonicSegment {
  public Self!: MonotonicQuadraticBezierSegment<U>;

  private _segment: QuadraticBezierSegment<U>;

  public constructor(segment: QuadraticBezierSegment<U>) {
    super();
    this._segment = segment;
  }

  public get segment(): QuadraticBezierSegment<U> {
    return this._segment;
  }

  // Segment
  public from(): Point<U> {
    return this.segment.from();
  }
  public to(): Point<U> {
    return this.segment.to();
  }
  public sample(t: Scalar): Point<U> {
    return this.segment.sample(t);
  }
  public x(t: Scalar): Scalar {
    return this.segment.x(t);
  }
  public y(t: Scalar): Scalar {
    return this.segment.y(t);
  }
  public derivative(t: Scalar): Vector<U> {
    return this.segment.derivative(t);
  }
  public dx(t: Scalar): Scalar {
    return this.segment.dx(t);
  }
  public dy(t: Scalar): Scalar {
    return this.segment.dy(t);
  }
  public split_range(t_range: Range<number>): this["Self"] {
    return new MonotonicQuadraticBezierSegment(this.segment.split_range(t_range));
  }
  public split(t: Scalar): [this["Self"], this["Self"]] {
    let [a, b] = this.segment.split(t);
    return [new MonotonicQuadraticBezierSegment(a), new MonotonicQuadraticBezierSegment(b)];
  }
  public before_split(t: Scalar): MonotonicQuadraticBezierSegment {
    return new MonotonicQuadraticBezierSegment(this.segment.before_split(t));
  }
  public after_split(t: Scalar): this["Self"] {
    return new MonotonicQuadraticBezierSegment(this.segment.after_split(t));
  }
  public flip(): this["Self"] {
    return new MonotonicQuadraticBezierSegment(this.segment.flip());
  }
  public approx_length(tolerance: Scalar): Scalar {
    return this.segment.approx_length(tolerance);
  }

  // BoundingRect
  public bounding_rect(): Rect<U> {
    // For monotonic segments the fast bounding rect approximation is exact
    return this.segment.fast_bounding_rect();
  }
  public fast_bounding_rect(): Rect<U> {
    return this.segment.fast_bounding_rect();
  }
  public bounding_range_x(): [Scalar, Scalar] {
    return this.segment.bounding_range_x();
  }
  public bounding_range_y(): [Scalar, Scalar] {
    return this.segment.bounding_range_y();
  }
  public fast_bounding_range_x(): [Scalar, Scalar] {
    return this.segment.fast_bounding_range_x();
  }
  public fast_bounding_range_y(): [Scalar, Scalar] {
    return this.segment.fast_bounding_range_y();
  }

  public solve_t_for_x(x: Scalar, _t_range?: Range<number>, _tolerance?: Scalar): Scalar {
    return this.solve_t(this.segment.start.x, this.segment.ctrl.x, this.segment.end.x, x);
  }

  public solve_t_for_y(y: Scalar): Scalar {
    return this.solve_t(this.segment.start.y, this.segment.ctrl.y, this.segment.end.y, y);
  }

  private solve_t(from: number, ctrl: number, to: number, x: number): Scalar {
    let a = from - 2 * ctrl + to;
    let b = -2 * from + 2 * ctrl;
    let c = from - x;

    let t = (2 * c) / (-b - Math.sqrt(b * b - 4 * a * c));

    return minnum(maxnum(t, 0), 1);
  }

  public split_at_x(x: Scalar): [this["Self"], this["Self"]] {
    return this.split(this.solve_t_for_x(x));
  }

  public intersections_t(
    self_t_range: Range<number>,
    other: this["Self"],
    other_t_range: Range<number>,
    tolerance: Scalar
  ): ArrayVec<[Scalar, Scalar] /*;2*/> {
    return monotonic_segment_intersections(this, self_t_range, other, other_t_range, tolerance);
  }

  public intersections(
    self_t_range: Range<number>,
    other: this["Self"],
    other_t_range: Range<number>,
    tolerance: Scalar
  ): ArrayVec<Point /*;2*/> {
    let intersections = monotonic_segment_intersections(
      this,
      self_t_range,
      other,
      other_t_range,
      tolerance
    );
    let result = new ArrayVec<Point>(2);
    for (let [t, _] of intersections) {
      result.push(this.sample(t));
    }

    return result;
  }

  public first_intersection_t(
    self_t_range: Range<number>,
    other: this["Self"],
    other_t_range: Range<number>,
    tolerance: Scalar
  ): Option<[Scalar, Scalar] /*;2*/> {
    return first_monotonic_segment_intersection(
      this,
      self_t_range,
      other,
      other_t_range,
      tolerance
    );
  }

  public first_intersection(
    self_t_range: Range<number>,
    other: this["Self"],
    other_t_range: Range<number>,
    tolerance: Scalar
  ): Option<Point> {
    return first_monotonic_segment_intersection(
      this,
      self_t_range,
      other,
      other_t_range,
      tolerance
    ).map(([t, _]) => this.sample(t));
  }
}

export class MonotonicCubicBezierSegment<U = any> extends Segment<U>
  implements BoundingRect, MonotonicSegment {
  public Self!: MonotonicCubicBezierSegment<U>;

  private _segment: CubicBezierSegment<U>;

  public constructor(segment: CubicBezierSegment<U>) {
    super();
    this._segment = segment;
  }

  public get segment(): CubicBezierSegment<U> {
    return this._segment;
  }

  // Segment
  public from(): Point<U> {
    return this.segment.from();
  }
  public to(): Point<U> {
    return this.segment.to();
  }
  public sample(t: Scalar): Point<U> {
    return this.segment.sample(t);
  }
  public x(t: Scalar): Scalar {
    return this.segment.x(t);
  }
  public y(t: Scalar): Scalar {
    return this.segment.y(t);
  }
  public derivative(t: Scalar): Vector<U> {
    return this.segment.derivative(t);
  }
  public dx(t: Scalar): Scalar {
    return this.segment.dx(t);
  }
  public dy(t: Scalar): Scalar {
    return this.segment.dy(t);
  }
  public split(t: Scalar): [this["Self"], this["Self"]] {
    let [a, b] = this.segment.split(t);
    return [new MonotonicCubicBezierSegment(a), new MonotonicCubicBezierSegment(b)];
  }
  public before_split(t: Scalar): MonotonicCubicBezierSegment {
    return new MonotonicCubicBezierSegment(this.segment.before_split(t));
  }
  public after_split(t: Scalar): this["Self"] {
    return new MonotonicCubicBezierSegment(this.segment.after_split(t));
  }
  public split_range(t_range: Range<number>): this["Self"] {
    return new MonotonicCubicBezierSegment(this.segment.split_range(t_range));
  }
  public flip(): this["Self"] {
    return new MonotonicCubicBezierSegment(this.segment.flip());
  }
  public approx_length(tolerance: Scalar): Scalar {
    return this.segment.approx_length(tolerance);
  }

  // BoundingRect
  public bounding_rect(): Rect<U> {
    // For monotonic segments the fast bounding rect approximation is exact
    return this.segment.fast_bounding_rect();
  }
  public fast_bounding_rect(): Rect<U> {
    return this.segment.fast_bounding_rect();
  }
  public bounding_range_x(): [Scalar, Scalar] {
    return this.segment.bounding_range_x();
  }
  public bounding_range_y(): [Scalar, Scalar] {
    return this.segment.bounding_range_y();
  }
  public fast_bounding_range_x(): [Scalar, Scalar] {
    return this.segment.fast_bounding_range_x();
  }
  public fast_bounding_range_y(): [Scalar, Scalar] {
    return this.segment.fast_bounding_range_y();
  }

  public solve_t_for_x(x: Scalar, t_range: Range<number>, tolerance: Scalar): Scalar {
    debug_assert(t_range.start <= t_range.end);
    let from = this.x(t_range.start);
    let to = this.x(t_range.end);
    if (x <= from) {
      return t_range.start;
    }
    if (x >= to) {
      return t_range.end;
    }

    // Newton's method.
    var t = x - from / (to - from);
    for (let _ of range(0, 8)) {
      let x2 = this.x(t);

      if (Math.abs(x2 - x) <= tolerance) {
        return t;
      }

      let dx = this.dx(t);

      if (dx <= EPSILON) {
        break;
      }

      t = t - (x2 - x) / dx;
    }

    // Fall back to binary search.
    let min = t_range.start;
    let max = t_range.end;
    var t = 0.5;

    while (min < max) {
      let x2 = this.x(t);

      if (Math.abs(x2 - x) < tolerance) {
        return t;
      }

      if (x > x2) {
        min = t;
      } else {
        max = t;
      }

      t = (max - min) * 0.5 + min;
    }

    return t;
  }

  public split_at_x(x: Scalar): [this["Self"], this["Self"]] {
    // TODO: tolerance param.
    return this.split(this.solve_t_for_x(x, range(0, 1), 0.001));
  }
}

/**
 * Return the first intersection point (if any) of two monotonic curve segments.
 *
 * Both segments must be monotonically increasing in x.
 */
export function first_monotonic_segment_intersection<
  A extends Segment & MonotonicSegment & BoundingRect,
  B extends Segment & MonotonicSegment & BoundingRect
>(
  a: A,
  a_t_range: Range<number>,
  b: B,
  b_t_range: Range<number>,
  tolerance: Scalar
): Option<[Scalar, Scalar]> {
  debug_assert(a.from().x <= a.to().x);
  debug_assert(b.from().x <= b.to().x);

  // We need to have a stricter tolerance in solve_t_for_x otherwise
  // the error accumulation becomes pretty bad.
  let tx_tolerance = tolerance / 10;

  let [a_min, a_max] = a.split_range(a_t_range).fast_bounding_range_x();
  let [b_min, b_max] = b.split_range(b_t_range).fast_bounding_range_x();

  if (a_min > b_max || a_max < b_min) {
    return None();
  }

  let min_x = maxnum(a_min, b_min);
  let max_x = minnum(a_max, b_max);

  let t_min_a = a.solve_t_for_x(min_x, range(0, 1), tx_tolerance);
  let t_max_a = a.solve_t_for_x(max_x, range(t_min_a, 1), tx_tolerance);
  let t_min_b = b.solve_t_for_x(min_x, range(0, 1), tx_tolerance);
  let t_max_b = b.solve_t_for_x(max_x, range(t_min_b, 1), tx_tolerance);

  const MAX_ITERATIONS = 32;
  for (let _ of range(0, MAX_ITERATIONS)) {
    let y_max_a = a.y(t_max_a);
    let y_max_b = b.y(t_max_b);
    // It would seem more sensible to use the mid point instead of
    // the max point, but using the mid point means we don't know whether
    // the approximation will be slightly before or slightly after the
    // point.
    // Using the max point ensures that we return an approximation
    // that is always slightly after the real intersection, which
    // means that if we search for intersections after the one we
    // found, we are not going to converge towards it again.
    if (Math.abs(y_max_a - y_max_b) < tolerance) {
      return Some([t_max_a, t_max_b]);
    }

    let mid_x = (min_x + max_x) * 0.5;
    let t_mid_a = a.solve_t_for_x(mid_x, range(t_min_a, t_max_a), tx_tolerance);
    let t_mid_b = b.solve_t_for_x(mid_x, range(t_min_b, t_max_b), tx_tolerance);

    let y_mid_a = a.y(t_mid_a);
    let y_min_a = a.y(t_min_a);

    let y_mid_b = b.y(t_mid_b);
    let y_min_b = b.y(t_min_b);

    let min_sign = Math.sign(y_min_a - y_min_b);
    let mid_sign = Math.sign(y_mid_a - y_mid_b);
    let max_sign = Math.sign(y_max_a - y_max_b);

    if (min_sign !== mid_sign) {
      max_x = mid_x;
      t_max_a = t_mid_a;
      t_max_b = t_mid_b;
    } else if (max_sign !== mid_sign) {
      min_x = mid_x;
      t_min_a = t_mid_a;
      t_min_b = t_mid_b;
    } else {
      // TODO: This is not always correct: if the min, max and mid
      // points are all on the same side, we consider that there is
      // no intersection, but there could be a pair of intersections
      // between the min/max and the mid point.
      break;
    }
  }

  return None();
}

/**
 * Return the intersections points (if any) of two monotonic curve segments.
 *
 * Both segments must be monotonically increasing in x.
 */
export function monotonic_segment_intersections<
  A extends Segment & MonotonicSegment & BoundingRect,
  B extends Segment & MonotonicSegment & BoundingRect
>(
  a: A,
  a_t_range: Range<number>,
  b: B,
  b_t_range: Range<number>,
  tolerance: Scalar
): ArrayVec<[Scalar, Scalar] /*;2*/> {
  let t1: Scalar, t2: Scalar;
  var match = first_monotonic_segment_intersection(
    a,
    a_t_range.clone(),
    b,
    b_t_range.clone(),
    tolerance
  ).match();
  switch (match.type) {
    case OptionType.Some:
      [t1, t2] = match.value;
      break;
    case OptionType.None:
      return new ArrayVec(2);
  }

  let result = new ArrayVec<[Scalar, Scalar]>(2);
  // @ts-ignore 't(1&2)' is used before being assigned
  result.push([t1, t2]);

  var match = first_monotonic_segment_intersection(
    a,
    // @ts-ignore 't1' is used before being assigned
    range(t1, a_t_range.end),
    b,
    // @ts-ignore 't2' is used before being assigned
    range(t2, b_t_range.end),
    tolerance
  ).match();
  switch (match.type) {
    case OptionType.Some:
      result.push(match.value);
      break;
    case OptionType.None:
      break;
  }

  return result;
}
