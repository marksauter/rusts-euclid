import { Self, ImplPartialEq, eq, Clone, clone, Debug, format } from "@rusts/std";
import {
  Point,
  Vector,
  LineSegment,
  QuadraticBezierSegment,
  CubicBezierSegment,
  Angle,
  ArcFlags,
  Transform,
  Transform2D
} from "../internal";

export type EventPayloadVariant<T, V> = { type: T; value: V };

function create_svg_event_payload<T extends SvgEventType, S>(
  type: T,
  value: S
): EventPayloadVariant<T, S> {
  return { type, value };
}

export enum SvgEventType {
  MoveTo = "MoveTo",
  RelativeMoveTo = "RelativeMoveTo",
  LineTo = "LineTo",
  RelativeLineTo = "RelativeLineTo",
  QuadraticTo = "QuadraticTo",
  RelativeQuadraticTo = "RelativeQuadraticTo",
  CubicTo = "CubicTo",
  RelativeCubicTo = "RelativeCubicTo",
  ArcTo = "ArcTo",
  RelativeArcTo = "RelativeArcTo",
  HorizontalLineTo = "HorizontalLineTo",
  VerticalLineTo = "VerticalLineTo",
  RelativeHorizontalLineTo = "RelativeHorizontalLineTo",
  RelativeVerticalLineTo = "RelativeVerticalLineTo",
  SmoothQuadraticTo = "SmoothQuadraticTo",
  SmoothRelativeQuadraticTo = "SmoothRelativeQuadraticTo",
  SmoothCubicTo = "SmoothCubicTo",
  SmoothRelativeCubicTo = "SmoothRelativeCubicTo",
  Close = "Close"
}

export const SvgEventPayloads = {
  MoveTo: (payload: Point) => create_svg_event_payload(SvgEventType.MoveTo, payload),
  RelativeMoveTo: (payload: Vector) =>
    create_svg_event_payload(SvgEventType.RelativeMoveTo, payload),
  LineTo: (payload: Point) => create_svg_event_payload(SvgEventType.LineTo, payload),
  RelativeLineTo: (payload: Vector) =>
    create_svg_event_payload(SvgEventType.RelativeLineTo, payload),
  QuadraticTo: (payload: [Point, Point]) =>
    create_svg_event_payload(SvgEventType.QuadraticTo, payload),
  RelativeQuadraticTo: (payload: [Vector, Vector]) =>
    create_svg_event_payload(SvgEventType.RelativeQuadraticTo, payload),
  CubicTo: (payload: [Point, Point, Point]) =>
    create_svg_event_payload(SvgEventType.CubicTo, payload),
  RelativeCubicTo: (payload: [Vector, Vector, Vector]) =>
    create_svg_event_payload(SvgEventType.RelativeCubicTo, payload),
  ArcTo: (payload: [Vector, Angle, ArcFlags, Point]) =>
    create_svg_event_payload(SvgEventType.ArcTo, payload),
  RelativeArcTo: (payload: [Vector, Angle, ArcFlags, Vector]) =>
    create_svg_event_payload(SvgEventType.RelativeArcTo, payload),
  HorizontalLineTo: (payload: number) =>
    create_svg_event_payload(SvgEventType.HorizontalLineTo, payload),
  VerticalLineTo: (payload: number) =>
    create_svg_event_payload(SvgEventType.VerticalLineTo, payload),
  RelativeHorizontalLineTo: (payload: number) =>
    create_svg_event_payload(SvgEventType.RelativeHorizontalLineTo, payload),
  RelativeVerticalLineTo: (payload: number) =>
    create_svg_event_payload(SvgEventType.RelativeVerticalLineTo, payload),
  SmoothQuadraticTo: (payload: Point) =>
    create_svg_event_payload(SvgEventType.SmoothQuadraticTo, payload),
  SmoothRelativeQuadraticTo: (payload: Vector) =>
    create_svg_event_payload(SvgEventType.SmoothRelativeQuadraticTo, payload),
  SmoothCubicTo: (payload: [Point, Point]) =>
    create_svg_event_payload(SvgEventType.SmoothCubicTo, payload),
  SmoothRelativeCubicTo: (payload: [Vector, Vector]) =>
    create_svg_event_payload(SvgEventType.SmoothRelativeCubicTo, payload),
  Close: () => create_svg_event_payload(SvgEventType.Close, undefined)
};

export type SvgEventPayload = ReturnType<typeof SvgEventPayloads[keyof typeof SvgEventPayloads]>;

/**
 * Path event enum can represent all of SVG's path description syntax.
 *
 * See the SVG specification: https://www.w3.org/TR/SVG/paths.html
 */
export class SvgEvent extends ImplPartialEq(Self) implements Clone, Debug {
  public Self!: SvgEvent;

  public payload: SvgEventPayload;

  private constructor(payload: SvgEventPayload) {
    super();
    this.payload = payload;
  }

  public static MoveTo(payload: Point): SvgEvent {
    return new SvgEvent(SvgEventPayloads.MoveTo(payload));
  }
  public static RelativeMoveTo(payload: Vector): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeMoveTo(payload));
  }
  public static LineTo(payload: Point): SvgEvent {
    return new SvgEvent(SvgEventPayloads.LineTo(payload));
  }
  public static RelativeLineTo(payload: Vector): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeLineTo(payload));
  }
  public static QuadraticTo(payload: [Point, Point]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.QuadraticTo(payload));
  }
  public static RelativeQuadraticTo(payload: [Vector, Vector]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeQuadraticTo(payload));
  }
  public static CubicTo(payload: [Point, Point, Point]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.CubicTo(payload));
  }
  public static RelativeCubicTo(payload: [Vector, Vector, Vector]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeCubicTo(payload));
  }
  // Elliptic arc represented with the radii, the x axis rotation, arc flags
  // and the destination point.
  public static ArcTo(payload: [Vector, Angle, ArcFlags, Point]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.ArcTo(payload));
  }
  // Elliptic arc represented with the radii, the x axis rotation, arc flags
  // and the vector from the current position to the destination point.
  public static RelativeArcTo(payload: [Vector, Angle, ArcFlags, Vector]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeArcTo(payload));
  }
  public static HorizontalLineTo(payload: number): SvgEvent {
    return new SvgEvent(SvgEventPayloads.HorizontalLineTo(payload));
  }
  public static VerticalLineTo(payload: number): SvgEvent {
    return new SvgEvent(SvgEventPayloads.VerticalLineTo(payload));
  }
  public static RelativeHorizontalLineTo(payload: number): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeHorizontalLineTo(payload));
  }
  public static RelativeVerticalLineTo(payload: number): SvgEvent {
    return new SvgEvent(SvgEventPayloads.RelativeVerticalLineTo(payload));
  }
  public static SmoothQuadraticTo(payload: Point): SvgEvent {
    return new SvgEvent(SvgEventPayloads.SmoothQuadraticTo(payload));
  }
  public static SmoothRelativeQuadraticTo(payload: Vector): SvgEvent {
    return new SvgEvent(SvgEventPayloads.SmoothRelativeQuadraticTo(payload));
  }
  public static SmoothCubicTo(payload: [Point, Point]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.SmoothCubicTo(payload));
  }
  public static SmoothRelativeCubicTo(payload: [Vector, Vector]): SvgEvent {
    return new SvgEvent(SvgEventPayloads.SmoothRelativeCubicTo(payload));
  }
  public static Close(): SvgEvent {
    return new SvgEvent(SvgEventPayloads.Close());
  }

  public match(): SvgEventPayload {
    return this.payload;
  }

  // Clone
  public clone(): this["Self"] {
    return new SvgEvent(clone(this.payload));
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
    return format(`${this.payload.type}({:?})`, this.payload.value);
  }
}

export interface IntoSvgEvent {
  to_svg_event(): SvgEvent;
}

export enum PathEventType {
  MoveTo = "MoveTo",
  Line = "Line",
  Quadratic = "Quadratic",
  Cubic = "Cubic",
  Close = "Close"
}

function create_path_event_payload<T extends PathEventType, S>(
  type: T,
  value: S
): EventPayloadVariant<T, S> {
  return { type, value };
}

export const PathEventPayloads = {
  MoveTo: (payload: Point) => create_path_event_payload(PathEventType.MoveTo, payload),
  Line: (payload: LineSegment) => create_path_event_payload(PathEventType.Line, payload),
  Quadratic: (payload: QuadraticBezierSegment) =>
    create_path_event_payload(PathEventType.Quadratic, payload),
  Cubic: (payload: CubicBezierSegment) => create_path_event_payload(PathEventType.Cubic, payload),
  Close: (payload: LineSegment) => create_path_event_payload(PathEventType.Close, payload)
};

export type PathEventPayload = ReturnType<typeof PathEventPayloads[keyof typeof PathEventPayloads]>;

/**
 * Path event enum that represents all operations in absolute coordinates.
 *
 * Can express the same curves as `SvgEvent` with a simpler representation.
 */
export class PathEvent extends ImplPartialEq(Self) implements Clone, Debug, Transform {
  public Self!: PathEvent;

  public payload: PathEventPayload;

  private constructor(payload: PathEventPayload) {
    super();
    this.payload = payload;
  }

  public static MoveTo(payload: Point): PathEvent {
    return new PathEvent(PathEventPayloads.MoveTo(payload));
  }
  public static Line(payload: LineSegment): PathEvent {
    return new PathEvent(PathEventPayloads.Line(payload));
  }
  public static Quadratic(payload: QuadraticBezierSegment): PathEvent {
    return new PathEvent(PathEventPayloads.Quadratic(payload));
  }
  public static Cubic(payload: CubicBezierSegment): PathEvent {
    return new PathEvent(PathEventPayloads.Cubic(payload));
  }
  public static Close(payload: LineSegment): PathEvent {
    return new PathEvent(PathEventPayloads.Close(payload));
  }

  public match(): PathEventPayload {
    return this.payload;
  }

  // Clone
  public clone(): this["Self"] {
    return new PathEvent(clone(this.payload));
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
    return format(`${this.payload.type}({:?})`, this.payload.value);
  }

  public transform(mat: Transform2D): this["Self"] {
    switch (this.payload.type) {
      case PathEventType.MoveTo:
        return PathEvent.MoveTo(mat.transform_point(this.payload.value));
      case PathEventType.Line:
        return PathEvent.Line(this.payload.value.transform(mat));
      case PathEventType.Quadratic:
        return PathEvent.Quadratic(this.payload.value.transform(mat));
      case PathEventType.Cubic:
        return PathEvent.Cubic(this.payload.value.transform(mat));
      case PathEventType.Close:
        return PathEvent.Close(this.payload.value.transform(mat));
    }
  }
}

export interface IntoPathEvent {
  to_path_event(): PathEvent;
}

export enum QuadraticEventType {
  MoveTo = "MoveTo",
  Line = "Line",
  Quadratic = "Quadratic",
  Close = "Close"
}

function create_quadratic_event_payload<T extends QuadraticEventType, S>(
  type: T,
  value: S
): EventPayloadVariant<T, S> {
  return { type, value };
}

export const QuadraticEventPayloads = {
  MoveTo: (payload: Point) => create_quadratic_event_payload(QuadraticEventType.MoveTo, payload),
  Line: (payload: LineSegment) => create_quadratic_event_payload(QuadraticEventType.Line, payload),
  Quadratic: (payload: QuadraticBezierSegment) =>
    create_quadratic_event_payload(QuadraticEventType.Quadratic, payload),
  Close: (payload: LineSegment) => create_quadratic_event_payload(QuadraticEventType.Close, payload)
};

export type QuadraticEventPayload = ReturnType<
  typeof QuadraticEventPayloads[keyof typeof QuadraticEventPayloads]
>;

/**
 * Path event enum that can only represent quadratic bezier curves and line segments.
 *
 * Useful for algorithms that approximate all curves with quadratic beziers.
 */
export class QuadraticEvent extends ImplPartialEq(Self)
  implements Clone, Debug, Transform, IntoSvgEvent, IntoPathEvent {
  public Self!: QuadraticEvent;

  public payload: QuadraticEventPayload;

  private constructor(payload: QuadraticEventPayload) {
    super();
    this.payload = payload;
  }

  public static MoveTo(payload: Point): QuadraticEvent {
    return new QuadraticEvent(QuadraticEventPayloads.MoveTo(payload));
  }
  public static Line(payload: LineSegment): QuadraticEvent {
    return new QuadraticEvent(QuadraticEventPayloads.Line(payload));
  }
  public static Quadratic(payload: QuadraticBezierSegment): QuadraticEvent {
    return new QuadraticEvent(QuadraticEventPayloads.Quadratic(payload));
  }
  public static Close(payload: LineSegment): QuadraticEvent {
    return new QuadraticEvent(QuadraticEventPayloads.Close(payload));
  }

  public match(): QuadraticEventPayload {
    return this.payload;
  }

  // Clone
  public clone(): this["Self"] {
    return new QuadraticEvent(clone(this.payload));
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
    return format(`${this.payload.type}({:?})`, this.payload.value);
  }

  public to_svg_event(): SvgEvent {
    switch (this.payload.type) {
      case QuadraticEventType.MoveTo:
        return SvgEvent.MoveTo(this.payload.value);
      case QuadraticEventType.Line: {
        let segment = this.payload.value;
        return SvgEvent.LineTo(segment.to());
      }
      case QuadraticEventType.Quadratic: {
        let segment = this.payload.value;
        return SvgEvent.QuadraticTo([segment.ctrl.clone(), segment.to()]);
      }
      case QuadraticEventType.Close:
        return SvgEvent.Close();
    }
  }

  public to_path_event(): PathEvent {
    switch (this.payload.type) {
      case QuadraticEventType.MoveTo:
        return PathEvent.MoveTo(this.payload.value);
      case QuadraticEventType.Line:
        return PathEvent.Line(this.payload.value);
      case QuadraticEventType.Quadratic:
        return PathEvent.Quadratic(this.payload.value);
      case QuadraticEventType.Close:
        return PathEvent.Close(this.payload.value);
    }
  }

  public transform(mat: Transform2D): this["Self"] {
    switch (this.payload.type) {
      case QuadraticEventType.MoveTo:
        return QuadraticEvent.MoveTo(mat.transform_point(this.payload.value));
      case QuadraticEventType.Line:
        return QuadraticEvent.Line(this.payload.value.transform(mat));
      case QuadraticEventType.Quadratic:
        return QuadraticEvent.Quadratic(this.payload.value.transform(mat));
      case QuadraticEventType.Close:
        return QuadraticEvent.Close(this.payload.value.transform(mat));
    }
  }
}

export enum FlattenedEventType {
  MoveTo = "MoveTo",
  Line = "Line",
  Close = "Close"
}

function create_flattened_event_payload<T extends FlattenedEventType, S>(
  type: T,
  value: S
): EventPayloadVariant<T, S> {
  return { type, value };
}

export const FlattenedEventPayloads = {
  MoveTo: (payload: Point) => create_flattened_event_payload(FlattenedEventType.MoveTo, payload),
  Line: (payload: LineSegment) => create_flattened_event_payload(FlattenedEventType.Line, payload),
  Close: (payload: LineSegment) => create_flattened_event_payload(FlattenedEventType.Close, payload)
};

export type FlattenedEventPayload = ReturnType<
  typeof FlattenedEventPayloads[keyof typeof FlattenedEventPayloads]
>;

/**
 * Path event enum that can only represent line segments.
 *
 * Useful for algorithms that approximate all curves with line segments.
 */
export class FlattenedEvent extends ImplPartialEq(Self)
  implements Clone, Debug, Transform, IntoSvgEvent, IntoPathEvent {
  public Self!: FlattenedEvent;

  public payload: FlattenedEventPayload;

  private constructor(payload: FlattenedEventPayload) {
    super();
    this.payload = payload;
  }

  public static MoveTo(payload: Point): FlattenedEvent {
    return new FlattenedEvent(FlattenedEventPayloads.MoveTo(payload));
  }
  public static Line(payload: LineSegment): FlattenedEvent {
    return new FlattenedEvent(FlattenedEventPayloads.Line(payload));
  }
  public static Close(payload: LineSegment): FlattenedEvent {
    return new FlattenedEvent(FlattenedEventPayloads.Close(payload));
  }

  public match(): FlattenedEventPayload {
    return this.payload;
  }

  // Clone
  public clone(): this["Self"] {
    return new FlattenedEvent(clone(this.payload));
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
    return format(`${this.payload.type}({:?})`, this.payload.value);
  }

  public to_svg_event(): SvgEvent {
    switch (this.payload.type) {
      case FlattenedEventType.MoveTo:
        return SvgEvent.MoveTo(this.payload.value);
      case FlattenedEventType.Line: {
        let segment = this.payload.value;
        return SvgEvent.LineTo(segment.to());
      }
      case FlattenedEventType.Close:
        return SvgEvent.Close();
    }
  }

  public to_path_event(): PathEvent {
    switch (this.payload.type) {
      case FlattenedEventType.MoveTo:
        return PathEvent.MoveTo(this.payload.value);
      case FlattenedEventType.Line:
        return PathEvent.Line(this.payload.value);
      case FlattenedEventType.Close:
        return PathEvent.Close(this.payload.value);
    }
  }

  public transform(mat: Transform2D): this["Self"] {
    switch (this.payload.type) {
      case FlattenedEventType.MoveTo:
        return FlattenedEvent.MoveTo(mat.transform_point(this.payload.value));
      case FlattenedEventType.Line:
        return FlattenedEvent.Line(this.payload.value.transform(mat));
      case FlattenedEventType.Close:
        return FlattenedEvent.Close(this.payload.value.transform(mat));
    }
  }
}
