import { Self, Clone, clone, Debug, format, ImplPartialEq, eq } from "@rusts/std";
import { Angle, Arc, ArcFlags, Point, point, Vector, vector } from "../internal";
import { SvgBuilder, PolygonBuilder } from "./internal";

enum LastCtrlType {
  Cubic = "Cubic",
  Quad = "Quad",
  None = "None"
}

export type LastCtrlPayloadVariant<T, P> = { type: T; value: P };

function create_last_ctrl_payload<T extends LastCtrlType, S>(
  type: T,
  value: S
): LastCtrlPayloadVariant<T, S> {
  return { type, value };
}

export const LastCtrlPayloads = {
  Cubic: (payload: Point) => create_last_ctrl_payload(LastCtrlType.Cubic, payload),
  Quad: (payload: Point) => create_last_ctrl_payload(LastCtrlType.Quad, payload),
  None: () => create_last_ctrl_payload(LastCtrlType.None, undefined)
};

export type LastCtrlPayload = ReturnType<typeof LastCtrlPayloads[keyof typeof LastCtrlPayloads]>;

/**
 * Path event enum that can only represent line segments.
 *
 * Useful for algorithms that approximate all curves with line segments.
 */
export class LastCtrl extends ImplPartialEq(Self) implements Clone, Debug {
  public Self!: LastCtrl;

  public payload: LastCtrlPayload;

  private constructor(payload: LastCtrlPayload) {
    super();
    this.payload = payload;
  }

  public static Cubic(payload: Point): LastCtrl {
    return new LastCtrl(LastCtrlPayloads.Cubic(payload));
  }
  public static Quad(payload: Point): LastCtrl {
    return new LastCtrl(LastCtrlPayloads.Quad(payload));
  }
  public static None(): LastCtrl {
    return new LastCtrl(LastCtrlPayloads.None());
  }

  public match(): LastCtrlPayload {
    return this.payload;
  }

  // Clone
  public clone(): this["Self"] {
    return new LastCtrl(clone(this.payload));
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    if (this.payload.type === other.payload.type) {
      return eq(this.payload.value, other.payload.value);
    } else {
      return false;
    }
  }

  // Debug
  public fmt_debug(): string {
    return format("{:?}({:?})", this.payload.type, this.payload.value);
  }
}

/**
 * Represents the current state of a path while it is being built.
 */
export class PathState extends ImplPartialEq(SvgBuilder) implements Clone, Debug, PolygonBuilder {
  public Self!: PathState;

  // The current point.
  protected current: Point;
  // The first point of the current sub-path;
  protected first: Point;
  // THe last control point.
  protected last_ctrl: LastCtrl;

  public constructor() {
    super();
    this.current = Point.zero();
    this.first = Point.zero();
    this.last_ctrl = LastCtrl.None();
  }

  // The position at the start of the current sub-path.
  public start_position(): Point {
    return this.first;
  }

  public get_smooth_cubic_ctrl(): Point {
    let match = this.last_ctrl.match();
    switch (match.type) {
      case LastCtrlType.Cubic:
        return this.current.add(this.current.sub(match.value));
      default:
        return this.current;
    }
  }

  public get_smooth_quadratic_ctrl(): Point {
    let match = this.last_ctrl.match();
    switch (match.type) {
      case LastCtrlType.Quad:
        return this.current.add(this.current.sub(match.value));
      default:
        return this.current;
    }
  }

  public relative_to_absolute(v: Vector): Point {
    return this.current.add(v);
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    this.last_ctrl = LastCtrl.None();
    this.current = to;
    this.first = to;
  }

  public line_to(to: Point) {
    this.last_ctrl = LastCtrl.None();
    this.current = to;
  }

  public close() {
    this.last_ctrl = LastCtrl.None();
    this.current = this.first;
  }

  public current_position(): Point {
    return this.current;
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    this.last_ctrl = LastCtrl.Quad(ctrl);
    this.current = to;
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    this.last_ctrl = LastCtrl.Cubic(ctrl2);
    this.current = to;
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    let start_angle = this.current
      .sub(center)
      .angle_from_x_axis()
      .sub(x_rotation);
    let arc = new Arc(center, radii, start_angle, sweep_angle, x_rotation);
    this.last_ctrl = LastCtrl.None();
    this.current = arc.to();
  }

  // SvgBuilder
  public relative_move_to(to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    this.move_to(to_pt);
  }
  public relative_line_to(to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    this.line_to(to_pt);
  }
  public relative_quadratic_bezier_to(ctrl: Vector, to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    let ctrl_pt = this.relative_to_absolute(ctrl);
    this.last_ctrl = LastCtrl.Quad(ctrl_pt);
    this.current = to_pt;
  }
  public relative_cubic_bezier_to(_ctrl1: Vector, ctrl2: Vector, to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    let ctrl2_pt = this.relative_to_absolute(ctrl2);
    this.last_ctrl = LastCtrl.Cubic(ctrl2_pt);
    this.current = to_pt;
  }
  public smooth_cubic_bezier_to(ctrl2: Point, to: Point) {
    this.last_ctrl = LastCtrl.Cubic(ctrl2);
    this.current = to;
  }
  public smooth_relative_cubic_bezier_to(ctrl2: Vector, to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    let ctrl2_pt = this.relative_to_absolute(ctrl2);
    this.last_ctrl = LastCtrl.Cubic(ctrl2_pt);
    this.current = to_pt;
  }
  public smooth_quadratic_bezier_to(to: Point) {
    let last_ctrl: Point;
    let match = this.last_ctrl.match();
    switch (match.type) {
      case LastCtrlType.Quad:
        last_ctrl = match.value;
        break;
      default:
        last_ctrl = this.current;
        break;
    }
    this.last_ctrl = LastCtrl.Quad(to.add(to.sub(last_ctrl)));
    this.current = to;
  }
  public smooth_relative_quadratic_bezier_to(to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    let last_ctrl: Point;
    let match = this.last_ctrl.match();
    switch (match.type) {
      case LastCtrlType.Quad:
        last_ctrl = match.value;
        break;
      default:
        last_ctrl = this.current;
        break;
    }
    this.last_ctrl = LastCtrl.Quad(to_pt.add(to_pt.sub(last_ctrl)));
    this.current = to_pt;
  }
  public horizontal_line_to(x: number) {
    let to_pt = point(x, this.current.y);
    this.line_to(to_pt);
  }
  public relative_horizontal_line_to(dx: number) {
    let to_pt = this.current.add(vector(dx, 0));
    this.line_to(to_pt);
  }
  public vertical_line_to(y: number) {
    let to_pt = point(this.current.x, y);
    this.line_to(to_pt);
  }
  public relative_vertical_line_to(dy: number) {
    let to_pt = this.current.add(vector(0, dy));
    this.line_to(to_pt);
  }
  public arc_to(_radii: Vector, _x_rotation: Angle, _flags: ArcFlags, to: Point) {
    this.last_ctrl = LastCtrl.None();
    this.current = to;
  }
  public relative_arc_to(_radii: Vector, _x_rotation: Angle, _flags: ArcFlags, to: Vector) {
    let to_pt = this.relative_to_absolute(to);
    this.last_ctrl = LastCtrl.None();
    this.current = to_pt;
  }

  // Clone
  public clone(): this["Self"] {
    let ps = new PathState();
    ps.current = this.current.clone();
    ps.first = this.first.clone();
    ps.last_ctrl = this.last_ctrl.clone();
    return ps;
  }

  // Debug
  public fmt_debug(): string {
    return format("PathState({:?},{:?},{:?})", this.current, this.first, this.last_ctrl);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.current.eq(other.current) &&
      this.first.eq(other.first) &&
      this.last_ctrl.eq(other.last_ctrl)
    );
  }

  // PolygonBuilder
  public polygon(points: Point[]) {
    this.last_ctrl = LastCtrl.None();
    if (points[0]) {
      this.current = points[0];
    }
  }
}
