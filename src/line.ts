import { Clone, Debug, format, Option, Some, None, Range, debug_assert } from "@rusts/std";
import {
  EPSILON,
  min_max,
  Point,
  point,
  Rect,
  Scalar,
  size,
  Transform2D,
  Vector,
  vector
} from "./internal";
// NOTE: these separate imports are needed, because they were not importing
// correctly from internal
import { MonotonicSegment } from "./monotonic";
import { BoundingRect, Flattened, SegmentWithFlatteningStep } from "./segment";

export class LineSegment<U = any> extends SegmentWithFlatteningStep
  implements BoundingRect, Clone, Debug, MonotonicSegment {
  public Self!: LineSegment<U>;

  public start: Point<U>;
  public end: Point<U>;
  public _unit!: U;

  public constructor(start: Point<U>, end: Point<U>) {
    super();
    this.start = start;
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
    return this.start.lerp(this.end, t);
  }

  // Sample x at t (expecting t between 0 and 1)
  public x(t: Scalar): Scalar {
    return this.start.x * (1 - t) + this.end.x * t;
  }

  // Sample x at t (expecting t between 0 and 1)
  public y(t: Scalar): Scalar {
    return this.start.y * (1 - t) + this.end.y * t;
  }

  public solve_t_for_x(x: Scalar): Scalar {
    let dx = this.end.x - this.start.x;
    if (dx === 0) {
      return 0;
    }

    return (x - this.start.x) / dx;
  }

  public solve_t_for_y(y: Scalar): Scalar {
    let dy = this.end.y - this.start.y;
    if (dy === 0) {
      return 0;
    }

    return (y - this.start.y) / dy;
  }

  public solve_y_for_x(x: Scalar): Scalar {
    return this.y(this.solve_t_for_x(x));
  }

  public solve_x_for_y(y: Scalar): Scalar {
    return this.x(this.solve_t_for_y(y));
  }

  // Sample derivative at t (expecting t between 0 and 1
  public derivative(_t: Scalar): Vector<U> {
    return this.to_vector();
  }

  // Sample x derivative at t (expecting t between 0 and 1)
  public dx(t: Scalar): Scalar {
    return this.sample(t).x;
  }

  // Sample x derivative at t (expecting t between 0 and 1)
  public dy(t: Scalar): Scalar {
    return this.sample(t).x;
  }

  // Split the curve into two sub-curves
  public split(t: Scalar): [LineSegment<U>, LineSegment<U>] {
    let split_point = this.sample(t);
    return [new LineSegment(this.from(), split_point), new LineSegment(split_point, this.to())];
  }

  // Return the curve before the split point
  public before_split(t: Scalar): LineSegment<U> {
    return new LineSegment(this.from(), this.sample(t));
  }

  // Return the curve after the split point
  public after_split(t: Scalar): LineSegment<U> {
    return new LineSegment(this.sample(t), this.to());
  }

  // Return the curve inside a given range of t
  //
  // This is equivalent to splitting at the range's end points.
  public split_range(t_range: Range<number>): LineSegment<U> {
    return new LineSegment(
      this.start.lerp(this.end, t_range.start),
      this.start.lerp(this.end, t_range.end)
    );
  }

  public split_at_x(x: Scalar): [LineSegment<U>, LineSegment<U>] {
    return this.split(this.solve_t_for_x(x));
  }

  // Swap the direction of the segment
  public flip(): LineSegment<U> {
    return new LineSegment(this.to(), this.from());
  }

  // Returns a rectangle that contains the curve
  public bounding_rect(): Rect<U> {
    let [min_x, max_x] = this.bounding_range_x();
    let [min_y, max_y] = this.bounding_range_y();

    let width = max_x - min_x;
    let height = max_y - min_y;
    return new Rect(point(min_x, min_y), size(width, height));
  }

  // Returns a rectangle that contains the curve
  //
  // This does not necessarily return the smallest possible bounding rectangle
  public fast_bounding_rect(): Rect<U> {
    return this.bounding_rect();
  }

  // Returns a range of x values that contain the curve.
  public bounding_range_x(): [Scalar, Scalar] {
    return min_max(this.start.x, this.end.x);
  }

  // Returns a range of y values that contain the curve.
  public bounding_range_y(): [Scalar, Scalar] {
    return min_max(this.start.y, this.end.y);
  }

  // Returns a range of x values that contain the curve.
  public fast_bounding_range_x(): [Scalar, Scalar] {
    return this.bounding_range_x();
  }

  // Returns a range of y values that contain the curve.
  public fast_bounding_range_y(): [Scalar, Scalar] {
    return this.bounding_range_y();
  }

  // Compute the length of the segment using a flattened approximation
  public approx_length(_tolerance: Scalar): Scalar {
    return this.length();
  }

  // Returns whether this segment is degenerate.
  public is_degenerate(tolerance: Scalar): boolean {
    return this.is_a_point(tolerance);
  }

  public is_a_point(tolerance: Scalar): boolean {
    let tolerance_squared = tolerance * tolerance;
    // Use <= so that tolerance can be zero
    return this.start.sub(this.end).square_length() <= tolerance_squared;
  }

  public to_vector(): Vector<U> {
    return this.end.sub(this.start);
  }

  public to_line(): Line {
    return line(this.from(), this.end.sub(this.start));
  }

  public length(): Scalar {
    return this.to_vector().length();
  }

  public set_length(new_length: Scalar) {
    let v = this.to_vector();
    let old_length = v.length();
    this.end = this.start.add(v.mul(new_length / old_length));
  }

  public translate(by: Vector<U>): LineSegment<U> {
    return new LineSegment(this.start.add(by), this.end.add(by));
  }

  public transform<Dst>(transform: Transform2D<U, Dst>): LineSegment<Dst> {
    return new LineSegment(
      transform.transform_point(this.start),
      transform.transform_point(this.end)
    );
  }

  // Computes the intersection (if any) between this segment and another one
  //
  // The result is provided in the form of the `t` parameter of each segment. To
  // get the intersection point, sample one of the segments at the corresponding
  // value.
  public intersection_t(other: LineSegment<U>): Option<[Scalar, Scalar]> {
    let [min1, max1] = this.bounding_range_x();
    let [min2, max2] = other.bounding_range_x();
    if (min1 > max2 || max1 < min2) {
      return None();
    }

    if (
      this.end.eq(other.end) ||
      this.start.eq(other.start) ||
      this.start.eq(other.end) ||
      this.end.eq(other.start)
    ) {
      return None();
    }

    let v1 = this.to_vector();
    let v2 = other.to_vector();

    let v1_cross_v2 = v1.cross(v2);
    if (v1_cross_v2 === 0) {
      // The segments are parallel
      return None();
    }

    let sign_v1_cross_v2 = Math.sign(v1_cross_v2);
    let abs_v1_cross_v2 = Math.abs(v1_cross_v2);

    let v3 = other.start.sub(this.start);

    let t = v3.cross(v2) * sign_v1_cross_v2;
    let u = v3.cross(v1) * sign_v1_cross_v2;

    if (t < 0 || t > abs_v1_cross_v2 || u < 0 || u > abs_v1_cross_v2) {
      return None();
    }

    return Some([t / abs_v1_cross_v2, u / abs_v1_cross_v2]);
  }

  public intersection(other: LineSegment<U>): Option<Point<U>> {
    return this.intersection_t(other).map(([t, _]) => this.sample(t));
  }

  public line_intersection_t(line: Line): Option<Scalar> {
    let v1 = this.to_vector();
    let v2 = line.vector;

    let v1_cross_v2 = v1.cross(v2);

    if (v1_cross_v2 === 0) {
      return None();
    }

    let sign_v1_cross_v2 = Math.sign(v1_cross_v2);
    let abs_v1_cross_v2 = Math.abs(v1_cross_v2);

    let v3 = line.point.sub(this.start);
    let t = v3.cross(v2) * sign_v1_cross_v2;

    if (t < 0 || t > abs_v1_cross_v2) {
      return None();
    }

    return Some(t / abs_v1_cross_v2);
  }

  public line_intersection(other: Line): Option<Point<U>> {
    return this.line_intersection_t(other).map(t => this.sample(t));
  }

  public horizontal_line_intersection_t(y: Scalar): Option<Scalar> {
    return LineSegment.axis_aligned_intersection_1d(this.start.y, this.end.y, y);
  }

  public vertical_line_intersection_t(x: Scalar): Option<Scalar> {
    return LineSegment.axis_aligned_intersection_1d(this.start.x, this.end.x, x);
  }

  public horizontal_line_intersection(y: Scalar): Option<Point<U>> {
    return this.horizontal_line_intersection_t(y).map(t => this.sample(t));
  }

  public vertical_line_intersection(x: Scalar): Option<Point<U>> {
    return this.vertical_line_intersection_t(x).map(t => this.sample(t));
  }

  public static axis_aligned_intersection_1d(a: Scalar, b: Scalar, v: Scalar): Option<Scalar> {
    let swap = a > b;
    if (swap) {
      [a, b] = [b, a];
    }

    let d = b - a;
    if (d === 0) {
      return None();
    }

    let t = (v - a) / d;

    if (t < 0 || t > 1) {
      return None();
    }

    return Some(swap ? 1 - t : t);
  }

  public intersects(other: LineSegment<U>): boolean {
    return this.intersection_t(other).is_some();
  }

  public intersects_line(line: Line): boolean {
    return this.line_intersection_t(line).is_some();
  }

  public overlaps_line(line: Line): boolean {
    let v1 = this.to_vector();
    let v2 = line.vector;
    let v3 = line.point.sub(this.start);

    return v1.cross(v2) === 0 && v1.cross(v3) === 0;
  }

  public overlaps_segment(other: LineSegment<U>): boolean {
    if (!this.overlaps_line(other.to_line())) {
      return false;
    }

    let v1 = this.end.sub(this.start);
    let v2 = other.start.sub(this.start);
    let v3 = other.end.sub(this.start);
    let a = 0;
    let b = v1.dot(v1);
    let c = v1.dot(v2);
    let d = v1.dot(v3);

    if (a > b) {
      [a, b] = [b, a];
    }
    if (c > d) {
      [c, d] = [d, c];
    }

    return (
      (c > a && c < b) ||
      (d > a && d < b) ||
      (a > c && a < d) ||
      (b > c && b < d) ||
      (a === c && b === d)
    );
  }

  public contains_segment(other: LineSegment<U>): boolean {
    if (!this.overlaps_line(other.to_line())) {
      return false;
    }

    let v1 = this.end.sub(this.start);
    let v2 = other.start.sub(this.start);
    let v3 = other.end.sub(this.start);
    let a = 0;
    let b = v1.dot(v1);
    let c = v1.dot(v2);
    let d = v1.dot(v3);

    if (a > b) {
      [a, b] = [b, a];
    }
    if (c > d) {
      [c, d] = [d, c];
    }

    return c >= a && c <= b && d >= a && d <= b;
  }

  // Find the interval at the beginning of the curve that can be approximated
  // with a line segment
  public flattening_step(_tolerance: Scalar): Scalar {
    return 1;
  }

  public flattened(tolerance: Scalar): Flattened<LineSegment<U>> {
    return new Flattened(this.clone(), tolerance);
  }

  // Clone
  public clone(): this["Self"] {
    return new LineSegment(this.start, this.end);
  }

  // Debug
  public fmt_debug(): string {
    return format("LineSegment({:?},{:?})", this.start, this.end);
  }
}

export class Line<U = any> {
  public point: Point<U>;
  public vector: Vector<U>;
  public _unit!: U;

  public constructor(point: Point<U>, vector: Vector<U>) {
    this.point = point;
    this.vector = vector;
  }

  public intersection(other: Line<U>): Option<Point<U>> {
    let det = this.vector.cross(other.vector);
    if (Math.abs(det) <= EPSILON) {
      return None();
    }

    let inv_det = 1 / det;
    let self_p2 = this.point.add(this.vector);
    let other_p2 = other.point.add(other.vector);
    let a = this.point.to_vector().cross(self_p2.to_vector());
    let b = other.point.to_vector().cross(other_p2.to_vector());
    return Some(
      point(
        (b * this.vector.x - a * other.vector.x) * inv_det,
        (b * this.vector.y - a * other.vector.y) * inv_det
      )
    );
  }

  public signed_distance_to_point(p: Point<U>): Scalar {
    let v1 = this.point.to_vector();
    let v2 = v1.add(this.vector);
    return (this.vector.cross(p.to_vector()) + v1.cross(v2)) / this.vector.length();
  }

  public distance_to_point(p: Point<U>): Scalar {
    return Math.abs(this.signed_distance_to_point(p));
  }

  public equation(): LineEquation<U> {
    let a = -this.vector.y;
    let b = this.vector.x;
    let c = -(a * this.point.x + b * this.point.y);

    return line_eqn(a, b, c);
  }
}

export class LineEquation<U = any> {
  private _a: Scalar;
  private _b: Scalar;
  private _c: Scalar;
  public _unit!: U;

  public constructor(a: Scalar, b: Scalar, c: Scalar) {
    debug_assert(a !== 0 || b !== 0);
    let div = 1 / Math.sqrt(a * a + b * b);
    this._a = a * div;
    this._b = b * div;
    this._c = c * div;
  }

  get a(): Scalar {
    return this._a;
  }

  get b(): Scalar {
    return this._b;
  }

  get c(): Scalar {
    return this._c;
  }

  public project_point(p: Point<U>): Point<U> {
    return point(
      this.b * (this.b * p.x - this.a * p.y) - this.a * this.c,
      this.a * (this.a * p.y - this.b * p.x) - this.b * this.c
    );
  }

  public signed_distance_to_point(p: Point<U>): Scalar {
    return this.a * p.x + this.b * p.y + this.c;
  }

  public distance_to_point(p: Point<U>): Scalar {
    return Math.abs(this.signed_distance_to_point(p));
  }

  public invert(): LineEquation {
    return new LineEquation(-this.a, -this.b, -this.c);
  }

  public parallel_line(p: Point<U>): LineEquation {
    let c = -(this.a * p.x + this.b * p.y);
    return new LineEquation(this.a, this.b, c);
  }

  public offset(d: Scalar): LineEquation {
    return new LineEquation(this.a, this.b, this.c - d);
  }

  public tangent(): Vector<U> {
    return vector(this.b, -this.a);
  }

  public normal(): Vector<U> {
    return vector(this.a, this.b);
  }

  public solve_y_for_x(x: Scalar): Option<Scalar> {
    if (this.b === 0) {
      return None();
    }

    return Some((this.a * x + this.c) / -this.b);
  }

  public solve_x_for_y(y: Scalar): Option<Scalar> {
    if (this.a === 0) {
      return None();
    }

    return Some((this.b * y + this.c) / -this.a);
  }

  public is_horizontal(): boolean {
    return this.a === 0;
  }

  public is_vertical(): boolean {
    return this.b === 0;
  }
}

export function line_seg<U = any>(from: Point<U>, to: Point<U>): LineSegment<U> {
  return new LineSegment(from, to);
}

export function line<U = any>(point: Point<U>, vector: Vector<U>): Line<U> {
  return new Line(point, vector);
}

export function line_eqn<U = any>(a: Scalar, b: Scalar, c: Scalar): LineEquation<U> {
  return new LineEquation(a, b, c);
}
