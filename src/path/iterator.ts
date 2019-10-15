import {
  IteratorBase,
  IteratorCommon,
  Map,
  Option,
  OptionType,
  Some,
  None,
  debug_assert,
  abstract_panic
} from "@rusts/std";
import { ArrayVec } from "@rusts/arrayvec";
import {
  Arc,
  BezierSegment,
  CubicBezierSegment,
  FlattenedEvent,
  FlattenedEventType,
  FlattenedCubic,
  FlattenedQuadratic,
  IntoPathEvent,
  IntoSvgEvent,
  LineSegment,
  PathEvent,
  PathEventType,
  PathState,
  Point,
  point,
  QuadraticEvent,
  QuadraticEventType,
  QuadraticBezierSegment,
  Rect,
  SvgArc,
  SvgEvent,
  SvgEventType,
  Transform2D
} from "../internal";

/**
 * An extension trait for `PathEvent` iterators.
 */
export class PathIterator extends IteratorBase<PathEvent> {
  /**
   * Returns iterator that turns curves into line segments.
   */
  public flattened(tolerance: number): FlattenedPath<this["Self"]> {
    return new FlattenedPath(this, tolerance);
  }

  /**
   * Returns an iterator applying a 2D transform to all of its events.
   */
  public transformed(mat: Transform2D): TransformedPath<this["Self"]> {
    return new TransformedPath(this, mat);
  }

  /**
   * Returns an iterator of segments.
   */
  public bezier_segments(): BezierSegments<this["Self"]> {
    return new BezierSegments(this);
  }

  /**
   * Consumes the iterator and returns a conservative axis-aligned rectangle
   * that contains the path.
   */
  public fast_bounding_rect(): Rect {
    let min = point(Number.MAX_VALUE, Number.MAX_VALUE);
    let max = point(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let evt of this) {
      let match = evt.match();
      switch (match.type) {
        case PathEventType.MoveTo: {
          min.min_assign(match.value);
          max.max_assign(match.value);
          break;
        }
        case PathEventType.Line: {
          let segment = match.value;
          min.min_assign(segment.end);
          max.max_assign(segment.end);
          break;
        }
        case PathEventType.Quadratic: {
          let segment = match.value;
          min.min_assign(segment.ctrl.min(segment.end));
          max.max_assign(segment.ctrl.max(segment.end));
          break;
        }
        case PathEventType.Cubic: {
          let segment = match.value;
          min.min_assign(segment.ctrl1.min(segment.ctrl2.min(segment.end)));
          max.max_assign(segment.ctrl1.max(segment.ctrl2.max(segment.end)));
          break;
        }
        case PathEventType.Close:
          break;
      }
    }

    // Return an empty rectangle by default if there was no event in the path.
    if (min.eq(point(Number.MAX_VALUE, Number.MAX_VALUE))) {
      return Rect.zero();
    }

    return new Rect(min, max.sub(min).to_size());
  }

  /**
   * Consumes the iterator and returns the smallest axis-aligned rectangle that
   * contains the path.
   */
  public bounding_rect(): Rect {
    let min = point(Number.MAX_VALUE, Number.MAX_VALUE);
    let max = point(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let evt of this) {
      let match = evt.match();
      switch (match.type) {
        case PathEventType.MoveTo: {
          min = min.min_assign(match.value);
          max = max.max_assign(match.value);
          break;
        }
        case PathEventType.Line: {
          let segment = match.value;
          min = min.min_assign(segment.end);
          max = max.max_assign(segment.end);
          break;
        }
        case PathEventType.Quadratic: {
          let segment = match.value;
          let r = segment.bounding_rect();
          min = min.min_assign(r.origin);
          max = max.max_assign(r.bottom_right());
          break;
        }
        case PathEventType.Cubic: {
          let segment = match.value;
          let r = segment.bounding_rect();
          min = min.min_assign(r.origin);
          max = max.max_assign(r.bottom_right());
          break;
        }
        case PathEventType.Close:
          break;
      }
    }

    // Return an empty rectangle by default if there was no event in the path.
    if (min.eq(point(Number.MAX_VALUE, Number.MAX_VALUE))) {
      return Rect.zero();
    }

    return new Rect(min, max.sub(min).to_size());
  }
}

/**
 * An extension to the common Iterator interface, that adds information which
 * useful when chaining path-specific iterators.
 */
export class SvgIterator extends IteratorBase<SvgEvent> {
  /**
   * The returned structure exposes the current position, the first position in
   * the current sub-path, and the position of the last control point.
   */
  public path_state(): PathState {
    abstract_panic("SvgIterator", "path_state");
    return (undefined as unknown) as PathState;
  }

  /**
   * Returns an iterator of FlattenedEvents, turning curves into sequences of
   * line segments.
   */
  public flattened(tolerance: number): FlattenedPath<PathEvents<this["Self"]>> {
    return this.path_events().flattened(tolerance);
  }

  /**
   * Returns an iterator of path events.
   */
  public path_events(): PathEvents<this["Self"]> {
    return new PathEvents(this);
  }
}

/**
 * An extension to the common Iterator interface, that adds information which
 * useful when chaining path-specific iterators.
 */
export class FlattenedIterator extends IteratorBase<FlattenedEvent> {
  /**
   * Returns an iterator of path events
   */
  public path_events(): Map<this["Self"], PathEvent> {
    return this.map(to_path_event);
  }

  /**
   * Returns an interator of svg events.
   */
  public svg_events(): Map<this["Self"], SvgEvent> {
    return this.map(to_svg_event);
  }

  /**
   * Retuns an interator applying a 2D transform to all of its events.
   */
  public transformed(mat: Transform2D): TransformedFlattened<this["Self"]> {
    return new TransformedFlattened(this, mat);
  }

  /**
   * Consumes the iterator and returns the length of the path.
   */
  public length(): number {
    let length = 0;
    for (let evt of this) {
      let match = evt.match();
      switch (match.type) {
        case FlattenedEventType.MoveTo:
          break;
        case FlattenedEventType.Line: {
          length += match.value.length();
          break;
        }
        case FlattenedEventType.Close: {
          length += match.value.length();
          break;
        }
      }
    }

    return length;
  }

  /**
   * Returns an iterator of line segments.
   */
  public line_segments(): LineSegments<this["Self"]> {
    return new LineSegments(this);
  }

  /**
   * Consumes the iterator and returns a conservative axis-aligned rectangle
   * that contains the path.
   */
  public fast_bounding_rect(): Rect {
    let min = point(Number.MAX_VALUE, Number.MAX_VALUE);
    let max = point(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let evt of this) {
      let match = evt.match();
      switch (match.type) {
        case FlattenedEventType.MoveTo: {
          min = min.min_assign(match.value);
          max = max.max_assign(match.value);
          break;
        }
        case FlattenedEventType.Line: {
          let segment = match.value;
          min = min.min_assign(segment.end);
          max = max.max_assign(segment.end);
          break;
        }
        case FlattenedEventType.Close:
          break;
      }
    }

    // Return an empty rectangle by default if there was no event in the path.
    if (min.eq(point(Number.MAX_VALUE, Number.MAX_VALUE))) {
      return Rect.zero();
    }

    return new Rect(min, max.sub(min).to_size());
  }
}

/**
 * An extension to the common Iterator interface, that adds information which
 * useful when chaining path-specific iterators.
 */
export class QuadraticPathIterator extends IteratorBase<QuadraticEvent> {
  /**
   * Returns an iterator of path events
   */
  public path_events(): Map<this["Self"], PathEvent> {
    return this.map(to_path_event);
  }

  /**
   * Returns an interator of svg events.
   */
  public svg_events(): Map<this["Self"], SvgEvent> {
    return this.map(to_svg_event);
  }

  /**
   * Retuns an interator applying a 2D transform to all of its events.
   */
  public transformed(mat: Transform2D): TransformedQuadratic<this["Self"]> {
    return new TransformedQuadratic(this, mat);
  }

  /**
   * Consumes the iterator and returns a conservative axis-aligned rectangle
   * that contains the path.
   */
  public fast_bounding_rect(): Rect {
    let min = point(Number.MAX_VALUE, Number.MAX_VALUE);
    let max = point(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let evt of this) {
      let match = evt.match();
      switch (match.type) {
        case QuadraticEventType.MoveTo: {
          min = min.min_assign(match.value);
          max = max.max_assign(match.value);
          break;
        }
        case QuadraticEventType.Line: {
          let segment = match.value;
          min = min.min_assign(segment.end);
          max = max.max_assign(segment.end);
          break;
        }
        case QuadraticEventType.Quadratic: {
          let segment = match.value;
          min = min.min_assign(segment.ctrl.min(segment.end));
          max = max.max_assign(segment.ctrl.max(segment.end));
          break;
        }
        case QuadraticEventType.Close:
          break;
      }
    }

    // Return an empty rectangle by default if there was no event in the path.
    if (min.eq(point(Number.MAX_VALUE, Number.MAX_VALUE))) {
      return Rect.zero();
    }

    return new Rect(min, max.sub(min).to_size());
  }

  /**
   * Consumes the iterator and returns the smallest axis-aligned rectangle that
   * contains the path.
   */
  public bounding_rect(): Rect {
    let min = point(Number.MAX_VALUE, Number.MAX_VALUE);
    let max = point(-Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let evt of this) {
      let match = evt.match();
      switch (match.type) {
        case QuadraticEventType.MoveTo: {
          min = min.min_assign(match.value);
          max = max.max_assign(match.value);
          break;
        }
        case QuadraticEventType.Line: {
          let segment = match.value;
          min = min.min_assign(segment.end);
          max = max.max_assign(segment.end);
          break;
        }
        case QuadraticEventType.Quadratic: {
          let segment = match.value;
          let r = segment.bounding_rect();
          min = min.min_assign(r.origin);
          max = max.max_assign(r.bottom_right());
          break;
        }
        case QuadraticEventType.Close:
          break;
      }
    }

    // Return an empty rectangle by default if there was no event in the path.
    if (min.eq(point(Number.MAX_VALUE, Number.MAX_VALUE))) {
      return Rect.zero();
    }

    return new Rect(min, max.sub(min).to_size());
  }
}

/**
 * Turns an iterator of SVG path commands into an iterator of `PathEvent`.
 */
export class PathEvents<I extends SvgIterator> extends PathIterator {
  public Self!: PathEvents<I>;

  public iter: I;
  public arc_to_cubics: CubicBezierSegment[];

  public constructor(iter: I) {
    super();
    this.iter = iter;
    this.arc_to_cubics = [];
  }

  // Iterator
  public Item!: PathEvent;

  public next(): Option<this["Item"]> {
    let pop = this.arc_to_cubics.pop();
    if (pop) {
      return Some(PathEvent.Cubic(pop));
    }
    let next = this.iter.next();
    if (next.is_some()) {
      let svg_evt = next.unwrap();
      return Some(svg_to_path_event(svg_evt, this.iter.path_state().clone(), this.arc_to_cubics));
    }

    return None();
  }
}

function svg_to_path_event(
  event: SvgEvent,
  ps: PathState,
  arcs_to_cubic: CubicBezierSegment[]
): PathEvent {
  let from = ps.current_position();
  let match = event.match();
  switch (match.type) {
    case SvgEventType.MoveTo:
      return PathEvent.MoveTo(match.value);
    case SvgEventType.LineTo:
      return PathEvent.Line(new LineSegment(from, match.value));
    case SvgEventType.QuadraticTo: {
      let [ctrl, to] = match.value;
      return PathEvent.Quadratic(new QuadraticBezierSegment(from, ctrl, to));
    }
    case SvgEventType.CubicTo: {
      let [ctrl1, ctrl2, to] = match.value;
      return PathEvent.Cubic(new CubicBezierSegment(from, ctrl1, ctrl2, to));
    }
    case SvgEventType.Close:
      return PathEvent.Close(new LineSegment(ps.current_position(), ps.start_position()));
    case SvgEventType.RelativeMoveTo:
      return PathEvent.MoveTo(ps.relative_to_absolute(match.value));
    case SvgEventType.RelativeLineTo:
      return PathEvent.Line(new LineSegment(from, ps.relative_to_absolute(match.value)));
    case SvgEventType.RelativeQuadraticTo: {
      let [ctrl, to] = match.value;
      return PathEvent.Quadratic(
        new QuadraticBezierSegment(from, ps.relative_to_absolute(ctrl), ps.relative_to_absolute(to))
      );
    }
    case SvgEventType.RelativeCubicTo: {
      let [ctrl1, ctrl2, to] = match.value;
      return PathEvent.Cubic(
        new CubicBezierSegment(
          from,
          ps.relative_to_absolute(ctrl1),
          ps.relative_to_absolute(ctrl2),
          ps.relative_to_absolute(to)
        )
      );
    }
    case SvgEventType.HorizontalLineTo:
      return PathEvent.Line(new LineSegment(from, point(match.value, ps.current_position().y)));
    case SvgEventType.VerticalLineTo:
      return PathEvent.Line(new LineSegment(from, point(ps.current_position().x, match.value)));
    case SvgEventType.RelativeHorizontalLineTo:
      return PathEvent.Line(
        new LineSegment(from, point(ps.current_position().x + match.value, ps.current_position().y))
      );
    case SvgEventType.RelativeVerticalLineTo:
      return PathEvent.Line(
        new LineSegment(from, point(ps.current_position().x, ps.current_position().y + match.value))
      );
    case SvgEventType.SmoothQuadraticTo:
      return PathEvent.Quadratic(
        new QuadraticBezierSegment(from, ps.get_smooth_quadratic_ctrl(), match.value)
      );
    case SvgEventType.SmoothCubicTo: {
      let [ctrl2, to] = match.value;
      return PathEvent.Cubic(new CubicBezierSegment(from, ps.get_smooth_cubic_ctrl(), ctrl2, to));
    }
    case SvgEventType.SmoothRelativeQuadraticTo:
      return PathEvent.Quadratic(
        new QuadraticBezierSegment(
          from,
          ps.get_smooth_quadratic_ctrl(),
          ps.relative_to_absolute(match.value)
        )
      );
    case SvgEventType.SmoothRelativeCubicTo: {
      let [ctrl2, to] = match.value;
      return PathEvent.Cubic(
        new CubicBezierSegment(
          from,
          ps.get_smooth_cubic_ctrl(),
          ps.relative_to_absolute(ctrl2),
          ps.relative_to_absolute(to)
        )
      );
    }
    case SvgEventType.ArcTo: {
      let [radii, x_rotation, flags, to] = match.value;
      return arc_to_path_events(
        Arc.from_svg_arc(new SvgArc(ps.current_position(), to, radii, x_rotation, flags)),
        arcs_to_cubic
      );
    }
    case SvgEventType.RelativeArcTo: {
      let [radii, x_rotation, flags, to] = match.value;
      return arc_to_path_events(
        Arc.from_svg_arc(
          new SvgArc(ps.current_position(), ps.current_position().add(to), radii, x_rotation, flags)
        ),
        arcs_to_cubic
      );
    }
  }
}

function arc_to_path_events(arc: Arc, arcs_to_cubic: CubicBezierSegment[]): PathEvent {
  let curves: ArrayVec<CubicBezierSegment /*, 4*/> = new ArrayVec(4);
  arc.for_each_cubic_bezier((curve: CubicBezierSegment) => {
    curves.push(curve);
  });
  while (curves.len() > 1) {
    // Append in reverse order.
    arcs_to_cubic.push(curves.pop().unwrap());
  }
  return PathEvent.Cubic(curves.get_unchecked(0));
}

enum TmpFlatteningIterType {
  Quadratic = "Quadratic",
  Cubic = "Cubic",
  None = "None"
}

type TmpFlatteningIterPayloadVariant<T, V> = { type: T; value: V };

function create_tmp_flattening_iter_payload<T extends TmpFlatteningIterType, V>(
  type: T,
  value: V
): TmpFlatteningIterPayloadVariant<T, V> {
  return { type, value };
}

const TmpFlatteningIterPayloads = {
  Quadratic: (payload: FlattenedQuadratic) =>
    create_tmp_flattening_iter_payload(TmpFlatteningIterType.Quadratic, payload),
  Cubic: (payload: FlattenedCubic) =>
    create_tmp_flattening_iter_payload(TmpFlatteningIterType.Cubic, payload),
  None: () => create_tmp_flattening_iter_payload(TmpFlatteningIterType.None, undefined)
};

type TmpFlatteningIterPayload = ReturnType<
  typeof TmpFlatteningIterPayloads[keyof typeof TmpFlatteningIterPayloads]
>;

class TmpFlatteningIter {
  public payload: TmpFlatteningIterPayload;

  private constructor(payload: TmpFlatteningIterPayload) {
    this.payload = payload;
  }

  public static Quadratic(payload: FlattenedQuadratic): TmpFlatteningIter {
    return new TmpFlatteningIter(TmpFlatteningIterPayloads.Quadratic(payload));
  }
  public static Cubic(payload: FlattenedCubic): TmpFlatteningIter {
    return new TmpFlatteningIter(TmpFlatteningIterPayloads.Cubic(payload));
  }
  public static None(): TmpFlatteningIter {
    return new TmpFlatteningIter(TmpFlatteningIterPayloads.None());
  }

  public match(): TmpFlatteningIterPayload {
    return this.payload;
  }
}

/**
 * An iterator that consumes `PathEvent` iterator and yields FlattenedEvents.
 */
export class FlattenedPath<I extends PathIterator> extends FlattenedIterator {
  public Self!: FlattenedPath<I>;

  public iter: I;
  public current_position: Point;
  public current_curve: TmpFlatteningIter;
  public tolerance: number;

  public constructor(iter: I, tolerance: number) {
    super();
    this.iter = iter;
    this.current_position = Point.zero();
    this.current_curve = TmpFlatteningIter.None();
    this.tolerance = tolerance;
  }

  // Iterator
  public Item!: FlattenedEvent;

  public next(): Option<this["Item"]> {
    let match = this.current_curve.match();
    switch (match.type) {
      case TmpFlatteningIterType.Quadratic: {
        let it = match.value;
        let next = it.next();
        if (next.is_some()) {
          let to = next.unwrap();
          let from = this.current_position;
          this.current_position = to;
          return Some(FlattenedEvent.Line(new LineSegment(from, to)));
        }
        break;
      }
      case TmpFlatteningIterType.Cubic: {
        let it = match.value;
        let next = it.next();
        if (next.is_some()) {
          let to = next.unwrap();
          let from = this.current_position;
          this.current_position = to;
          return Some(FlattenedEvent.Line(new LineSegment(from, to)));
        }
        break;
      }
      default:
        break;
    }
    this.current_curve = TmpFlatteningIter.None();
    let next = this.iter.next();
    if (next.is_some()) {
      let match = next.unwrap().match();
      switch (match.type) {
        case PathEventType.MoveTo:
          return Some(FlattenedEvent.MoveTo(match.value));
        case PathEventType.Line:
          return Some(FlattenedEvent.Line(match.value));
        case PathEventType.Close:
          return Some(FlattenedEvent.Close(match.value));
        case PathEventType.Quadratic: {
          let segment = match.value;
          this.current_position = segment.from();
          this.current_curve = TmpFlatteningIter.Quadratic(segment.flattened(this.tolerance));
          this.next();
          break;
        }
        case PathEventType.Cubic: {
          let segment = match.value;
          this.current_position = segment.from();
          this.current_curve = TmpFlatteningIter.Cubic(segment.flattened(this.tolerance));
          this.next();
          break;
        }
      }
    }
    return None();
  }
}

export class SvgPathIter<E extends IntoSvgEvent, I extends IteratorCommon<E>> extends SvgIterator {
  public Self!: SvgPathIter<E, I>;

  public iter: I;
  public state: PathState;

  public constructor(iter: I) {
    super();
    this.iter = iter;
    this.state = new PathState();
  }

  // SvgIterator
  public path_state(): PathState {
    return this.state;
  }

  // Iterator
  public Item!: SvgEvent;

  public next(): Option<this["Item"]> {
    let match = this.iter.next().match();
    switch (match.type) {
      case OptionType.Some: {
        let svg_evt = match.value.to_svg_event();
        this.state.svg_event(svg_evt);
        return Some(svg_evt);
      }
      case OptionType.None:
        return None();
    }
  }
}

function to_path_event<E extends IntoPathEvent>(evt: E): PathEvent {
  return evt.to_path_event();
}
function to_svg_event<E extends IntoSvgEvent>(evt: E): SvgEvent {
  return evt.to_svg_event();
}

/**
 * Applies a 2D transform to a path iterator and yields the resulting path iterator.
 */
export class TransformedPath<I extends PathIterator> extends PathIterator {
  public Self!: TransformedPath<I>;

  public iter: I;
  public transform: Transform2D;

  public constructor(iter: I, transform: Transform2D) {
    super();
    this.iter = iter;
    this.transform = transform;
  }

  // Iterator
  public Item!: PathEvent;

  public next(): Option<this["Item"]> {
    let match = this.iter.next().match();
    switch (match.type) {
      case OptionType.Some:
        return Some(match.value.transform(this.transform));
      case OptionType.None:
        return None();
    }
  }
}

/**
 * Applies a 2D transform to a path iterator and yields the resulting path iterator.
 */
export class TransformedQuadratic<I extends QuadraticPathIterator> extends QuadraticPathIterator {
  public Self!: TransformedQuadratic<I>;

  public iter: I;
  public transform: Transform2D;

  public constructor(iter: I, transform: Transform2D) {
    super();
    this.iter = iter;
    this.transform = transform;
  }

  // Iterator
  public Item!: QuadraticEvent;

  public next(): Option<this["Item"]> {
    let match = this.iter.next().match();
    switch (match.type) {
      case OptionType.Some:
        return Some(match.value.transform(this.transform));
      case OptionType.None:
        return None();
    }
  }
}

/**
 * Applies a 2D transform to a path iterator and yields the resulting path iterator.
 */
export class TransformedFlattened<I extends FlattenedIterator> extends FlattenedIterator {
  public Self!: TransformedFlattened<I>;

  public iter: I;
  public transform: Transform2D;

  public constructor(iter: I, transform: Transform2D) {
    super();
    this.iter = iter;
    this.transform = transform;
  }

  // Iterator
  public Item!: FlattenedEvent;

  public next(): Option<this["Item"]> {
    let match = this.iter.next().match();
    switch (match.type) {
      case OptionType.Some:
        return Some(match.value.transform(this.transform));
      case OptionType.None:
        return None();
    }
  }
}

/**
 * An iterator that concumes an iterator of `Point`s and produces `FlattenedEvent`s.
 */
export class FromPolyline<I extends IteratorCommon<Point>> extends FlattenedIterator {
  public Self!: FromPolyline<I>;

  public iter: I;
  public current: Point;
  public first: Point;
  public is_first: boolean;
  public done: boolean;
  public close: boolean;

  public constructor(iter: I, close: boolean) {
    super();
    this.iter = iter;
    this.current = Point.zero();
    this.first = Point.zero();
    this.is_first = true;
    this.done = false;
    this.close = close;
  }

  public static closed<I extends IteratorCommon<Point>>(iter: I): FromPolyline<I> {
    return new FromPolyline(iter, true);
  }

  public static open<I extends IteratorCommon<Point>>(iter: I): FromPolyline<I> {
    return new FromPolyline(iter, false);
  }

  // Iterator
  public Item!: FlattenedEvent;

  public next(): Option<this["Item"]> {
    if (this.done) {
      return None();
    }

    let next = this.iter.next();
    if (next.is_some()) {
      let to = next.unwrap();
      debug_assert(isFinite(to.x));
      debug_assert(isFinite(to.y));
      let from = this.current;
      this.current = to;
      if (this.is_first) {
        this.is_first = false;
        this.first = to;
        return Some(FlattenedEvent.MoveTo(to));
      } else {
        return Some(FlattenedEvent.Line(new LineSegment(from, to)));
      }
    }

    this.done = true;
    if (this.close) {
      return Some(FlattenedEvent.Close(new LineSegment(this.current, this.first)));
    }

    return None();
  }
}

/**
 * Turns an iterator of `PathEvent` into an iterator of `BezierSegment`.
 */
export class BezierSegments<I extends PathIterator> extends IteratorBase<BezierSegment> {
  public Self!: BezierSegments<I>;

  public iter: I;

  public constructor(iter: I) {
    super();
    this.iter = iter;
  }

  // Iterator
  public Item!: BezierSegment;

  public next(): Option<this["Item"]> {
    let next = this.iter.next();
    if (next.is_some()) {
      let match = next.unwrap().match();
      switch (match.type) {
        case PathEventType.Line:
        case PathEventType.Close:
          return Some(BezierSegment.Linear(match.value));
        case PathEventType.Quadratic:
          return Some(BezierSegment.Quadratic(match.value));
        case PathEventType.Cubic:
          return Some(BezierSegment.Cubic(match.value));
        case PathEventType.MoveTo:
          return this.next();
      }
    }
    return None();
  }
}

/**
 * Turns an iterator of `FlattenedEvent` into an iterator of `LineSegment`.
 */
export class LineSegments<I extends FlattenedIterator> extends IteratorBase<LineSegment> {
  public Self!: LineSegments<I>;

  public iter: I;

  public constructor(iter: I) {
    super();
    this.iter = iter;
  }

  // Iterator
  public Item!: LineSegment;

  public next(): Option<this["Item"]> {
    let next = this.iter.next();
    if (next.is_some()) {
      let match = next.unwrap().match();
      switch (match.type) {
        case FlattenedEventType.Line:
        case FlattenedEventType.Close:
          return Some(match.value);
        case FlattenedEventType.MoveTo:
          return this.next();
      }
    }
    return None();
  }
}
