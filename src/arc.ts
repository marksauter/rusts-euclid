import {
  Self,
  Clone,
  Debug,
  format,
  Range,
  range,
  ImplPartialEq,
  swap,
  PI,
  debug_assert,
  assert,
  abstract_panic,
  minnum,
  maxnum
} from "@rusts/std";
import {
  // rotation.ts
  Angle,
  Rotation2D,
  // scalar.ts
  Scalar,
  EPSILON,
  // line.ts
  Line,
  line,
  // point.ts
  Point,
  point,
  // rect.ts
  Rect,
  // segment.ts
  Segment,
  BoundingRect,
  Flattened,
  SegmentWithFlatteningStep,
  approx_length_from_flattening,
  // bezier.ts
  QuadraticBezierSegment,
  CubicBezierSegment,
  // transform.ts
  Transform2D,
  // vector.ts
  Vector,
  vector
} from "./internal";

export type FlattenedArc<U = any> = Flattened<Arc<U>>;

export class Arc<U = any> extends ImplPartialEq(SegmentWithFlatteningStep)
  implements BoundingRect, Clone, Debug {
  public center: Point<U>;
  public radii: Vector<U>;
  public start_angle: Angle;
  public sweep_angle: Angle;
  public x_rotation: Angle;
  public _unit!: U;

  public constructor(
    center: Point<U>,
    radii: Vector<U>,
    start_angle: Angle,
    sweep_angle: Angle,
    x_rotation: Angle
  ) {
    super();
    this.center = center;
    this.radii = radii;
    this.start_angle = start_angle;
    this.sweep_angle = sweep_angle;
    this.x_rotation = x_rotation;
  }

  // Create simple circle
  public static circle<U = any>(center: Point<U>, radius: Scalar): Arc<U> {
    return new Arc(center, vector(radius, radius), Angle.zero(), Angle.two_pi(), Angle.zero());
  }

  public static from_svg_arc<U = any>(arc: SvgArc<U>): Arc<U> {
    debug_assert(!isNaN(arc.from.x));
    debug_assert(!isNaN(arc.from.y));
    debug_assert(!isNaN(arc.to.x));
    debug_assert(!isNaN(arc.to.y));
    debug_assert(!isNaN(arc.radii.x));
    debug_assert(!isNaN(arc.radii.y));
    debug_assert(!isNaN(arc.x_rotation.get()));
    // The SVG spec specifies what we should do if one of the two
    // radiii is zero and not the other, but it's better to handle
    // this out of arc code and generate a line_to instead of an arc.
    assert(!arc.is_straight_line());

    let rx = Math.abs(arc.radii.x);
    let ry = Math.abs(arc.radii.y);

    let xr = arc.x_rotation.get() % (2 * PI);
    let cos_phi = Math.cos(xr);
    let sin_phi = Math.sin(xr);
    let hd_x = (arc.from.x - arc.to.x) / 2;
    let hd_y = (arc.from.y - arc.to.y) / 2;
    let hs_x = (arc.from.x + arc.to.x) / 2;
    let hs_y = (arc.from.y + arc.to.y) / 2;

    // F6.5.1
    let p = point(cos_phi * hd_x + sin_phi * hd_y, -sin_phi * hd_x + cos_phi * hd_y);

    // Sanitize the radii
    // If rf > 1 it means the radii are too small for the arc to possibly
    // connect the end points. In this situation we scale them up according to
    // the formula provided by the SVG spec.

    // F6.6.2
    let rf = (p.x * p.x) / (rx * rx) + (p.y * p.y) / (ry * ry);
    if (rf > 1) {
      let scale = Math.sqrt(rf);
      rx *= scale;
      ry *= scale;
    }

    let rxry = rx * ry;
    let rxpy = rx * p.y;
    let rypx = ry * p.x;
    let sum_of_sq = rxpy * rxpy + rypx * rypx;

    // F6.5.2
    let sign_coe = arc.flags.large_arc === arc.flags.sweep ? -1 : 1;
    let coe = sign_coe * Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
    let transformed_cx = (coe * rxpy) / ry;
    let transformed_cy = (-coe * rypx) / rx;

    // F6.5.3
    let center = point(
      cos_phi * transformed_cx - sin_phi * transformed_cy + hs_x,
      sin_phi * transformed_cx + cos_phi * transformed_cy + hs_y
    );

    let start_v = vector((p.x - transformed_cx) / rx, (p.y - transformed_cy) / ry);
    let end_v = vector((-p.x - transformed_cx) / rx, (-p.y - transformed_cy) / ry);

    let two_pi = 2 * PI;

    let start_angle = start_v.angle_from_x_axis();

    let sweep_angle = end_v.angle_from_x_axis().sub(start_angle).radians % two_pi;

    if (arc.flags.sweep && sweep_angle < 0) {
      sweep_angle += two_pi;
    } else if (!arc.flags.sweep && sweep_angle > 0) {
      sweep_angle -= two_pi;
    }

    return new Arc(center, vector(rx, ry), start_angle, Angle.radians(sweep_angle), arc.x_rotation);
  }

  public to_svg_arc(): SvgArc {
    let from = this.sample(0);
    let to = this.sample(1);
    let flags = new ArcFlags(Math.abs(this.sweep_angle.get()) >= PI, this.sweep_angle.get() >= 0);
    return new SvgArc(from, to, this.radii.clone(), this.x_rotation.clone(), flags);
  }

  public for_each_quadratic_bezier(cb: (s: QuadraticBezierSegment) => void) {
    arc_to_quadratic_beziers(this, cb);
  }

  public for_each_cubic_bezier(cb: (s: CubicBezierSegment) => void) {
    arc_to_cubic_beziers(this, cb);
  }

  public sample(t: Scalar): Point<U> {
    let angle = this.get_angle(t);
    return this.center.add(sample_ellipse(this.radii, this.x_rotation, angle).to_vector());
  }

  public x(t: Scalar): Scalar {
    return this.sample(t).x;
  }

  public y(t: Scalar): Scalar {
    return this.sample(t).y;
  }

  public sample_tangent(t: Scalar): Vector<U> {
    return this.tangent_at_angle(this.get_angle(t));
  }

  public derivative(t: Scalar): Vector<U> {
    return this.sample_tangent(t);
  }

  public get_angle(t: Scalar): Angle {
    return this.start_angle.add(Angle.radians(this.sweep_angle.get() * t));
  }

  public end_angle(): Angle {
    return this.start_angle.add(this.sweep_angle);
  }

  public from(): Point<U> {
    return this.sample(0);
  }

  public to(): Point<U> {
    return this.sample(1);
  }

  // Return the sub-curve inside a given range of t
  //
  // This is equivalent to splitting at the range's end points.
  public split_range(t_range: Range<number>): Arc<U> {
    let angle_1 = Angle.radians(this.sweep_angle.get() * t_range.start);
    let angle_2 = Angle.radians(this.sweep_angle.get() * t_range.end);

    return new Arc(
      this.center,
      this.radii,
      this.start_angle.add(angle_1),
      angle_2.sub(angle_1),
      this.x_rotation
    );
  }

  public split(t: Scalar): [Arc<U>, Arc<U>] {
    let split_angle = Angle.radians(this.sweep_angle.get() * t);
    return [
      new Arc(this.center, this.radii, this.start_angle, split_angle, this.x_rotation),
      new Arc(
        this.center,
        this.radii,
        this.start_angle.add(split_angle),
        this.sweep_angle.sub(split_angle),
        this.x_rotation
      )
    ];
  }

  public before_split(t: Scalar): Arc<U> {
    let split_angle = Angle.radians(this.sweep_angle.get() * t);
    return new Arc(this.center, this.radii, this.start_angle, split_angle, this.x_rotation);
  }

  public after_split(t: Scalar): Arc<U> {
    let split_angle = Angle.radians(this.sweep_angle.get() * t);
    return new Arc(
      this.center,
      this.radii,
      this.start_angle.add(split_angle),
      this.sweep_angle.sub(split_angle),
      this.x_rotation
    );
  }

  // Swap the direction of the segment
  public flip(): Arc<U> {
    return new Arc(
      this.center.clone(),
      this.radii.clone(),
      this.start_angle.add(this.sweep_angle),
      this.sweep_angle.neg(),
      this.x_rotation.clone()
    );
  }

  // Finds the interval of the beginning of the curve that can be approximated
  // with a line segment
  public flattening_step(tolerance: Scalar): Scalar {
    // Here we make the approximation that for small tolerance values we
    // consider the radius to be constant over each approximated segment.
    let r = this.from()
      .sub(this.center)
      .length();
    let a = 2 * Math.acos((r - tolerance) / r);
    let result = minnum(a / this.sweep_angle.radians, 1);

    if (result < EPSILON) {
      return 1;
    }

    return result;
  }

  public flattened(tolerance: Scalar): Flattened<Arc> {
    return new Flattened(this.clone(), tolerance);
  }

  // Returns a conservative rectangle that contains the curve
  public fast_bounding_rect(): Rect {
    return Transform2D.create_rotation(this.x_rotation).transform_rect(
      new Rect(this.center.sub(this.radii), this.radii.to_size().mul_assign(2))
    );
  }

  // Returns a rectangle that contains the curve
  public bounding_rect(): Rect {
    let from = this.from();
    let to = this.to();
    let min = from.min(to);
    let max = from.max(to);
    this.for_each_local_x_extremum_t(t => {
      let p = this.sample(t);
      min.x = minnum(min.x, p.x);
      max.x = maxnum(max.x, p.x);
    });
    this.for_each_local_y_extremum_t(t => {
      let p = this.sample(t);
      min.y = minnum(min.y, p.y);
      max.y = maxnum(max.y, p.y);
    });

    return new Rect(min, max.sub(min).to_size());
  }

  public for_each_local_x_extremum_t(cb: (s: Scalar) => void) {
    let rx = this.radii.x;
    let ry = this.radii.y;
    let a1 = Angle.radians(-Math.atan((ry * Math.tan(this.x_rotation.get())) / rx));
    let a2 = Angle.pi().add_assign(a1);

    return this.for_each_extremum_inner(a1, a2, cb);
  }

  public for_each_local_y_extremum_t(cb: (s: Scalar) => void) {
    let rx = this.radii.x;
    let ry = this.radii.y;
    let a1 = Angle.radians(Math.atan(ry * Math.tan(this.x_rotation.get()) * rx));
    let a2 = Angle.pi().add_assign(a1);

    return this.for_each_extremum_inner(a1, a2, cb);
  }

  public for_each_extremum_inner(angle_1: Angle, angle_2: Angle, callback: (s: Scalar) => void) {
    let sweep = this.sweep_angle.get();
    let abs_sweep = Math.abs(sweep);
    let sign = Math.sign(sweep);

    let a1 = angle_1
      .sub_assign(this.start_angle)
      .positive()
      .get();
    let a2 = angle_2
      .sub_assign(this.start_angle)
      .positive()
      .get();
    if (a1 * sign > a2 * sign) {
      [a1, a2] = swap(a1, a2);
    }

    let two_pi = 2 * PI;
    if (sweep >= 0) {
      if (a1 < abs_sweep) {
        callback(a1 / abs_sweep);
      }
      if (a2 < abs_sweep) {
        callback(a2 / abs_sweep);
      }
    } else {
      if (a1 > two_pi - abs_sweep) {
        callback(a1 / abs_sweep);
      }
      if (a2 > two_pi - abs_sweep) {
        callback(a2 / abs_sweep);
      }
    }
  }

  // Returns a range of x values that contain the curve.
  public bounding_range_x(): [Scalar, Scalar] {
    let r = this.bounding_rect();
    return [r.min_x(), r.max_x()];
  }

  // Returns a range of y values that contain the curve.
  public bounding_range_y(): [Scalar, Scalar] {
    let r = this.bounding_rect();
    return [r.min_y(), r.max_y()];
  }

  // Returns a range of x values that contain the curve.
  public fast_bounding_range_x(): [Scalar, Scalar] {
    let r = this.fast_bounding_rect();
    return [r.min_x(), r.max_x()];
  }

  // Returns a range of y values that contain the curve.
  public fast_bounding_range_y(): [Scalar, Scalar] {
    let r = this.fast_bounding_rect();
    return [r.min_y(), r.max_y()];
  }

  public approx_length(tolerance: Scalar): Scalar {
    return approx_length_from_flattening(this, tolerance);
  }

  public tangent_at_angle(angle: Angle): Vector<U> {
    let a = angle.get();
    return Rotation2D.from_angle(this.x_rotation).transform_vector(
      vector(-this.radii.x * Math.sin(a), this.radii.y * Math.cos(a))
    );
  }

  // Clone
  public clone(): this["Self"] {
    return new Arc(this.center, this.radii, this.start_angle, this.sweep_angle, this.x_rotation);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.center.eq(other.center) &&
      this.radii.eq(other.radii) &&
      this.start_angle.eq(other.start_angle) &&
      this.sweep_angle.eq(other.sweep_angle) &&
      this.x_rotation.eq(other.x_rotation)
    );
  }

  // Debug
  public fmt_debug(): string {
    return format(
      "Arc({:?},{:?},{:?},{:?},{:?})",
      this.center,
      this.radii,
      this.start_angle,
      this.sweep_angle,
      this.x_rotation
    );
  }
}

export class SvgArc<U = any> extends ImplPartialEq(Self) {
  public Self!: SvgArc<U>;

  public from: Point<U>;
  public to: Point<U>;
  public radii: Vector<U>;
  public x_rotation: Angle;
  public flags: ArcFlags;

  public constructor(
    from: Point<U>,
    to: Point<U>,
    radii: Vector<U>,
    x_rotation: Angle,
    flags: ArcFlags
  ) {
    super();
    this.from = from;
    this.to = to;
    this.radii = radii;
    this.x_rotation = x_rotation;
    this.flags = flags;
  }

  public to_arc(): Arc {
    return Arc.from_svg_arc(this);
  }

  public is_straight_line(): boolean {
    return (
      Math.abs(this.radii.x) <= EPSILON ||
      Math.abs(this.radii.y) <= EPSILON ||
      this.from.eq(this.to)
    );
  }

  public for_each_quadratic_bezier(callback: (s: QuadraticBezierSegment) => void) {
    if (this.is_straight_line()) {
      callback(new QuadraticBezierSegment(this.from, this.from, this.to));
      return;
    }

    Arc.from_svg_arc(this).for_each_quadratic_bezier(callback);
  }

  public for_each_cubic_bezier(callback: (s: CubicBezierSegment) => void) {
    if (this.is_straight_line()) {
      callback(new CubicBezierSegment(this.from, this.from, this.to, this.to));
      return;
    }

    Arc.from_svg_arc(this).for_each_cubic_bezier(callback);
  }

  public for_each_flattened(tolerance: Scalar, callback: (s: Point<U>) => void) {
    if (this.is_straight_line()) {
      callback(this.to);
      return;
    }

    Arc.from_svg_arc(this).for_each_flattened(tolerance, callback);
  }

  // Clone
  public clone(): SvgArc {
    return new SvgArc(this.from, this.to, this.radii, this.x_rotation, this.flags);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.from.eq(other.from) &&
      this.to.eq(other.to) &&
      this.radii.eq(other.radii) &&
      this.x_rotation.eq(other.x_rotation) &&
      this.flags.eq(other.flags)
    );
  }

  public fmt_debug(): string {
    return format(
      "SvgArc({:?},{:?},{:?},{:?},{:?})",
      this.from,
      this.to,
      this.radii,
      this.x_rotation,
      this.flags
    );
  }
}

export class ArcFlags extends ImplPartialEq(Self) implements Clone, Debug {
  public large_arc: boolean;
  public sweep: boolean;

  public constructor(large_arc: boolean, sweep: boolean) {
    super();
    this.large_arc = large_arc;
    this.sweep = sweep;
  }

  // Default
  public static default(): ArcFlags {
    return new ArcFlags(false, false);
  }

  // Clone
  public clone(): this["Self"] {
    return new ArcFlags(this.large_arc, this.sweep);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return this.large_arc === other.large_arc && this.sweep === other.sweep;
  }

  public fmt_debug(): string {
    return format("ArcFlags({:?},{:?})", this.large_arc, this.sweep);
  }
}

export function arc_to_quadratic_beziers(arc: Arc, callback: (s: QuadraticBezierSegment) => void) {
  let sign = Math.sign(arc.sweep_angle.get());
  let sweep_angle = minnum(Math.abs(arc.sweep_angle.get()), PI * 2);

  let n_steps = Math.ceil(sweep_angle / (PI / 4));
  let step = Angle.radians((sweep_angle / n_steps) * sign);

  for (let i of range(0, n_steps)) {
    let a1 = arc.start_angle.add(step.mul(i));
    let a2 = arc.start_angle.add(step.mul(i + 1));

    let v1 = sample_ellipse(arc.radii, arc.x_rotation, a1).to_vector();
    let v2 = sample_ellipse(arc.radii, arc.x_rotation, a2).to_vector();
    let from = arc.center.add(v1);
    let to = arc.center.add(v2);
    let l1 = line(from, arc.tangent_at_angle(a1));
    let l2 = line(to, arc.tangent_at_angle(a2));
    let ctrl = l2.intersection(l1).unwrap_or(from);

    callback(new QuadraticBezierSegment(from, ctrl, to));
  }
}

export function arc_to_cubic_beziers(arc: Arc, callback: (s: CubicBezierSegment) => void) {
  let sign = Math.sign(arc.sweep_angle.get());
  let sweep_angle = minnum(Math.abs(arc.sweep_angle.get()), PI * 2);

  let n_steps = Math.ceil(sweep_angle / (PI / 2));
  let step = Angle.radians((sweep_angle / n_steps) * sign);

  for (let i of range(0, n_steps)) {
    let a1 = arc.start_angle.add(step.mul(i));
    let a2 = arc.start_angle.add(step.mul(i + 1));

    let v1 = sample_ellipse(arc.radii, arc.x_rotation, a1).to_vector();
    let v2 = sample_ellipse(arc.radii, arc.x_rotation, a2).to_vector();
    let from = arc.center.add(v1);
    let to = arc.center.add(v2);

    // From http://www.spaceroots.org/documents/ellipse/elliptical-arc.pdf
    // Note that the parameterization used by Arc (see sample_ellipse for
    // example) is the same as the eta-parameterization used at the link.
    let delta_a = a2.sub(a1);
    let tan_da = Math.tan(delta_a.get() * 0.5);
    let alpha_sqrt = Math.sqrt(4 + 3 * tan_da * tan_da);
    let alpha = (Math.sin(delta_a.get()) * (alpha_sqrt - 1)) / 3;
    let ctrl1 = from.add(arc.tangent_at_angle(a1).mul(alpha));
    let ctrl2 = to.sub(arc.tangent_at_angle(a2).mul(alpha));

    callback(new CubicBezierSegment(from, ctrl1, ctrl2, to));
  }
}

export function sample_ellipse<U>(radii: Vector<U>, x_rotation: Angle, angle: Angle): Point<U> {
  return Rotation2D.from_angle(x_rotation).transform_point(
    point(radii.x * Math.cos(angle.get()), radii.y * Math.sin(angle.get()))
  );
}
