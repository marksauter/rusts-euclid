import { Self, isNil, isFunction, abstract_panic } from "@rusts/std";
import {
  Arc,
  ArcFlags,
  SvgArc,
  Angle,
  Point,
  QuadraticBezierSegment,
  CubicBezierSegment,
  Vector
} from "../internal";
import {
  PathEvent,
  PathEventType,
  SvgEvent,
  SvgEventType,
  FlattenedEvent,
  FlattenedEventType,
  PathState
} from "./internal";

export interface Build {
  /**
   * The type of object that is created by this builder.
   */
  PathType: any;

  /**
   * Builds a path object.
   */
  build(): this["PathType"];

  /**
   * Builds a path object and resets the builder so that it can be used again.
   */
  build_and_reset(): this["PathType"];
}

export function isBuild(t: any): t is Build {
  return !isNil(t) && isFunction((t as Build).build);
}

export class FlatPathBuilder extends Self {
  /**
   * Sets the current position in preparation for the next sub-path.
   * If the current sub-path contains edges, this ends the sub-path without
   * closing it.
   */
  public move_to(to: Point) {
    abstract_panic("FlatPathBuilder", "move_to");
  }

  /**
   * Adds a line segment to the current sub-path and set the current position.
   */
  public line_to(to: Point) {
    abstract_panic("FlatPathBuilder", "line_to");
  }

  /**
   * Closes the current sub path and sets the current position to the first
   * position of this the current sub-path.
   *
   * Subsequent commands will affect the next sub-path.
   */
  public close() {
    abstract_panic("FlatPathBuilder", "close");
  }

  public current_position(): Point {
    abstract_panic("FlatPathBuilder", "current_position");
    // Unreachable
    return (undefined as unknown) as Point;
  }

  public flat_event(event: FlattenedEvent) {
    let match = event.match();
    switch (match.type) {
      case FlattenedEventType.MoveTo:
        return this.move_to(match.value);
      case FlattenedEventType.Line: {
        let segment = match.value;
        return this.line_to(segment.to());
      }
      case FlattenedEventType.Close:
        return this.close();
    }
  }

  public flattened(tolerance: number): FlatteningBuilder<this> {
    return FlatteningBuilder.new(this, tolerance);
  }
}

/**
 * The main path building interface. More elaborate interfaces are built on top
 * of the provided primitives.
 */
export class PathBuilder extends FlatPathBuilder {
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    abstract_panic("PathBuilder", "quadratic_bezier_to");
  }
  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    abstract_panic("PathBuilder", "cubic_bezier_to");
  }
  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    abstract_panic("PathBuilder", "arc");
  }

  public path_event(event: PathEvent) {
    let match = event.match();
    switch (match.type) {
      case PathEventType.MoveTo:
        return this.move_to(match.value);
      case PathEventType.Line: {
        let segment = match.value;
        return this.line_to(segment.to());
      }
      case PathEventType.Quadratic: {
        let segment = match.value;
        return this.quadratic_bezier_to(segment.ctrl, segment.to());
      }
      case PathEventType.Cubic: {
        let segment = match.value;
        return this.cubic_bezier_to(segment.ctrl1, segment.ctrl2, segment.to());
      }
      case PathEventType.Close:
        return this.close();
    }
  }

  /**
   * Returns a builder that support svg commands.
   */
  public with_svg<Self extends PathBuilder & Build>(this: Self): SvgPathBuilderAndBuild<Self>;
  public with_svg(): SvgPathBuilder<this>;
  public with_svg(): any {
    return SvgPathBuilder.new(this);
  }
}

/**
 * A path building interface that tries to stay close to SVG's path specification.
 * https://svgwg.org/specs/paths/
 */
export class SvgBuilder extends PathBuilder {
  public relative_move_to(to: Vector) {
    abstract_panic("SvgBuilder", "relative_move_to");
  }
  public relative_line_to(to: Vector) {
    abstract_panic("SvgBuilder", "relative_line_to");
  }
  public relative_quadratic_bezier_to(ctrl: Vector, to: Vector) {
    abstract_panic("SvgBuilder", "relative_quadratic_bezier_to");
  }
  public relative_cubic_bezier_to(ctrl1: Vector, ctrl2: Vector, to: Vector) {
    abstract_panic("SvgBuilder", "relative_cubic_bezier_to");
  }
  public smooth_cubic_bezier_to(ctrl2: Point, to: Point) {
    abstract_panic("SvgBuilder", "smooth_cubic_bezier_to");
  }
  public smooth_relative_cubic_bezier_to(ctrl2: Vector, to: Vector) {
    abstract_panic("SvgBuilder", "smooth_relative_cubic_bezier_to");
  }
  public smooth_quadratic_bezier_to(to: Point) {
    abstract_panic("SvgBuilder", "smooth_quadratic_bezier_to");
  }
  public smooth_relative_quadratic_bezier_to(to: Vector) {
    abstract_panic("SvgBuilder", "smooth_relative_cubic_bezier_to");
  }
  public horizontal_line_to(x: number) {
    abstract_panic("SvgBuilder", "horizontal_line_to");
  }
  public relative_horizontal_line_to(dx: number) {
    abstract_panic("SvgBuilder", "relative_horizontal_line_to");
  }
  public vertical_line_to(y: number) {
    abstract_panic("SvgBuilder", "vertical_line_to");
  }
  public relative_vertical_line_to(dy: number) {
    abstract_panic("SvgBuilder", "relative_vertical_line_to");
  }
  public arc_to(radii: Vector, x_rotation: Angle, flags: ArcFlags, to: Point) {
    abstract_panic("SvgBuilder", "arc_to");
  }
  public relative_arc_to(radii: Vector, x_rotation: Angle, flags: ArcFlags, to: Vector) {
    abstract_panic("SvgBuilder", "relative_arc_to");
  }

  public svg_event(event: SvgEvent) {
    let match = event.match();
    switch (match.type) {
      case SvgEventType.MoveTo:
        return this.move_to(match.value);
      case SvgEventType.LineTo:
        return this.line_to(match.value);
      case SvgEventType.QuadraticTo: {
        let [ctrl, to] = match.value;
        return this.quadratic_bezier_to(ctrl, to);
      }
      case SvgEventType.CubicTo: {
        let [ctrl1, ctrl2, to] = match.value;
        return this.cubic_bezier_to(ctrl1, ctrl2, to);
      }
      case SvgEventType.Close:
        return this.close();
      case SvgEventType.ArcTo: {
        let [radii, x_rotation, flags, to] = match.value;
        return this.arc_to(radii, x_rotation, flags, to);
      }
      case SvgEventType.RelativeArcTo: {
        let [radii, x_rotation, flags, to] = match.value;
        return this.relative_arc_to(radii, x_rotation, flags, to);
      }
      case SvgEventType.RelativeMoveTo:
        return this.relative_move_to(match.value);
      case SvgEventType.RelativeLineTo:
        return this.relative_line_to(match.value);
      case SvgEventType.RelativeQuadraticTo: {
        let [ctrl, to] = match.value;
        return this.relative_quadratic_bezier_to(ctrl, to);
      }
      case SvgEventType.RelativeCubicTo: {
        let [ctrl1, ctrl2, to] = match.value;
        return this.relative_cubic_bezier_to(ctrl1, ctrl2, to);
      }
      case SvgEventType.HorizontalLineTo: {
        return this.horizontal_line_to(match.value);
      }
      case SvgEventType.VerticalLineTo: {
        return this.vertical_line_to(match.value);
      }
      case SvgEventType.RelativeHorizontalLineTo: {
        return this.relative_horizontal_line_to(match.value);
      }
      case SvgEventType.RelativeVerticalLineTo: {
        return this.relative_vertical_line_to(match.value);
      }
      case SvgEventType.SmoothQuadraticTo: {
        return this.smooth_quadratic_bezier_to(match.value);
      }
      case SvgEventType.SmoothCubicTo: {
        let [ctrl2, to] = match.value;
        return this.smooth_cubic_bezier_to(ctrl2, to);
      }
      case SvgEventType.SmoothRelativeQuadraticTo: {
        return this.smooth_relative_quadratic_bezier_to(match.value);
      }
      case SvgEventType.SmoothRelativeCubicTo: {
        let [ctrl2, to] = match.value;
        return this.smooth_relative_cubic_bezier_to(ctrl2, to);
      }
    }
  }
}

/**
 * Build a path from simple list of points.
 */
export interface PolygonBuilder {
  /**
   * Add a closed polygon.
   */
  polygon(points: Point[]): void;
}

export function isPolygonBuilder(t: any): t is PolygonBuilder {
  return !isNil(t) && isFunction((t as PolygonBuilder).polygon);
}

export function build_polygon<B extends FlatPathBuilder>(builder: B, points: Point[]) {
  if (points.len() < 2) {
    return;
  }

  builder.move_to(points[0]);
  for (let p of points.slice(1)) {
    builder.line_to(p);
  }
  builder.close();
}

/**
 * Implements the Svg building interface on top of a PathBuilder.
 */
export class SvgPathBuilder<B extends PathBuilder> extends SvgBuilder {
  public Self!: SvgPathBuilder<B>;

  public builder: B;
  public state: PathState;

  private constructor(builder: B) {
    super();
    this.builder = builder;
    this.state = new PathState();
  }

  public static new<B extends PathBuilder & Build>(builder: B): SvgPathBuilderAndBuild<B>;
  public static new<B extends PathBuilder>(builder: B): SvgPathBuilder<B>;
  public static new(builder: any): any {
    if (builder instanceof PathBuilder && isBuild(builder)) {
      return new SvgPathBuilderAndBuild(builder);
    } else {
      return new SvgPathBuilder(builder);
    }
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    this.state.move_to(to);
    this.builder.move_to(to);
  }

  public line_to(to: Point) {
    this.state.line_to(to);
    this.builder.line_to(to);
  }

  public close() {
    this.state.close();
    this.builder.close();
  }

  public current_position(): Point {
    return this.state.current_position();
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    this.state.quadratic_bezier_to(ctrl, to);
    this.builder.quadratic_bezier_to(ctrl, to);
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    this.state.cubic_bezier_to(ctrl1, ctrl2, to);
    this.builder.cubic_bezier_to(ctrl1, ctrl2, to);
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    this.state.arc(center, radii, sweep_angle, x_rotation);
    this.builder.arc(center, radii, sweep_angle, x_rotation);
  }

  // SvgBuilder
  public relative_move_to(to: Vector) {
    this.state.relative_move_to(to);
    this.builder.move_to(this.state.current_position());
  }

  public relative_line_to(to: Vector) {
    this.state.relative_line_to(to);
    this.builder.line_to(this.state.current_position());
  }

  public relative_quadratic_bezier_to(ctrl: Vector, to: Vector) {
    let offset = this.state.current_position();
    this.state.relative_quadratic_bezier_to(ctrl, to);
    this.builder.quadratic_bezier_to(offset.add(ctrl), offset.add(to));
  }

  public relative_cubic_bezier_to(ctrl1: Vector, ctrl2: Vector, to: Vector) {
    let offset = this.state.current_position();
    this.state.relative_cubic_bezier_to(ctrl1, ctrl2, to);
    this.builder.cubic_bezier_to(offset.add(ctrl1), offset.add(ctrl2), offset.add(to));
  }

  public smooth_cubic_bezier_to(ctrl2: Point, to: Point) {
    let ctrl1 = this.state.get_smooth_cubic_ctrl();
    this.state.smooth_cubic_bezier_to(ctrl2, to);
    this.builder.cubic_bezier_to(ctrl1, ctrl2, to);
  }

  public smooth_relative_cubic_bezier_to(ctrl2: Vector, to: Vector) {
    let ctrl1 = this.state.get_smooth_cubic_ctrl();
    let offset = this.state.current_position();
    this.state.smooth_relative_cubic_bezier_to(ctrl2, to);
    this.builder.cubic_bezier_to(ctrl1, offset.add(ctrl2), offset.add(to));
  }

  public smooth_quadratic_bezier_to(to: Point) {
    let ctrl = this.state.get_smooth_quadratic_ctrl();
    this.state.smooth_quadratic_bezier_to(to);
    this.builder.quadratic_bezier_to(ctrl, to);
  }

  public smooth_relative_quadratic_bezier_to(to: Vector) {
    let ctrl = this.state.get_smooth_quadratic_ctrl();
    let offset = this.state.current_position();
    this.state.smooth_relative_quadratic_bezier_to(to);
    this.builder.quadratic_bezier_to(ctrl, offset.add(to));
  }

  public horizontal_line_to(x: number) {
    this.state.horizontal_line_to(x);
    this.builder.line_to(this.state.current_position());
  }

  public relative_horizontal_line_to(dx: number) {
    this.state.relative_horizontal_line_to(dx);
    this.builder.line_to(this.state.current_position());
  }

  public vertical_line_to(y: number) {
    this.state.vertical_line_to(y);
    this.builder.line_to(this.state.current_position());
  }

  public relative_vertical_line_to(dy: number) {
    this.state.relative_vertical_line_to(dy);
    this.builder.line_to(this.state.current_position());
  }

  public arc_to(radii: Vector, x_rotation: Angle, flags: ArcFlags, to: Point) {
    new SvgArc(
      this.state.current_position(),
      to,
      radii,
      x_rotation,
      new ArcFlags(flags.large_arc, flags.sweep)
    ).for_each_quadratic_bezier((curve: QuadraticBezierSegment) => {
      this.quadratic_bezier_to(curve.ctrl, curve.to());
    });
    this.state.arc_to(radii, x_rotation, flags, to);
  }

  public relative_arc_to(radii: Vector, x_rotation: Angle, flags: ArcFlags, to: Vector) {
    let offset = this.state.current_position();
    this.arc_to(radii, x_rotation, flags, offset.add(to));
  }
}

export class SvgPathBuilderAndBuild<B extends PathBuilder & Build> extends SvgBuilder
  implements Build {
  public Self!: SvgPathBuilderAndBuild<B>;

  public builder: B;
  public state: PathState;

  public constructor(builder: B) {
    super();
    this.builder = builder;
    this.state = new PathState();
  }

  // Build
  public PathType!: B["PathType"];

  public build(): this["PathType"] {
    return this.builder.build();
  }

  public build_and_reset(): this["PathType"] {
    return this.builder.build_and_reset();
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    this.state.move_to(to);
    this.builder.move_to(to);
  }

  public line_to(to: Point) {
    this.state.line_to(to);
    this.builder.line_to(to);
  }

  public close() {
    this.state.close();
    this.builder.close();
  }

  public current_position(): Point {
    return this.state.current_position();
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    this.state.quadratic_bezier_to(ctrl, to);
    this.builder.quadratic_bezier_to(ctrl, to);
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    this.state.cubic_bezier_to(ctrl1, ctrl2, to);
    this.builder.cubic_bezier_to(ctrl1, ctrl2, to);
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    this.state.arc(center, radii, sweep_angle, x_rotation);
    this.builder.arc(center, radii, sweep_angle, x_rotation);
  }

  // SvgBuilder
  public relative_move_to(to: Vector) {
    this.state.relative_move_to(to);
    this.builder.move_to(this.state.current_position());
  }

  public relative_line_to(to: Vector) {
    this.state.relative_line_to(to);
    this.builder.line_to(this.state.current_position());
  }

  public relative_quadratic_bezier_to(ctrl: Vector, to: Vector) {
    let offset = this.state.current_position();
    this.state.relative_quadratic_bezier_to(ctrl, to);
    this.builder.quadratic_bezier_to(offset.add(ctrl), offset.add(to));
  }

  public relative_cubic_bezier_to(ctrl1: Vector, ctrl2: Vector, to: Vector) {
    let offset = this.state.current_position();
    this.state.relative_cubic_bezier_to(ctrl1, ctrl2, to);
    this.builder.cubic_bezier_to(offset.add(ctrl1), offset.add(ctrl2), offset.add(to));
  }

  public smooth_cubic_bezier_to(ctrl2: Point, to: Point) {
    let ctrl1 = this.state.get_smooth_cubic_ctrl();
    this.state.smooth_cubic_bezier_to(ctrl2, to);
    this.builder.cubic_bezier_to(ctrl1, ctrl2, to);
  }

  public smooth_relative_cubic_bezier_to(ctrl2: Vector, to: Vector) {
    let ctrl1 = this.state.get_smooth_cubic_ctrl();
    let offset = this.state.current_position();
    this.state.smooth_relative_cubic_bezier_to(ctrl2, to);
    this.builder.cubic_bezier_to(ctrl1, offset.add(ctrl2), offset.add(to));
  }

  public smooth_quadratic_bezier_to(to: Point) {
    let ctrl = this.state.get_smooth_quadratic_ctrl();
    this.state.smooth_quadratic_bezier_to(to);
    this.builder.quadratic_bezier_to(ctrl, to);
  }

  public smooth_relative_quadratic_bezier_to(to: Vector) {
    let ctrl = this.state.get_smooth_quadratic_ctrl();
    let offset = this.state.current_position();
    this.state.smooth_relative_quadratic_bezier_to(to);
    this.builder.quadratic_bezier_to(ctrl, offset.add(to));
  }

  public horizontal_line_to(x: number) {
    this.state.horizontal_line_to(x);
    this.builder.line_to(this.state.current_position());
  }

  public relative_horizontal_line_to(dx: number) {
    this.state.relative_horizontal_line_to(dx);
    this.builder.line_to(this.state.current_position());
  }

  public vertical_line_to(y: number) {
    this.state.vertical_line_to(y);
    this.builder.line_to(this.state.current_position());
  }

  public relative_vertical_line_to(dy: number) {
    this.state.relative_vertical_line_to(dy);
    this.builder.line_to(this.state.current_position());
  }

  public arc_to(radii: Vector, x_rotation: Angle, flags: ArcFlags, to: Point) {
    new SvgArc(
      this.state.current_position(),
      to,
      radii,
      x_rotation,
      new ArcFlags(flags.large_arc, flags.sweep)
    ).for_each_quadratic_bezier((curve: QuadraticBezierSegment) => {
      this.quadratic_bezier_to(curve.ctrl, curve.to());
    });
    this.state.arc_to(radii, x_rotation, flags, to);
  }

  public relative_arc_to(radii: Vector, x_rotation: Angle, flags: ArcFlags, to: Vector) {
    let offset = this.state.current_position();
    this.arc_to(radii, x_rotation, flags, offset.add(to));
  }
}

/**
 * Generates flattened paths.
 */
export class FlatteningBuilder<B extends FlatPathBuilder> extends PathBuilder {
  public Self!: FlatteningBuilder<B>;

  public builder: B;
  public tolerance: number;

  private constructor(builder: B, tolerance: number) {
    super();
    this.builder = builder;
    this.tolerance = tolerance;
  }

  public static new<B extends FlatPathBuilder & Build>(
    builder: B,
    tolerance: number
  ): FlatteningBuilderAndBuild<B>;
  public static new<B extends FlatPathBuilder>(builder: B, tolerance: number): FlatteningBuilder<B>;
  public static new(builder: any, tolerance: number): any {
    if (builder instanceof FlatPathBuilder && isBuild(builder)) {
      return new FlatteningBuilderAndBuild(builder, tolerance);
    } else {
      return new FlatteningBuilder(builder, tolerance);
    }
  }

  public set_tolerance(tolerance: number) {
    this.tolerance = tolerance;
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    this.builder.move_to(to);
  }

  public line_to(to: Point) {
    this.builder.line_to(to);
  }

  public close() {
    this.builder.close();
  }

  public current_position(): Point {
    return this.builder.current_position();
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    new QuadraticBezierSegment(this.current_position(), ctrl, to).for_each_flattened(
      this.tolerance,
      (point: Point) => {
        this.line_to(point);
      }
    );
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    new CubicBezierSegment(this.current_position(), ctrl1, ctrl2, to).for_each_flattened(
      this.tolerance,
      (point: Point) => {
        this.line_to(point);
      }
    );
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    let start_angle = this.current_position()
      .sub(center)
      .angle_from_x_axis()
      .sub(x_rotation);
    new Arc(center, radii, start_angle, sweep_angle, x_rotation).for_each_quadratic_bezier(
      (curve: QuadraticBezierSegment) => {
        this.quadratic_bezier_to(curve.ctrl, curve.to());
      }
    );
  }
}

export class FlatteningBuilderAndBuild<B extends FlatPathBuilder & Build> extends PathBuilder
  implements Build {
  public Self!: FlatteningBuilderAndBuild<B>;

  public builder: B;
  public tolerance: number;

  public constructor(builder: B, tolerance: number) {
    super();
    this.builder = builder;
    this.tolerance = tolerance;
  }

  public set_tolerance(tolerance: number) {
    this.tolerance = tolerance;
  }

  // Build
  public PathType!: B["PathType"];

  public build(): this["PathType"] {
    return this.builder.build();
  }

  public build_and_reset(): this["PathType"] {
    return this.builder.build_and_reset();
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    this.builder.move_to(to);
  }

  public line_to(to: Point) {
    this.builder.line_to(to);
  }

  public close() {
    this.builder.close();
  }

  public current_position(): Point {
    return this.builder.current_position();
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    new QuadraticBezierSegment(this.current_position(), ctrl, to).for_each_flattened(
      this.tolerance,
      (point: Point) => {
        this.line_to(point);
      }
    );
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    new CubicBezierSegment(this.current_position(), ctrl1, ctrl2, to).for_each_flattened(
      this.tolerance,
      (point: Point) => {
        this.line_to(point);
      }
    );
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    let start_angle = this.current_position()
      .sub(center)
      .angle_from_x_axis()
      .sub(x_rotation);
    new Arc(center, radii, start_angle, sweep_angle, x_rotation).for_each_quadratic_bezier(
      (curve: QuadraticBezierSegment) => {
        this.quadratic_bezier_to(curve.ctrl, curve.to());
      }
    );
  }
}
