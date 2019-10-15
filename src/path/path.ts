import {
  Self,
  ArrayIntoIter,
  ImplEq,
  ImplPartialEq,
  IntoIterator,
  Option,
  Some,
  None,
  Clone,
  clone,
  Debug,
  format,
  debug_assert
} from "@rusts/std";
import {
  LineSegment,
  QuadraticBezierSegment,
  CubicBezierSegment,
  Arc,
  Point,
  Vector,
  Angle
} from "../internal";
import {
  PathEvent,
  SvgPathBuilderAndBuild,
  FlatteningBuilderAndBuild,
  VertexId,
  Build,
  PathBuilder,
  PathIterator,
  PolygonBuilder,
  build_polygon
} from "./internal";

/**
 * Enumeration corresponding to the `PathEvent` without the parameters.
 *
 * This is used by the `Path` data structure to store path events a tad more
 * efficiently
 */
enum Verb {
  MoveTo,
  LineTo,
  QuadraticTo,
  CubicTo,
  Close
}

/**
 * A simple path data structure
 *
 * It can be created using a `Builder`, and can be iterated over.
 */
export class Path extends Self implements Clone, Debug, IntoIterator<PathEvent, PathIter> {
  public Self!: Path;

  public points: Point[];
  public verbs: Verb[];

  public constructor(points: Point[] = [], verbs: Verb[] = []) {
    super();
    this.points = points;
    this.verbs = verbs;
  }

  public static builder(): PathObjectBuilder {
    return new PathObjectBuilder();
  }

  public as_slice(): PathSlice {
    return new PathSlice(this.points.slice(), this.verbs.slice());
  }

  public iter(): PathIter {
    return new PathIter(this.points, this.verbs);
  }

  public merge(other: this["Self"]): this["Self"] {
    let verbs = this.verbs.concat(other.verbs);
    let points = this.points.concat(other.points);

    return new Path(points, verbs);
  }

  public cursor(): PathCursor {
    return new PathCursor(/* vertex */ 0, /* verb */ 0, /* first_vertex */ 0, /* first_verb */ 0);
  }

  // IntoIterator
  public Item!: PathEvent;
  public IntoIter!: PathIter;

  public into_iter(): this["IntoIter"] {
    return this.iter();
  }

  // Clone
  public clone(): this["Self"] {
    return new Path(clone(this.points), clone(this.verbs));
  }

  // Debug
  public fmt_debug(): string {
    return format("Path({:?},{:?})", this.points, this.verbs);
  }
}

export class PathSlice implements Clone, Debug, IntoIterator<PathEvent, PathIter> {
  public Self!: PathSlice;

  public points: Point[];
  public verbs: Verb[];

  public constructor(points: Point[] = [], verbs: Verb[] = []) {
    this.points = points;
    this.verbs = verbs;
  }

  public iter(): PathIter {
    return new PathIter(this.points, this.verbs);
  }

  public iter_from(cursor: PathCursor): PathIter {
    return new PathIter(this.points.slice(cursor.vertex), this.verbs.slice(cursor.verb));
  }

  public iter_until(cursor: PathCursor): PathIter {
    return new PathIter(this.points.slice(0, cursor.vertex), this.verbs.slice(0, cursor.verb));
  }

  public iter_range(start: PathCursor, end: PathCursor): PathIter {
    return new PathIter(
      this.points.slice(start.vertex, end.vertex),
      this.verbs.slice(start.verb, end.verb)
    );
  }

  // Clone
  public clone(): this["Self"] {
    return new PathSlice(clone(this.points), clone(this.verbs));
  }

  // Debug
  public fmt_debug(): string {
    return format("PathSlice({:?},{:?})", this.points, this.verbs);
  }

  // IntoIterator
  public Item!: PathEvent;
  public IntoIter!: PathIter;

  public into_iter(): PathIter {
    return this.iter();
  }
}

/**
 * Builds path object using the FlatPathBuilder interface.
 */
export class PathObjectBuilder extends PathBuilder implements Build, PolygonBuilder {
  public points: Point[];
  public verbs: Verb[];
  public position: Point;
  public first_position: Point;
  public first_vertex: VertexId;
  public first_verb: number;
  public need_moveto: boolean;

  public constructor() {
    super();
    this.points = [];
    this.verbs = [];
    this.position = Point.zero();
    this.first_position = Point.zero();
    this.first_vertex = 0;
    this.first_verb = 0;
    this.need_moveto = true;
  }

  public with_svg(): SvgPathBuilderAndBuild<this> {
    return new SvgPathBuilderAndBuild(this);
  }

  public flattened(tolerance: number): FlatteningBuilderAndBuild<this> {
    return new FlatteningBuilderAndBuild(this, tolerance);
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    nan_check(to);
    this.need_moveto = false;
    this.first_position = to;
    this.first_vertex = this.points.len();
    this.first_verb = this.verbs.len();
    this.position = to;
    this.points.push(to);
    this.verbs.push(Verb.MoveTo);
  }

  public line_to(to: Point) {
    nan_check(to);
    this.move_to_if_needed();
    this.points.push(to);
    this.verbs.push(Verb.LineTo);
    this.position = to;
  }

  public close() {
    // Relative path ops tend to accumulate small floating point imprecisions
    // which results in the last segment ending almost but not quite at the
    // start of the sub-path, causing a new edge to be inserted which often
    // intersects with the first or last edge. This can affect algorithms that
    // Don't handle self-intersecting paths.
    // Deal with this by snapping the last point if it is very close to the
    // start of the sub path.
    if (this.points.len() > 0) {
      let last = this.points.len() - 1;
      let d = this.points[last].sub(this.first_position).abs();
      if (d.x + d.y < 0.0001) {
        this.points[last] = this.first_position;
      }
    }

    this.verbs.push(Verb.Close);
    this.position = this.first_position;
    this.need_moveto = true;
  }

  public current_position(): Point {
    return this.position;
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    nan_check(ctrl);
    nan_check(to);
    this.move_to_if_needed();
    this.points.push(ctrl);
    this.points.push(to);
    this.verbs.push(Verb.QuadraticTo);
    this.position = to;
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    nan_check(ctrl1);
    nan_check(ctrl2);
    nan_check(to);
    this.move_to_if_needed();
    this.points.push(ctrl1);
    this.points.push(ctrl2);
    this.points.push(to);
    this.verbs.push(Verb.CubicTo);
    this.position = to;
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    nan_check(center);
    nan_check(radii.to_point());
    debug_assert(!isNaN(sweep_angle.get()));
    debug_assert(!isNaN(x_rotation.get()));

    let start_angle = this.position
      .sub(center)
      .angle_from_x_axis()
      .sub(x_rotation);
    let arc = new Arc(center, radii, start_angle, sweep_angle, x_rotation);
    arc.for_each_quadratic_bezier((curve: QuadraticBezierSegment) => {
      this.quadratic_bezier_to(curve.ctrl, curve.to());
    });
  }

  // PolygonBuilder
  public polygon(points: Point[]) {
    build_polygon(this, points);
  }

  public move_to_if_needed() {
    if (this.need_moveto) {
      this.move_to(this.first_position);
    }
  }

  /**
   * Returns a cursor to the next path event.
   */
  public cursor(): PathCursor {
    if (this.verbs.len() > 0) {
      let verb = this.verbs[this.verbs.len() - 1];
      let p = this.points.len() - n_stored_points(verb);

      return new PathCursor(
        /* vertex */ p,
        /* verb */ this.verbs.len() - 1,
        this.first_vertex,
        this.first_verb
      );
    } else {
      return new PathCursor(/* vertex */ 0, /* verb */ 0, /* first_vertex */ 0, /* first_verb */ 0);
    }
  }

  // Build
  public PathType!: Path;

  public build(): Path {
    return new Path(this.points, this.verbs);
  }

  public build_and_reset(): Path {
    this.position = Point.zero();
    this.first_position = Point.zero();

    let ret = new Path(this.points, this.verbs);

    this.points = [];
    this.verbs = [];

    return ret;
  }
}

/**
 * A PathCursor refers to an event within a Path.
 */
export class PathCursor extends ImplEq(ImplPartialEq(Self)) implements Clone, Debug {
  public Self!: PathCursor;

  public vertex: VertexId;
  public verb: number;
  public first_vertex: VertexId;
  public first_verb: number;

  public constructor(vertex: VertexId, verb: number, first_vertex: VertexId, first_verb: number) {
    super();
    this.vertex = vertex;
    this.verb = verb;
    this.first_vertex = first_vertex;
    this.first_verb = first_verb;
  }

  /**
   * Move the cursor to the next event in the `Path`
   *
   * Returns false if the cursor is already at the last event.
   */
  public next(path: Path): boolean {
    if (this.verb >= path.verbs.len() - 1) {
      return false;
    }

    let verb = path.verbs[this.verb + 1];
    if (verb === Verb.MoveTo) {
      this.first_vertex = this.vertex;
      this.first_verb = this.verb;
    }

    this.vertex = this.vertex + n_stored_points(verb);
    this.verb += 1;

    return true;
  }

  /**
   * Move the cursor to the previous event in the `Path`.
   *
   * Returns false if the cursor is already at the first event.
   */
  public previous(path: Path): boolean {
    if (this.verb === 0) {
      return false;
    }

    if (path.verbs[this.verb] === Verb.MoveTo) {
      let v = this.verb;
      let p = this.vertex;
      while (p > 0) {
        v -= 1;
        p -= n_stored_points(path.verbs[v]);
        if (path.verbs[v] === Verb.MoveTo) {
          break;
        }
      }

      this.first_vertex = p;
      this.first_verb = v;
    }

    this.vertex = this.vertex - n_stored_points(path.verbs[this.verb - 1]);
    this.verb -= 1;

    return true;
  }

  /**
   * Returns the `PathEvent` at the current cursor position in the path.
   */
  public event(path: Path): PathEvent {
    let p = this.vertex;
    switch (path.verbs[this.verb]) {
      case Verb.MoveTo:
        return PathEvent.MoveTo(path.points[p]);
      case Verb.LineTo:
        return PathEvent.Line(new LineSegment(path.points[p - 1], path.points[p]));
      case Verb.QuadraticTo:
        return PathEvent.Quadratic(
          new QuadraticBezierSegment(path.points[p - 1], path.points[p], path.points[p + 1])
        );
      case Verb.CubicTo:
        return PathEvent.Cubic(
          new CubicBezierSegment(
            path.points[p - 1],
            path.points[p],
            path.points[p + 1],
            path.points[p + 2]
          )
        );
      case Verb.Close:
        return PathEvent.Close(new LineSegment(path.points[p - 1], path.points[this.first_vertex]));
    }
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.vertex === other.vertex &&
      this.verb === other.verb &&
      this.first_vertex === other.first_vertex &&
      this.first_verb === other.first_verb
    );
  }

  // Clone
  public clone(): this["Self"] {
    return new PathCursor(this.vertex, this.verb, this.first_vertex, this.first_verb);
  }

  // Debug
  public fmt_debug(): string {
    return format(
      "PathCursor({:?},{:?},{:?},{:?})",
      this.vertex,
      this.verb,
      this.first_vertex,
      this.first_verb
    );
  }
}

export function reverse_path(path: PathSlice, builder: PathBuilder) {
  let points = path.points;
  // At each iteration, p points to the first point after the current verb.
  let p = points.len();
  let need_close = false;
  let need_moveto = true;

  let n = 0;

  for (let v of path.verbs
    .iter()
    .rev()
    .cloned()) {
    n += 1;
    switch (v) {
      case Verb.LineTo:
      case Verb.QuadraticTo:
      case Verb.CubicTo: {
        if (need_moveto) {
          need_moveto = false;
          builder.move_to(points[p - 1]);
        }
        break;
      }
      default:
        break;
    }

    switch (v) {
      case Verb.Close: {
        need_close = true;
        builder.move_to(points[p - 1]);
        need_moveto = false;
        break;
      }
      case Verb.MoveTo: {
        if (need_close) {
          need_close = false;
          builder.close();
        }
        need_moveto = true;
        break;
      }
      case Verb.LineTo: {
        builder.line_to(points[p - 2]);
        break;
      }
      case Verb.QuadraticTo: {
        builder.quadratic_bezier_to(points[p - 2], points[p - 3]);
        break;
      }
      case Verb.CubicTo: {
        builder.cubic_bezier_to(points[p - 2], points[p - 3], points[p - 4]);
        break;
      }
    }
    p -= n_stored_points(v);
  }

  // This is a special case that the logic above misses: The path only contains
  // a single MoveTo event.
  if (n === 1 && need_moveto) {
    builder.move_to(points[p]);
  }
}

export class PathIter extends PathIterator implements Clone, Debug {
  public points: ArrayIntoIter<Point>;
  public verbs: ArrayIntoIter<Verb>;
  public current: Point;
  public first: Point;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this.points = points.iter();
    this.verbs = verbs.iter();
    this.current = Point.zero();
    this.first = Point.zero();
  }

  // Iterator
  public Item!: PathEvent;

  public next(): Option<PathEvent> {
    let next_verb = this.verbs.next();
    if (next_verb.is_some()) {
      let verb = next_verb.unwrap();
      switch (verb) {
        case Verb.MoveTo: {
          this.current = this.points.next().unwrap();
          this.first = this.current;
          return Some(PathEvent.MoveTo(this.current));
        }
        case Verb.LineTo: {
          let from = this.current;
          this.current = this.points.next().unwrap();
          return Some(PathEvent.Line(new LineSegment(from, this.current)));
        }
        case Verb.QuadraticTo: {
          let from = this.current;
          let ctrl = this.points.next().unwrap();
          this.current = this.points.next().unwrap();
          return Some(PathEvent.Quadratic(new QuadraticBezierSegment(from, ctrl, this.current)));
        }
        case Verb.CubicTo: {
          let from = this.current;
          let ctrl1 = this.points.next().unwrap();
          let ctrl2 = this.points.next().unwrap();
          this.current = this.points.next().unwrap();
          return Some(PathEvent.Cubic(new CubicBezierSegment(from, ctrl1, ctrl2, this.current)));
        }
        case Verb.Close: {
          let from = this.current;
          this.current = this.first;
          return Some(PathEvent.Close(new LineSegment(from, this.first)));
        }
      }
    }
    return None();
  }

  // Clone
  public clone(): this["Self"] {
    return new PathIter(this.points.as_array(), this.verbs.as_array());
  }

  // Debug
  public fmt_debug(): string {
    return format("PathIter({:?},{:?})", this.points, this.verbs);
  }
}

function n_stored_points(verb: Verb): number {
  switch (verb) {
    case Verb.MoveTo:
      return 1;
    case Verb.LineTo:
      return 1;
    case Verb.QuadraticTo:
      return 2;
    case Verb.CubicTo:
      return 3;
    case Verb.Close:
      return 0;
  }
}

/**
 * Builder for flattened paths.
 */
export type FlattenedPathBuilder = SvgPathBuilderAndBuild<
  FlatteningBuilderAndBuild<PathObjectBuilder>
>;
/**
 * FlattenedPathBuilder constructor
 */
export function flattened_path_builder(tolerance: number): FlattenedPathBuilder {
  return new SvgPathBuilderAndBuild(new FlatteningBuilderAndBuild(Path.builder(), tolerance));
}

function nan_check(p: Point) {
  debug_assert(isFinite(p.x));
  debug_assert(isFinite(p.y));
}
