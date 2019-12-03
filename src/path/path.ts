import {
  Self,
  ArrayIntoIter,
  ImplEq,
  ImplPartialEq,
  IntoIterator,
  DoubleEndedIterator,
  Option,
  Some,
  None,
  Range,
  range,
  Clone,
  Debug,
  floor,
  ceil,
  format,
  println,
  assert_eq,
  debug_assert,
  unreachable,
  u64_saturating_sub,
  u64
} from "@rusts/std";
import {
  Scalar,
  Segment,
  BezierSegment,
  BezierSegmentType,
  LineSegment,
  QuadraticBezierSegment,
  CubicBezierSegment,
  Arc,
  Point,
  point,
  Vector,
  Angle,
  BoundingRect,
  Rect
} from "../internal";
import {
  PathEvent,
  SvgPathBuilderAndBuild,
  FlatteningBuilderAndBuild,
  Build,
  PathBuilder,
  PathEventIterator,
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
 * A subpath data structure from a MoveTo to an optional Close.
 *
 * It should be created using a `SubpathBuilder`, and can be iterated over.
 */
export class Subpath extends Segment
  implements BoundingRect, Clone, Debug, IntoIterator<PathEvent, SubpathIter> {
  public Self!: Subpath;

  protected _points: Point[];
  protected _verbs: Verb[];

  private _closed: boolean;
  private _closing_segment: Option<LineSegment>;
  private _segment_count: Option<number>;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this._points = points;
    this._verbs = verbs;
    this._closed = this._verbs.last().map_or(false, (v: Verb) => v === Verb.Close);
    this._closing_segment = this._closed
      ? this.iter()
          .bezier_segments()
          .next_back()
          .map((s: BezierSegment) => s.linear())
      : None();
    this._segment_count = None();
  }

  public static builder(): SubpathBuilder {
    return SubpathBuilder.new();
  }

  public as_builder(): SubpathBuilder {
    return new SubpathBuilder(this._points.clone(), this._verbs.clone());
  }

  public first_segment(): Option<BezierSegment> {
    return this.iter()
      .bezier_segments()
      .next();
  }

  public last_segment(): Option<BezierSegment> {
    return this.iter()
      .bezier_segments()
      .next_back();
  }

  public nth_segment(n: number): Option<BezierSegment> {
    n = u64(n);
    return this.iter()
      .bezier_segments()
      .nth(n);
  }

  public first_point(): Option<Point> {
    return this._points.first();
  }

  public last_point(): Option<Point> {
    return this._points.last();
  }

  public nth_point(n: number): Option<Point> {
    return this._points.get(n);
  }

  public segment_count(): number {
    // NOTE: `bezier_segments` ignores degenerate closing segments
    return this._segment_count.get_or_insert_with(() =>
      this.iter()
        .bezier_segments()
        .count()
    );
  }

  public is_closed(): boolean {
    return this._closed;
  }

  public as_slice(): SubpathSlice {
    return new SubpathSlice(this._points.slice(), this._verbs.slice());
  }

  public iter(): SubpathIter {
    return new SubpathIter(this._points, this._verbs);
  }

  public append(other: this["Self"]): this["Self"] {
    let builder = Subpath.builder();
    let p = 0;
    let need_moveto = true;

    for (let v of this._verbs.iter()) {
      switch (v) {
        case Verb.MoveTo: {
          need_moveto = false;
          builder.move_to(this._points[p]);
          break;
        }
        case Verb.LineTo: {
          builder.line_to(this._points[p]);
          break;
        }
        case Verb.QuadraticTo: {
          builder.quadratic_bezier_to(this._points[p], this._points[p + 1]);
          break;
        }
        case Verb.CubicTo: {
          builder.cubic_bezier_to(this._points[p], this._points[p + 1], this._points[p + 2]);
          break;
        }
      }
      p += n_stored_points(v);
    }

    p = 0;

    for (let v of other._verbs.iter()) {
      switch (v) {
        case Verb.MoveTo: {
          if (need_moveto) {
            need_moveto = false;
            builder.move_to(other._points[p]);
          }
          builder.line_to(other._points[p]);
          break;
        }
        case Verb.LineTo: {
          builder.line_to(other._points[p]);
          break;
        }
        case Verb.QuadraticTo: {
          builder.quadratic_bezier_to(other._points[p], other._points[p + 1]);
          break;
        }
        case Verb.CubicTo: {
          builder.cubic_bezier_to(other._points[p], other._points[p + 1], other._points[p + 2]);
          break;
        }
        case Verb.Close: {
          builder.close();
          break;
        }
      }
      p += n_stored_points(v);
    }

    return builder.build();
  }

  public first_cursor(): SubpathCursor {
    return new SubpathCursor(this._points, this._verbs, /* vertex */ 0, /* verb */ 0);
  }

  public last_cursor(): SubpathCursor {
    if (!this._verbs.is_empty()) {
      let verb = this._verbs[this._verbs.len() - 1];
      let p = this._points.len() - n_stored_points(verb);

      return new SubpathCursor(
        this._points,
        this._verbs,
        /* vertex */ p,
        /* verb */ this._verbs.len() - 1
      );
    } else {
      return this.first_cursor();
    }
  }

  // Segment

  // Start of the subpath
  //
  // Panics if points is empty.
  public from(): Point {
    return this._points.first().unwrap();
  }

  // End of the subpath
  //
  // Panics if points is empty.
  public to(): Point {
    return this._closed ? this._points.first().unwrap() : this._points.last().unwrap();
  }

  // Sample subpath at t (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public sample(t: Scalar): Point {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .sample(time);
  }

  // Sample x at t (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public x(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .x(time);
  }

  // Sample x at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public y(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .y(time);
  }

  // Sample derivative at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public derivative(t: Scalar): Vector {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .derivative(time);
  }

  // Sample x derivative at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public dx(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .dx(time);
  }

  // Sample y derivative at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public dy(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .dy(time);
  }

  /*
   * Split the subpath into two subpaths at t
   * (expecting t between 0 and n, where n is the number of segments)
   *
   * Panics if `t` is invalid
   */

  public split(t: Scalar): [this["Self"], this["Self"]] {
    let a = Subpath.builder();
    let b = Subpath.builder();

    if (t === 0) {
      a.move_to(this.from());
      b = this.as_builder();
    } else if (t === this.segment_count()) {
      a = this.as_builder();
      b.move_to(this.to());
    } else {
      let [n, time] = this._normalize_time(t);
      let [nth_a, nth_b] = this.nth_segment(n)
        .expect("expected t between 0 and n, where n is the number of segments")
        .split(time);
      let p = 0;
      let nth = ceil(t);
      let split = false;
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            a.move_to(this._points[p].clone());
            if (t === 0) {
              split = true;
              b.move_to(this._points[p].clone());
            }
            break;
          }
          case Verb.LineTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let line_a = nth_a.linear();
              let line_b = nth_b.linear();
              a.line_to(line_a.to());
              b.move_to(line_b.from());
              if (time % 1 > 0) {
                b.line_to(line_b.to());
              }
            } else {
              a.line_to(this._points[p].clone());
            }
            break;
          }
          case Verb.QuadraticTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let quad_a = nth_a.quadratic();
              let quad_b = nth_b.quadratic();
              a.quadratic_bezier_to(quad_a.ctrl.clone(), quad_a.to());
              b.move_to(quad_b.from());
              if (time % 1 > 0) {
                b.quadratic_bezier_to(quad_b.ctrl.clone(), quad_b.to());
              }
            } else {
              a.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            }
            break;
          }
          case Verb.CubicTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let cubic_a = nth_a.cubic();
              let cubic_b = nth_b.cubic();
              a.cubic_bezier_to(cubic_a.ctrl1.clone(), cubic_a.ctrl2.clone(), cubic_a.to());
              b.move_to(cubic_b.from());
              if (time % 1 > 0) {
                b.cubic_bezier_to(cubic_b.ctrl1.clone(), cubic_b.ctrl2.clone(), cubic_b.to());
              }
            } else {
              a.cubic_bezier_to(
                this._points[p].clone(),
                this._points[p + 1].clone(),
                this._points[p + 2].clone()
              );
            }
            break;
          }
          case Verb.Close: {
            if (this._includes_closing_segment()) {
              nth = u64_saturating_sub(nth, 1);
              if (nth === 0) {
                split = true;
                let line_a = nth_a.linear();
                let line_b = nth_b.linear();
                if (line_b.is_degenerate(0)) {
                  a.close();
                  b.move_to(line_b.from());
                } else {
                  a.line_to(line_a.to());
                  b.move_to(line_b.from());
                  b.line_to(line_b.to());
                }
              } else {
                a.line_to(this._points[0].clone());
              }
            }
            break;
          }
        }
        p += n_stored_points(v);
        if (split) {
          break;
        }
      }

      for (let v of verbs) {
        switch (v) {
          case Verb.LineTo: {
            b.line_to(this._points[p].clone());
            break;
          }
          case Verb.QuadraticTo: {
            b.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            break;
          }
          case Verb.CubicTo: {
            b.cubic_bezier_to(
              this._points[p].clone(),
              this._points[p + 1].clone(),
              this._points[p + 2].clone()
            );
            break;
          }
          case Verb.Close: {
            if (this._includes_closing_segment()) {
              let to = this._points[0].clone();
              if (to.eq(b.start)) {
                b.close();
              } else {
                b.line_to(to);
              }
            }
            break;
          }
        }
        p += n_stored_points(v);
      }
    }

    return [a.build(), b.build()];
  }

  // Return the subpath before the split point at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public before_split(t: Scalar): this["Self"] {
    let builder = Subpath.builder();

    if (t === 0) {
      builder.move_to(this.from());
    } else if (t === this.segment_count()) {
      builder = this.as_builder();
    } else {
      let [n, time] = this._normalize_time(t);
      let nth_seg = this.nth_segment(n)
        .expect("expected t between 0 and n, where n is the number of segments")
        .before_split(time);
      let p = 0;
      let nth = ceil(t);
      let done = false;
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            builder.move_to(this._points[p].clone());
            if (t === 0) {
              done = true;
            }
            break;
          }
          case Verb.LineTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              done = true;
              let line = nth_seg.linear();
              builder.line_to(line.to());
            } else {
              builder.line_to(this._points[p].clone());
            }
            break;
          }
          case Verb.QuadraticTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              done = true;
              let quad = nth_seg.quadratic();
              builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
            } else {
              builder.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            }
            break;
          }
          case Verb.CubicTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              done = true;
              let cubic = nth_seg.cubic();
              builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
            } else {
              builder.cubic_bezier_to(
                this._points[p].clone(),
                this._points[p + 1].clone(),
                this._points[p + 2].clone()
              );
            }
            break;
          }
          case Verb.Close: {
            if (this._includes_closing_segment()) {
              nth = u64_saturating_sub(nth, 1);
              if (nth === 0) {
                done = true;
                let line = nth_seg.linear();
                let to = line.to();
                if (to.eq(builder.start)) {
                  builder.close();
                } else {
                  builder.line_to(to);
                }
              } else {
                unreachable();
              }
            }
            break;
          }
        }
        if (done) {
          break;
        }
        p += n_stored_points(v);
      }
    }

    return builder.build();
  }

  // Return the subpath after the split point at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public after_split(t: Scalar): this["Self"] {
    let builder = Subpath.builder();
    if (t === 0) {
      builder = this.as_builder();
    } else if (t === this.segment_count()) {
      builder.move_to(this.to());
    } else {
      let [n, time] = this._normalize_time(t);
      let nth_seg = this.nth_segment(n)
        .expect("expected t between 0 and n, where n is the number of segments")
        .after_split(time);
      let p = 0;
      let nth = ceil(t);
      let split = false;
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            if (t === 0) {
              split = true;
              builder.move_to(this._points[p].clone());
            }
            break;
          }
          case Verb.LineTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let line = nth_seg.linear();
              builder.move_to(line.from());
              if (time % 1 > 0) {
                builder.line_to(line.to());
              }
            }
            break;
          }
          case Verb.QuadraticTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let quad = nth_seg.quadratic();
              builder.move_to(quad.from());
              if (time % 1 > 0) {
                builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
              }
            }
            break;
          }
          case Verb.CubicTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let cubic = nth_seg.cubic();
              builder.move_to(cubic.from());
              if (time % 1 > 0) {
                builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
              }
            }
            break;
          }
          case Verb.Close: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let line = nth_seg.linear();
              builder.move_to(line.from());
              if (!line.is_degenerate(0)) {
                builder.line_to(line.to());
              }
            } else {
              unreachable();
            }
            break;
          }
        }
        p += n_stored_points(v);
        if (split) {
          break;
        }
      }

      for (let v of verbs) {
        switch (v) {
          case Verb.LineTo: {
            builder.line_to(this._points[p].clone());
            break;
          }
          case Verb.QuadraticTo: {
            builder.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            break;
          }
          case Verb.CubicTo: {
            builder.cubic_bezier_to(
              this._points[p].clone(),
              this._points[p + 1].clone(),
              this._points[p + 2].clone()
            );
            break;
          }
          case Verb.Close: {
            if (this._includes_closing_segment()) {
              let to = this._points[0].clone();
              if (to.eq(builder.start)) {
                builder.close();
              } else {
                builder.line_to(to);
              }
            }
            break;
          }
        }
        p += n_stored_points(v);
      }
    }

    return builder.build();
  }

  // Return the subpath inside a given range of t
  // (expecting t between 0 and n, where n is the number of segments)
  // This is equivalent to splitting at the range's end points.
  //
  // Panics if `t_range` is invalid
  public split_range(t_range: Range<number>): this["Self"] {
    let [n0, t0] = this._normalize_time(t_range.start);
    let [n1, t1] = this._normalize_time(t_range.end);
    let builder = Subpath.builder();
    if (t_range.start === 0 && t_range.end === this.segment_count()) {
      builder = this.as_builder();
    } else if (n0 === n1) {
      let nth = this.nth_segment(n0)
        .expect("expected t between 0 and n, where n is the number of segments")
        .split_range(range(t0, t1));

      builder.move_to(nth.from());
      if (t0 !== t1) {
        let match = nth.match();
        switch (match.type) {
          case BezierSegmentType.Linear: {
            let line = match.value;
            if (!line.is_degenerate(0)) {
              builder.line_to(line.to());
            }
            break;
          }
          case BezierSegmentType.Quadratic: {
            let quad = match.value;
            if (!quad.is_a_point(0)) {
              builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
            }
            break;
          }
          case BezierSegmentType.Cubic: {
            let cubic = match.value;
            if (!cubic.is_a_point(0)) {
              builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
            }
            break;
          }
        }
      }
    } else {
      let nth_a = this.nth_segment(n0)
        .expect("expected t between 0 and n, where n is the number of segments")
        .after_split(t0);
      let nth_b = this.nth_segment(n1)
        .expect("expected t between 0 and n, where n is the number of segments")
        .before_split(t1);

      let p = 0;
      const nth_0 = ceil(t_range.start);
      const nth_1 = ceil(t_range.end);
      let nth = 0;
      let split = false;
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            if (t_range.start === 0) {
              split = true;
              builder.move_to(this._points[p].clone());
            }
            break;
          }
          case Verb.LineTo: {
            ++nth;
            if (nth === nth_0) {
              split = true;
              let line = nth_a.linear();
              builder.move_to(line.from());
              if (t0 % 1 > 0) {
                builder.line_to(line.to());
              }
            }
            break;
          }
          case Verb.QuadraticTo: {
            ++nth;
            if (nth === nth_0) {
              split = true;
              let quad = nth_a.quadratic();
              builder.move_to(quad.from());
              if (t0 % 1 > 0) {
                builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
              }
            }
            break;
          }
          case Verb.CubicTo: {
            ++nth;
            if (nth === nth_0) {
              split = true;
              let cubic = nth_a.cubic();
              builder.move_to(cubic.from());
              if (t0 % 1 > 0) {
                builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
              }
            }
            break;
          }
          case Verb.Close: {
            ++nth;
            if (nth === nth_1) {
              split = true;
              let line = nth_b.linear();
              builder.move_to(line.from());
              if (!line.is_degenerate(0)) {
                builder.line_to(line.to());
              }
            } else {
              unreachable();
            }
            break;
          }
        }
        p += n_stored_points(v);
        if (split) {
          break;
        }
      }

      split = false;

      for (let v of verbs) {
        switch (v) {
          case Verb.LineTo: {
            ++nth;
            if (nth === nth_1) {
              split = true;
              let line = nth_b.linear();
              builder.line_to(line.to());
            } else {
              builder.line_to(this._points[p].clone());
            }
            break;
          }
          case Verb.QuadraticTo: {
            ++nth;
            if (nth === nth_1) {
              split = true;
              let quad = nth_b.quadratic();
              builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
            } else {
              builder.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            }
            break;
          }
          case Verb.CubicTo: {
            ++nth;
            if (nth === nth_1) {
              split = true;
              let cubic = nth_b.cubic();
              builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
            } else {
              builder.cubic_bezier_to(
                this._points[p].clone(),
                this._points[p + 1].clone(),
                this._points[p + 2].clone()
              );
            }
            break;
          }
          case Verb.Close: {
            if (this._includes_closing_segment()) {
              ++nth;
              if (nth === nth_1) {
                split = true;
                let line = nth_b.linear();
                let to = line.to();
                if (to.eq(builder.start)) {
                  builder.close();
                } else {
                  builder.line_to(line.to());
                }
              } else {
                unreachable();
              }
            }
            break;
          }
        }
        if (split) {
          break;
        }
        p += n_stored_points(v);
      }
    }
    return builder.build();
  }

  // Swap the direction of the subpath
  public flip(): this["Self"] {
    return this.as_slice()
      .reverse()
      .build();
  }

  // Compute the length of the subpath using a flattened approximation
  public approx_length(tolerance: Scalar): Scalar {
    return this.iter()
      .bezier_segments()
      .fold(0, (acc: number, s: BezierSegment) => {
        return acc + s.approx_length(tolerance);
      });
  }

  // Returns whether this subpath is degenerate.
  public is_degenerate(tolerance: Scalar): boolean {
    if (this._verbs.len() >= 2) {
      let p0 = this._points[0];
      return this._points
        .iter()
        .all((p: Point) => p0.approx_eq_eps(p, point(tolerance, tolerance)));
    }
    return false;
  }

  // BoundingRect
  public fast_bounding_rect(): Rect {
    return this.iter().fast_bounding_rect();
  }

  public fast_bounding_range_x(): [Scalar, Scalar] {
    return this.iter().fast_bounding_range_x();
  }

  public fast_bounding_range_y(): [Scalar, Scalar] {
    return this.iter().fast_bounding_range_y();
  }

  public bounding_rect(): Rect {
    return this.iter().bounding_rect();
  }

  public bounding_range_x(): [Scalar, Scalar] {
    return this.iter().bounding_range_x();
  }

  public bounding_range_y(): [Scalar, Scalar] {
    return this.iter().bounding_range_y();
  }

  // IntoIterator
  public Item!: PathEvent;
  public IntoIter!: SubpathIter;

  public into_iter(): this["IntoIter"] {
    return this.iter();
  }

  // Clone
  public clone(): this["Self"] {
    return new Subpath(this._points.clone(), this._verbs.clone());
  }

  // Debug
  public fmt_debug(): string {
    return format("Subpath({:?},{:?})", this._points, this._verbs);
  }

  private _includes_closing_segment(): boolean {
    return (
      this._closed &&
      !this._closing_segment
        .expect("expected `Subpath._closing_segment` for closed `Subpath`")
        .is_degenerate(0)
    );
  }

  /**
   * Returns a tuple where the first element is the segment `index` for time
   * value `t`, and the second element is the normalized time value for the
   * segment.
   * (expecting t between 0 and n, where n is the number of segments)
   */
  private _normalize_time(t: Scalar): [Scalar, Scalar] {
    let count = this.segment_count();
    let index = t === count ? u64_saturating_sub(count, 1) : floor(t);
    let time = t >= count ? 1 : t % 1;
    return [index, time];
  }
}

/**
 * A path data structure
 *
 * It can be created using a `Builder`, and can be iterated over.
 */
export class Path extends Segment
  implements BoundingRect, Clone, Debug, IntoIterator<PathEvent, PathIter> {
  public Self!: Path;

  protected _points: Point[];
  protected _verbs: Verb[];

  // Cached value of segment count, because it is used frequently
  private _segment_count: Option<number>;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this._points = points;
    this._verbs = verbs;
    this._segment_count = None();
  }

  public static new(): Path {
    return new Path([] as Point[], [] as Verb[]);
  }

  public static builder(): PathObjectBuilder {
    return PathObjectBuilder.new();
  }

  public as_builder(): PathObjectBuilder {
    return new PathObjectBuilder(this._points, this._verbs);
  }

  public subpaths(): Subpaths {
    return new Subpaths(this._points, this._verbs);
  }

  public is_empty(): boolean {
    return this._verbs.is_empty();
  }

  public is_unset(): boolean {
    return this.segment_count() === 0;
  }

  public is_closed(): boolean {
    if (this.is_empty()) {
      return false;
    }
    return this.subpaths().all((p: Subpath) => p.is_closed());
  }

  public first_path(): Option<Subpath> {
    return this.subpaths().next();
  }

  public last_path(): Option<Subpath> {
    return this.subpaths().next_back();
  }

  public nth_path(n: number): Option<Subpath> {
    return this.subpaths().nth(n);
  }

  public path_count(): number {
    return this.subpaths().count();
  }

  public first_segment(): Option<BezierSegment> {
    return this.iter()
      .bezier_segments()
      .next();
  }

  public last_segment(): Option<BezierSegment> {
    return this.iter()
      .bezier_segments()
      .next_back();
  }

  public nth_segment(n: number): Option<BezierSegment> {
    n = u64(n);
    return this.iter()
      .bezier_segments()
      .nth(n);
  }

  public first_point(): Option<Point> {
    return this._points.first();
  }

  public last_point(): Option<Point> {
    return this._points.last();
  }

  public nth_point(n: number): Option<Point> {
    return this._points.get(n);
  }

  public segment_count(): number {
    // NOTE: `bezier_segments` ignores degenerate closing segments
    return this._segment_count.get_or_insert_with(() =>
      this.iter()
        .bezier_segments()
        .count()
    );
  }

  public as_slice(): PathSlice {
    return new PathSlice(this._points, this._verbs);
  }

  public iter(): PathIter {
    return PathIter.new(this._points, this._verbs);
  }

  public append(other: this["Self"]): this["Self"] {
    let points = this._points.concat(other._points);
    let verbs = this._verbs.concat(other._verbs);

    return new Path(points, verbs);
  }

  public cursor(): PathCursor {
    return new PathCursor(
      this._points,
      this._verbs,
      /* vertex */ 0,
      /* verb */ 0,
      /* first_vertex */ 0,
      /* first_verb */ 0
    );
  }

  // Segment

  // Start of the path
  //
  // Panics if path is empty.
  public from(): Point {
    return this.first_segment()
      .unwrap()
      .from();
  }

  // End of the path
  //
  // Panics if path is empty.
  public to(): Point {
    return this.last_segment()
      .unwrap()
      .to();
  }

  // Sample path at t (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public sample(t: Scalar): Point {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .sample(time);
  }

  // Sample x at t (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public x(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .x(time);
  }

  // Sample x at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public y(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .y(time);
  }

  // Sample derivative at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public derivative(t: Scalar): Vector {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .derivative(time);
  }

  // Sample x derivative at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public dx(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .dx(time);
  }

  // Sample y derivative at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public dy(t: Scalar): Scalar {
    let [n, time] = this._normalize_time(t);
    return this.nth_segment(n)
      .expect("expected t between 0 and n, where n is the number of segments")
      .dy(time);
  }

  // Split the path into two paths at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public split(t: Scalar): [this["Self"], this["Self"]] {
    let a = Path.builder();
    let b = Path.builder();

    if (t === 0) {
      a.move_to(this.from());
      b = this.as_builder();
    } else if (t === this.segment_count()) {
      a = this.as_builder();
      b.move_to(this.to());
    } else {
      let [n, time] = this._normalize_time(t);
      let nth_a: BezierSegment;
      let nth_b: BezierSegment;
      if (t % 1 === 0 && t > 0 && t < this.segment_count()) {
        // If t is a whole number between (not including) 0 and the num_segments,
        // then we need to grab both segments and compare their start and end
        // points to determine splits...
        nth_a = this.nth_segment(n - 1).expect(
          "expected t between 0 and n, where n is the number of segments"
        );
        nth_b = this.nth_segment(n).expect(
          "expected t between 0 and n, where n is the number of segments"
        );
      } else {
        [nth_a, nth_b] = this.nth_segment(n)
          .expect("expected t between 0 and n, where n is the number of segments")
          .split(time);
      }
      let p = 0;
      let nth = ceil(t);
      let split = false;
      let split_from = None<Point>();
      let first_position = Point.zero();
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            a.move_to(to);
            break;
          }
          case Verb.LineTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              a.line_to(nth_a.to());
              if (time % 1 > 0) {
                b.move_to(nth_b.from());
                b.line_to(nth_b.to());
              } else {
                split_from = Some(nth_b.from());
              }
            } else {
              a.line_to(this._points[p].clone());
            }
            break;
          }
          case Verb.QuadraticTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let quad_a = nth_a.quadratic();
              a.quadratic_bezier_to(quad_a.ctrl.clone(), quad_a.to());
              if (time % 1 > 0) {
                let quad_b = nth_b.quadratic();
                b.move_to(quad_b.from());
                b.quadratic_bezier_to(quad_b.ctrl.clone(), quad_b.to());
              } else {
                split_from = Some(nth_b.from());
              }
            } else {
              a.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            }
            break;
          }
          case Verb.CubicTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let cubic_a = nth_a.cubic();
              a.cubic_bezier_to(cubic_a.ctrl1.clone(), cubic_a.ctrl2.clone(), cubic_a.to());
              if (time % 1 > 0) {
                let cubic_b = nth_b.cubic();
                b.move_to(cubic_b.from());
                b.cubic_bezier_to(cubic_b.ctrl1.clone(), cubic_b.ctrl2.clone(), cubic_b.to());
              } else {
                split_from = Some(nth_b.from());
              }
            } else {
              a.cubic_bezier_to(
                this._points[p].clone(),
                this._points[p + 1].clone(),
                this._points[p + 2].clone()
              );
            }
            break;
          }
          case Verb.Close: {
            if (first_position.ne(this._points[p - 1])) {
              // If the closing segment is not degenerate, then it counts
              // towards the segment count.
              nth = u64_saturating_sub(nth, 1);
              if (nth === 0) {
                split = true;
                if (nth_a.to().eq(first_position)) {
                  a.close();
                  split_from = Some(nth_b.from());
                } else {
                  a.line_to(nth_a.to());
                  b.move_to(nth_b.from());
                  b.line_to(nth_b.to());
                }
                break;
              }
            }
            a.close();
            break;
          }
        }
        p += n_stored_points(v);
        if (split) {
          break;
        }
      }

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            b.move_to(to);
            if (split_from.is_some()) {
              split_from = None();
            }
            break;
          }
          case Verb.LineTo: {
            if (split_from.is_some()) {
              b.move_to(split_from.take().unwrap());
            }
            b.line_to(this._points[p].clone());
            break;
          }
          case Verb.QuadraticTo: {
            if (split_from.is_some()) {
              b.move_to(split_from.take().unwrap());
            }
            b.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            break;
          }
          case Verb.CubicTo: {
            if (split_from.is_some()) {
              b.move_to(split_from.take().unwrap());
            }
            b.cubic_bezier_to(
              this._points[p].clone(),
              this._points[p + 1].clone(),
              this._points[p + 2].clone()
            );
            break;
          }
          case Verb.Close: {
            if (split_from.is_some()) {
              b.move_to(split_from.take().unwrap());
            }
            if (first_position.eq(b.start)) {
              b.close();
            } else {
              b.line_to(first_position);
            }
            break;
          }
        }
        p += n_stored_points(v);
      }
    }

    return [a.build(), b.build()];
  }

  // Return the path before the split point at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public before_split(t: Scalar): this["Self"] {
    let builder = Path.builder();

    if (t === 0) {
      builder.move_to(this.from());
    } else if (t === this.segment_count()) {
      builder = this.as_builder();
    } else {
      let [n, time] = this._normalize_time(t);
      let nth_seg = this.nth_segment(n)
        .expect("expected t between 0 and n, where n is the number of segments")
        .before_split(time);
      let p = 0;
      let nth = ceil(t);
      let first_position = Point.zero();
      let done = false;
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            builder.move_to(to);
            break;
          }
          case Verb.LineTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              done = true;
              if (time % 1 > 0) {
                let line = nth_seg.linear();
                builder.line_to(line.to());
                break;
              }
            }
            builder.line_to(this._points[p].clone());
            break;
          }
          case Verb.QuadraticTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              done = true;
              if (time % 1 > 0) {
                let quad = nth_seg.quadratic();
                builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
                break;
              }
            }
            builder.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            break;
          }
          case Verb.CubicTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              done = true;
              if (time % 1 > 0) {
                let cubic = nth_seg.cubic();
                builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
                break;
              }
            }
            builder.cubic_bezier_to(
              this._points[p].clone(),
              this._points[p + 1].clone(),
              this._points[p + 2].clone()
            );
            break;
          }
          case Verb.Close: {
            if (first_position.ne(this._points[p - 1])) {
              // If the closing segment is not degenerate, then it counts
              // towards the segment count.
              nth = u64_saturating_sub(nth, 1);
              if (nth === 0) {
                done = true;
                let to = time === 0 ? first_position.clone() : nth_seg.linear().to();
                if (to.ne(builder.start)) {
                  builder.line_to(to);
                  break;
                } else if (first_position.ne(builder.start)) {
                  builder.line_to(first_position.clone());
                  break;
                }
              }
            }
            builder.close();
            break;
          }
        }
        if (done) {
          break;
        }
        p += n_stored_points(v);
      }
    }

    return builder.build();
  }

  // Return the path after the split point at t
  // (expecting t between 0 and n, where n is the number of segments)
  //
  // Panics if `t` is invalid
  public after_split(t: Scalar): this["Self"] {
    let builder = Path.builder();

    if (t === 0) {
      builder = this.as_builder();
    } else if (t === this.segment_count()) {
      builder.move_to(this.to());
    } else {
      let [n, time] = this._normalize_time(t);
      let nth_seg = this.nth_segment(n)
        .expect("expected t between 0 and n, where n is the number of segments")
        .after_split(time);
      let p = 0;
      let nth = ceil(t);
      let split = false;
      let split_from = None<Point>();
      let first_position = Point.zero();
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            break;
          }
          case Verb.LineTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let line = nth_seg.linear();
              if (time % 1 > 0) {
                builder.move_to(line.from());
                builder.line_to(line.to());
              } else {
                split_from = Some(line.from());
              }
            }
            break;
          }
          case Verb.QuadraticTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let quad = nth_seg.quadratic();
              if (time % 1 > 0) {
                builder.move_to(quad.from());
                builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
              } else {
                split_from = Some(quad.from());
              }
            }
            break;
          }
          case Verb.CubicTo: {
            nth = u64_saturating_sub(nth, 1);
            if (nth === 0) {
              split = true;
              let cubic = nth_seg.cubic();
              if (time % 1 > 0) {
                builder.move_to(cubic.from());
                builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
              } else {
                split_from = Some(cubic.from());
              }
            }
            break;
          }
          case Verb.Close: {
            if (first_position.ne(this._points[p - 1])) {
              // If the closing segment is not degenerate, then it counts
              // towards the segment count.
              nth = u64_saturating_sub(nth, 1);
              if (nth === 0) {
                split = true;
                let line = nth_seg.linear();
                if (time % 1 > 0) {
                  builder.move_to(line.from());
                  builder.line_to(line.to());
                } else {
                  split_from = Some(line.from());
                }
                break;
              }
            }
            break;
          }
        }
        p += n_stored_points(v);
        if (split) {
          break;
        }
      }

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            builder.move_to(to);
            if (split_from.is_some()) {
              split_from = None();
            }
            break;
          }
          case Verb.LineTo: {
            if (split_from.is_some()) {
              builder.move_to(split_from.take().unwrap());
            }
            builder.line_to(this._points[p].clone());
            break;
          }
          case Verb.QuadraticTo: {
            if (split_from.is_some()) {
              builder.move_to(split_from.take().unwrap());
            }
            builder.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            break;
          }
          case Verb.CubicTo: {
            if (split_from.is_some()) {
              builder.move_to(split_from.take().unwrap());
            }
            builder.cubic_bezier_to(
              this._points[p].clone(),
              this._points[p + 1].clone(),
              this._points[p + 2].clone()
            );
            break;
          }
          case Verb.Close: {
            if (split_from.is_some()) {
              builder.move_to(split_from.take().unwrap());
            }
            if (first_position.eq(builder.start)) {
              builder.close();
            } else {
              builder.line_to(first_position);
            }
            break;
          }
        }
        p += n_stored_points(v);
      }
    }

    return builder.build();
  }

  // Return the path inside a given range of t
  // (expecting t between 0 and n, where n is the number of segments)
  // This is equivalent to splitting at the range's end points.
  //
  // Panics if `t_range` is invalid
  public split_range(t_range: Range<number>): this["Self"] {
    let [n0, t0] = this._normalize_time(t_range.start);
    let [n1, t1] = this._normalize_time(t_range.end);
    let builder = Path.builder();
    if (t_range.start === 0 && t_range.end === this.segment_count()) {
      builder = this.as_builder();
    } else if (n0 === n1) {
      let nth = this.nth_segment(n0)
        .expect("expected t between 0 and n, where n is the number of segments")
        .split_range(range(t0, t1));

      builder.move_to(nth.from());
      if (t0 !== t1) {
        let match = nth.match();
        switch (match.type) {
          case BezierSegmentType.Linear: {
            let line = match.value;
            builder.line_to(line.to());
            break;
          }
          case BezierSegmentType.Quadratic: {
            let quad = match.value;
            builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
            break;
          }
          case BezierSegmentType.Cubic: {
            let cubic = match.value;
            builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
            break;
          }
        }
      }
    } else {
      let nth_a = this.nth_segment(n0)
        .expect("expected t between 0 and n, where n is the number of segments")
        .after_split(t0);
      let nth_b = this.nth_segment(n1)
        .expect("expected t between 0 and n, where n is the number of segments")
        .before_split(t1);

      let p = 0;
      const nth_0 = ceil(t_range.start);
      const nth_1 = ceil(t_range.end);
      let nth = 0;
      let split = false;
      let first_position = Point.zero();
      let need_moveto = false;
      let verbs = this._verbs.iter();

      for (let v of verbs) {
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            if (t_range.start === 0) {
              split = true;
              builder.move_to(to);
            }
            break;
          }
          case Verb.LineTo: {
            ++nth;
            if (nth === nth_0) {
              split = true;
              if (t0 % 1 > 0) {
                let line = nth_a.linear();
                builder.move_to(line.from());
                builder.line_to(line.to());
              } else {
                need_moveto = true;
              }
            }
            break;
          }
          case Verb.QuadraticTo: {
            ++nth;
            if (nth === nth_0) {
              split = true;
              if (t0 % 1 > 0) {
                let quad = nth_a.quadratic();
                builder.move_to(quad.from());
                builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
              } else {
                need_moveto = true;
              }
            }
            break;
          }
          case Verb.CubicTo: {
            ++nth;
            if (nth === nth_0) {
              split = true;
              if (t0 % 1 > 0) {
                let cubic = nth_a.cubic();
                builder.move_to(cubic.from());
                builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
              } else {
                need_moveto = true;
              }
            }
            break;
          }
          case Verb.Close: {
            if (first_position.ne(this._points[p - 1])) {
              ++nth;
              if (nth === nth_0) {
                split = true;
                if (t0 % 1 > 0) {
                  let line = nth_a.linear();
                  builder.move_to(line.from());
                  builder.line_to(line.to());
                } else {
                  need_moveto = true;
                }
              }
            }
            break;
          }
        }
        p += n_stored_points(v);
        if (split) {
          break;
        }
      }

      split = nth === nth_1;

      for (let v of verbs) {
        if (split) {
          break;
        }
        switch (v) {
          case Verb.MoveTo: {
            let to = this._points[p].clone();
            first_position = to;
            builder.move_to(to);
            need_moveto = false;
            break;
          }
          case Verb.LineTo: {
            ++nth;
            if (need_moveto) {
              builder.move_to(this._points[p - 1].clone());
              need_moveto = false;
            }
            if (nth === nth_1) {
              split = true;
              if (t1 % 1 > 0) {
                let line = nth_b.linear();
                builder.line_to(line.to());
                break;
              }
            }
            builder.line_to(this._points[p].clone());
            break;
          }
          case Verb.QuadraticTo: {
            ++nth;
            if (need_moveto) {
              builder.move_to(this._points[p - 1].clone());
              need_moveto = false;
            }
            if (nth === nth_1) {
              split = true;
              if (t1 % 1 > 0) {
                let quad = nth_b.quadratic();
                builder.quadratic_bezier_to(quad.ctrl.clone(), quad.to());
                break;
              }
            }
            builder.quadratic_bezier_to(this._points[p].clone(), this._points[p + 1].clone());
            break;
          }
          case Verb.CubicTo: {
            ++nth;
            if (need_moveto) {
              builder.move_to(this._points[p - 1].clone());
              need_moveto = false;
            }
            if (nth === nth_1) {
              split = true;
              if (t1 % 1 > 0) {
                let cubic = nth_b.cubic();
                builder.cubic_bezier_to(cubic.ctrl1.clone(), cubic.ctrl2.clone(), cubic.to());
                break;
              }
            }
            builder.cubic_bezier_to(
              this._points[p].clone(),
              this._points[p + 1].clone(),
              this._points[p + 2].clone()
            );
            break;
          }
          case Verb.Close: {
            if (first_position.ne(this._points[p - 1])) {
              ++nth;
              if (nth === nth_1) {
                split = true;
                let to = t1 === 0 ? first_position.clone() : nth_b.linear().to();
                if (to.ne(builder.start)) {
                  builder.line_to(to);
                  break;
                }
              } else if (first_position.ne(builder.start)) {
                builder.line_to(first_position.clone());
                break;
              }
            }
            builder.close();
            break;
          }
        }
        p += n_stored_points(v);
      }
    }
    return builder.build();
  }

  // Swap the direction of the path
  public flip(): this["Self"] {
    return this.as_slice()
      .reverse()
      .build();
  }

  // Compute the length of the path using a flattened approximation
  public approx_length(tolerance: Scalar): Scalar {
    return this.iter()
      .bezier_segments()
      .fold(0, (acc: number, s: BezierSegment) => {
        return acc + s.approx_length(tolerance);
      });
  }

  // Returns whether this path is degenerate.
  public is_degenerate(tolerance: Scalar): boolean {
    if (this._verbs.len() >= 2) {
      let p0 = this._points[0];
      return this._points
        .iter()
        .all((p: Point) => p0.approx_eq_eps(p, point(tolerance, tolerance)));
    }
    return false;
  }

  // BoundingRect
  public fast_bounding_rect(): Rect {
    return this.iter().fast_bounding_rect();
  }

  public fast_bounding_range_x(): [Scalar, Scalar] {
    return this.iter().fast_bounding_range_x();
  }

  public fast_bounding_range_y(): [Scalar, Scalar] {
    return this.iter().fast_bounding_range_y();
  }

  public bounding_rect(): Rect {
    return this.iter().bounding_rect();
  }

  public bounding_range_x(): [Scalar, Scalar] {
    return this.iter().bounding_range_x();
  }

  public bounding_range_y(): [Scalar, Scalar] {
    return this.iter().bounding_range_y();
  }

  // IntoIterator
  public Item!: PathEvent;
  public IntoIter!: PathIter;

  public into_iter(): this["IntoIter"] {
    return this.iter();
  }

  // Clone
  public clone(): this["Self"] {
    return new Path(this._points.clone(), this._verbs.clone());
  }

  // Debug
  public fmt_debug(): string {
    return format("Path({:?},{:?})", this._points, this._verbs);
  }

  /**
   * Returns a tuple where the first element is the segment `index` for time
   * value `t`, and the second element is the normalized time value for the
   * segment.
   * (expecting t between 0 and n, where n is the number of segments)
   */
  private _normalize_time(t: Scalar): [Scalar, Scalar] {
    let count = this.segment_count();
    let index = t === count ? u64_saturating_sub(count, 1) : floor(t);
    let time = t >= count ? 1 : t % 1;
    return [index, time];
  }
}

/**
 * An immutable view of a Subpath
 */
export class SubpathSlice implements Clone, Debug, IntoIterator<PathEvent, SubpathIter> {
  public Self!: SubpathSlice;

  private _points: Point[];
  private _verbs: Verb[];

  public constructor(points: Point[], verbs: Verb[]) {
    this._points = points;
    this._verbs = verbs;
  }

  public iter(): SubpathIter {
    return new SubpathIter(this._points, this._verbs);
  }

  public iter_from(cursor: SubpathCursor): SubpathIter {
    return new SubpathIter(this._points.slice(cursor.vertex), this._verbs.slice(cursor.verb));
  }

  public iter_until(cursor: SubpathCursor): SubpathIter {
    return new SubpathIter(this._points.slice(0, cursor.vertex), this._verbs.slice(0, cursor.verb));
  }

  public iter_range(start: SubpathCursor, end: SubpathCursor): SubpathIter {
    return new SubpathIter(
      this._points.slice(start.vertex, end.vertex),
      this._verbs.slice(start.verb, end.verb)
    );
  }

  public points(): Point[] {
    return this._points;
  }

  public reverse(): SubpathBuilder {
    let builder = Subpath.builder();
    // At each iteration, p points to the first point after the current verb.
    let p = this._points.len();
    let need_close = false;
    let need_moveto = true;

    let n = 0;

    for (let v of this._verbs
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
            builder.move_to(this._points[p - 1]);
          }
          break;
        }
        default:
          break;
      }

      switch (v) {
        case Verb.Close: {
          need_close = true;
          builder.move_to(this._points[p - 1]);
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
          builder.line_to(this._points[p - 2]);
          break;
        }
        case Verb.QuadraticTo: {
          builder.quadratic_bezier_to(this._points[p - 2], this._points[p - 3]);
          break;
        }
        case Verb.CubicTo: {
          builder.cubic_bezier_to(this._points[p - 2], this._points[p - 3], this._points[p - 4]);
          break;
        }
      }
      p -= n_stored_points(v);
    }

    // This is a special case that the logic above misses: The path only contains
    // a single MoveTo event.
    if (n === 1 && need_moveto) {
      builder.move_to(this._points[p]);
    }
    return builder;
  }

  // Clone
  public clone(): this["Self"] {
    return new SubpathSlice(this._points.clone(), this._verbs.clone());
  }

  // Debug
  public fmt_debug(): string {
    return format("SubpathSlice({:?},{:?})", this._points, this._verbs);
  }

  // IntoIterator
  public Item!: PathEvent;
  public IntoIter!: SubpathIter;

  public into_iter(): SubpathIter {
    return this.iter();
  }
}

/**
 * An immutable view of a Path
 */
export class PathSlice implements Clone, Debug, IntoIterator<PathEvent, PathIter> {
  public Self!: PathSlice;

  private _points: Point[];
  private _verbs: Verb[];

  public constructor(points: Point[], verbs: Verb[]) {
    this._points = points;
    this._verbs = verbs;
  }

  public iter(): PathIter {
    return PathIter.new(this._points, this._verbs);
  }

  public iter_from(cursor: PathCursor): PathIter {
    return PathIter.new(this._points.slice(cursor.vertex), this._verbs.slice(cursor.verb));
  }

  public iter_until(cursor: PathCursor): PathIter {
    return PathIter.new(this._points.slice(0, cursor.vertex), this._verbs.slice(0, cursor.verb));
  }

  public iter_range(start: PathCursor, end: PathCursor): PathIter {
    return PathIter.new(
      this._points.slice(start.vertex, end.vertex),
      this._verbs.slice(start.verb, end.verb)
    );
  }

  public points(): Point[] {
    return this._points;
  }

  public reverse(): PathObjectBuilder {
    let builder = Path.builder();
    // At each iteration, p points to the first point after the current verb.
    let p = this._points.len();
    let need_close = false;
    let need_moveto = true;

    let n = 0;

    for (let v of this._verbs
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
            builder.move_to(this._points[p - 1]);
          }
          break;
        }
        default:
          break;
      }

      switch (v) {
        case Verb.Close: {
          need_close = true;
          builder.move_to(this._points[p - 1]);
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
          builder.line_to(this._points[p - 2]);
          break;
        }
        case Verb.QuadraticTo: {
          builder.quadratic_bezier_to(this._points[p - 2], this._points[p - 3]);
          break;
        }
        case Verb.CubicTo: {
          builder.cubic_bezier_to(this._points[p - 2], this._points[p - 3], this._points[p - 4]);
          break;
        }
      }
      p -= n_stored_points(v);
    }

    // This is a special case that the logic above misses: The path only contains
    // a single MoveTo event.
    if (n === 1 && need_moveto) {
      builder.move_to(this._points[p]);
    }
    return builder;
  }

  // Clone
  public clone(): this["Self"] {
    return new PathSlice(this._points.clone(), this._verbs.clone());
  }

  // Debug
  public fmt_debug(): string {
    return format("PathSlice({:?},{:?})", this._points, this._verbs);
  }

  // IntoIterator
  public Item!: PathEvent;
  public IntoIter!: PathIter;

  public into_iter(): PathIter {
    return this.iter();
  }
}

/**
 * Builds subpath object using the FlatPathBuilder interface.
 */
export class SubpathBuilder extends PathBuilder implements Build, PolygonBuilder {
  public Self!: SubpathBuilder;

  public start: Point;

  private _points: Point[];
  private _verbs: Verb[];
  private _need_moveto: boolean;
  private _closed: boolean;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this._points = points;
    this._verbs = verbs;
    this.start = this._points.first().unwrap_or(Point.zero());

    this._need_moveto = this._verbs.first().map_or(true, (v: Verb) => {
      assert_eq(v, Verb.MoveTo);
      return false;
    });
    this._closed = this._verbs.last().map_or(false, (v: Verb) => v === Verb.Close);
  }

  public static new(): SubpathBuilder {
    return new SubpathBuilder([] as Point[], [] as Verb[]);
  }

  public with_svg(): SvgPathBuilderAndBuild<this> {
    return new SvgPathBuilderAndBuild(this);
  }

  public flattened(tolerance: number): FlatteningBuilderAndBuild<this> {
    return new FlatteningBuilderAndBuild(this, tolerance);
  }

  public is_empty(): boolean {
    return this._verbs.is_empty();
  }

  // FlatPathBuilder
  /**
   * Set's the start point of the subpath.
   */
  public move_to(to: Point) {
    nan_check(to);
    this.start = to;
    if (this._need_moveto) {
      this._need_moveto = false;
      this._points.push(to);
      this._verbs.push(Verb.MoveTo);
    } else {
      this._points[0] = to;
    }
  }

  public line_to(to: Point) {
    if (!this._closed) {
      nan_check(to);
      this.move_to_if_needed();
      this._points.push(to);
      this._verbs.push(Verb.LineTo);
    }
  }

  public close() {
    // If the subpath is not closed and it contains at least 1 segments
    if (!this._closed && this._verbs.len() >= 2) {
      // Relative path ops tend to accumulate small floating point imprecisions
      // which results in the last segment ending almost but not quite at the
      // start of the sub-path, causing a new edge to be inserted which often
      // intersects with the first or last edge. This can affect algorithms that
      // Don't handle self-intersecting paths.
      // Deal with this by snapping the last point if it is very close to the
      // start of the sub path.
      let last = this._points.len() - 1;
      let d = this._points[last].sub(this.start).abs();
      if (d.x + d.y < 0.0001) {
        this._points[last] = this.start;
      }

      this._verbs.push(Verb.Close);
      this._closed = true;
    }
  }

  public current_position(): Point {
    if (this._closed) {
      return this.start;
    }
    return this._points.last().unwrap_or(this.start);
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    if (!this._closed) {
      nan_check(ctrl);
      nan_check(to);
      this.move_to_if_needed();
      this._points.push(ctrl);
      this._points.push(to);
      this._verbs.push(Verb.QuadraticTo);
    }
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    if (!this._closed) {
      nan_check(ctrl1);
      nan_check(ctrl2);
      nan_check(to);
      this.move_to_if_needed();
      this._points.push(ctrl1);
      this._points.push(ctrl2);
      this._points.push(to);
      this._verbs.push(Verb.CubicTo);
    }
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    if (!this._closed) {
      nan_check(center);
      nan_check(radii.to_point());
      debug_assert(!isNaN(sweep_angle.get()));
      debug_assert(!isNaN(x_rotation.get()));

      let start_angle = this.current_position()
        .sub(center)
        .angle_from_x_axis()
        .sub(x_rotation);
      let arc = new Arc(center, radii, start_angle, sweep_angle, x_rotation);
      arc.for_each_quadratic_bezier((curve: QuadraticBezierSegment) => {
        this.quadratic_bezier_to(curve.ctrl, curve.to());
      });
    }
  }

  // PolygonBuilder
  public polygon(points: Point[]) {
    build_polygon(this, points);
  }

  public move_to_if_needed() {
    if (this._need_moveto) {
      this.move_to(this.start);
    }
  }

  /**
   * Remove the last path event.
   */
  public undo() {
    let verb = this._verbs.pop();
    if (verb) {
      if (verb === (Verb.MoveTo as Verb)) {
        this._need_moveto = true;
      } else if (verb === Verb.Close) {
        this._closed = false;
      }
      let p = this._points.len() - n_stored_points(verb);
      this._points.splice(p);
    }
  }

  /**
   * Returns a cursor to the next path event.
   */
  public cursor(): SubpathCursor {
    if (this._verbs.len() > 0) {
      let verb = this._verbs[this._verbs.len() - 1];
      let p = this._points.len() - n_stored_points(verb);

      return new SubpathCursor(
        this._points,
        this._verbs,
        /* vertex */ p,
        /* verb */ this._verbs.len() - 1
      );
    } else {
      return new SubpathCursor(this._points, this._verbs, /* vertex */ 0, /* verb */ 0);
    }
  }

  // Build
  public PathType!: Subpath;

  public build(): this["PathType"] {
    return new Subpath(this._points.clone(), this._verbs.clone());
  }

  public build_and_reset(): this["PathType"] {
    this.start = Point.zero();
    this._need_moveto = true;
    this._closed = false;

    let ret = new Subpath(this._points, this._verbs);

    this._points = [];
    this._verbs = [];

    return ret;
  }
}

/**
 * Builds path object using the PathBuilder interface.
 */
export class PathObjectBuilder extends PathBuilder implements Build, PolygonBuilder {
  public Self!: PathObjectBuilder;

  public start: Point;

  private _points: Point[];
  private _verbs: Verb[];
  private _current_position: Point;
  private _first_vertex: number;
  private _first_verb: number;
  private _need_moveto: boolean;
  private _can_start_subpath: boolean;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this._points = points;
    this._verbs = verbs;
    this._current_position = this._points.last().unwrap_or(Point.zero());
    if (this._points.is_empty()) {
      this.start = Point.zero();
      this._first_vertex = 0;
      this._first_verb = 0;
    } else {
      this.start = new Subpaths(points, verbs)
        .next_back()
        .map_or(Point.zero(), (p: Subpath) => p.from());
      this._first_vertex = 0;
      this._first_verb = 0;
      for (let [i, verb] of this._verbs
        .iter()
        .enumerate()
        .rev()) {
        let need_moveto = true;
        let p = this._points.len() - 1;
        switch (verb) {
          case Verb.MoveTo: {
            p -= n_stored_points(verb);
            this._first_verb = i;
            this._first_vertex = p;
            need_moveto = false;
            break;
          }
          default: {
            p -= n_stored_points(verb);
            break;
          }
        }
        if (!need_moveto) {
          break;
        }
      }
    }

    this._need_moveto = this._verbs.first().map_or(true, (v: Verb) => {
      assert_eq(v, Verb.MoveTo);
      return this._verbs.last().unwrap() === Verb.Close;
    });
    this._can_start_subpath = this._verbs.last().map_or(true, (v: Verb) => v !== Verb.MoveTo);
  }

  public static new(): PathObjectBuilder {
    return new PathObjectBuilder([] as Point[], [] as Verb[]);
  }

  public with_svg(): SvgPathBuilderAndBuild<this> {
    return new SvgPathBuilderAndBuild(this);
  }

  public flattened(tolerance: number): FlatteningBuilderAndBuild<this> {
    return new FlatteningBuilderAndBuild(this, tolerance);
  }

  public is_empty(): boolean {
    return this._verbs.is_empty();
  }

  // FlatPathBuilder
  public move_to(to: Point) {
    nan_check(to);
    this.start = to;
    if (this._need_moveto || this._can_start_subpath) {
      this._need_moveto = false;
      this._can_start_subpath = false;
      this._first_vertex = this._points.len();
      this._first_verb = this._verbs.len();
      this._points.push(to);
      this._verbs.push(Verb.MoveTo);
      this._current_position = to;
    } else {
      this._points[this._first_vertex] = to;
    }
  }

  public line_to(to: Point) {
    nan_check(to);
    this._move_to_if_needed();
    this._points.push(to);
    this._verbs.push(Verb.LineTo);
    this._current_position = to;
    this._can_start_subpath = true;
  }

  public close() {
    // If the path contains at least 1 segments
    if (this._verbs.iter().any((v: Verb) => v !== Verb.MoveTo)) {
      // Relative path ops tend to accumulate small floating point imprecisions
      // which results in the last segment ending almost but not quite at the
      // start of the sub-path, causing a new edge to be inserted which often
      // intersects with the first or last edge. This can affect algorithms that
      // Don't handle self-intersecting paths.
      // Deal with this by snapping the last point if it is very close to the
      // start of the sub path.
      let last = this._points.len() - 1;
      let d = this._points[last].sub(this.start).abs();
      if (d.x + d.y < 0.0001) {
        this._points[last] = this.start;
      }

      this._verbs.push(Verb.Close);
      this._current_position = this.start;
      this._need_moveto = true;
      this._can_start_subpath = true;
    }
  }

  public current_position(): Point {
    return this._current_position;
  }

  // PathBuilder
  public quadratic_bezier_to(ctrl: Point, to: Point) {
    nan_check(ctrl);
    nan_check(to);
    this._move_to_if_needed();
    this._points.push(ctrl);
    this._points.push(to);
    this._verbs.push(Verb.QuadraticTo);
    this._current_position = to;
    this._can_start_subpath = true;
  }

  public cubic_bezier_to(ctrl1: Point, ctrl2: Point, to: Point) {
    nan_check(ctrl1);
    nan_check(ctrl2);
    nan_check(to);
    this._move_to_if_needed();
    this._points.push(ctrl1);
    this._points.push(ctrl2);
    this._points.push(to);
    this._verbs.push(Verb.CubicTo);
    this._current_position = to;
    this._can_start_subpath = true;
  }

  public arc(center: Point, radii: Vector, sweep_angle: Angle, x_rotation: Angle) {
    nan_check(center);
    nan_check(radii.to_point());
    debug_assert(!isNaN(sweep_angle.get()));
    debug_assert(!isNaN(x_rotation.get()));

    let start_angle = this.current_position()
      .sub(center)
      .angle_from_x_axis()
      .sub(x_rotation);
    let arc = new Arc(center, radii, start_angle, sweep_angle, x_rotation);
    arc.for_each_quadratic_bezier((curve: QuadraticBezierSegment) => {
      this.quadratic_bezier_to(curve.ctrl, curve.to());
    });
    this._can_start_subpath = true;
  }

  // PolygonBuilder
  public polygon(points: Point[]) {
    build_polygon(this, points);
  }

  private _move_to_if_needed() {
    if (this._need_moveto) {
      this.move_to(this.start);
    }
  }

  /**
   * Remove the last path event.
   */
  public undo() {
    let verb = this._verbs.pop();
    if (verb) {
      let p = this._points.len() - n_stored_points(verb);
      this._points.splice(p);
      this._current_position = this._points.last().unwrap_or(Point.zero());
      this._can_start_subpath = this._verbs.last().map_or(true, (v: Verb) => v !== Verb.MoveTo);
      if (verb === (Verb.MoveTo as Verb)) {
        this._need_moveto = true;
        if (this._points.is_empty()) {
          this.start = Point.zero();
          this._first_vertex = 0;
          this._first_verb = 0;
        } else {
          this.start = new Subpaths(this._points, this._verbs)
            .next_back()
            .map_or(Point.zero(), (p: Subpath) => p.from());
          for (let [i, verb] of this._verbs
            .iter()
            .enumerate()
            .rev()) {
            let need_moveto = true;
            let p = this._points.len() - 1;
            switch (verb) {
              case Verb.MoveTo: {
                p -= n_stored_points(verb);
                this._first_verb = i;
                this._first_vertex = p;
                need_moveto = false;
                break;
              }
              default: {
                p -= n_stored_points(verb);
                break;
              }
            }
            if (!need_moveto) {
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Returns a cursor to the next path event.
   */
  public cursor(): PathCursor {
    if (this._verbs.len() > 0) {
      let verb = this._verbs[this._verbs.len() - 1];
      let p = this._points.len() - n_stored_points(verb);

      return new PathCursor(
        this._points,
        this._verbs,
        /* vertex */ p,
        /* verb */ this._verbs.len() - 1,
        /* first_vertex */ this._first_vertex,
        /* first_verb */ this._first_verb
      );
    } else {
      return new PathCursor(
        this._points,
        this._verbs,
        /* vertex */ 0,
        /* verb */ 0,
        /* first_vertex */ 0,
        /* first_verb */ 0
      );
    }
  }

  // Build
  public PathType!: Path;

  public build(): this["PathType"] {
    return new Path(this._points.clone(), this._verbs.clone());
  }

  public build_and_reset(): this["PathType"] {
    this._current_position = Point.zero();
    this.start = Point.zero();
    this._first_vertex = 0;
    this._first_verb = 0;
    this._need_moveto = true;

    let ret = new Path(this._points, this._verbs);

    this._points = [];
    this._verbs = [];

    return ret;
  }
}

/**
 * A SubpathCursor refers to an event within a Path.
 */
export class SubpathCursor extends ImplEq(ImplPartialEq(Self)) implements Clone, Debug {
  public Self!: SubpathCursor;

  public vertex: number;
  public verb: number;

  protected _points: Point[];
  protected _verbs: Verb[];

  public constructor(points: Point[], verbs: Verb[], vertex: number, verb: number) {
    super();
    this._points = points;
    this._verbs = verbs;
    this.vertex = vertex;
    this.verb = verb;
  }

  /**
   * Move the cursor to the next event in the `Subpath`
   *
   * Returns false if the cursor is already at the last event.
   */
  public next(): boolean {
    if (this.verb >= this._verbs.len() - 1) {
      return false;
    }

    let verb = this._verbs[this.verb + 1];

    this.vertex = this.vertex + n_stored_points(verb);
    this.verb += 1;

    return true;
  }

  /**
   * Move the cursor to the previous event in the `Subpath`.
   *
   * Returns false if the cursor is already at the first event.
   */
  public previous(): boolean {
    if (this.verb === 0) {
      return false;
    }

    this.vertex = this.vertex - n_stored_points(this._verbs[this.verb - 1]);
    this.verb -= 1;

    return true;
  }

  /**
   * Returns the `PathEvent` at the current cursor position in the path.
   */
  public event(): PathEvent {
    let p = this.vertex;
    switch (this._verbs[this.verb]) {
      case Verb.MoveTo:
        return PathEvent.MoveTo(this._points[p]);
      case Verb.LineTo:
        return PathEvent.Line(new LineSegment(this._points[p - 1], this._points[p]));
      case Verb.QuadraticTo:
        return PathEvent.Quadratic(
          new QuadraticBezierSegment(this._points[p - 1], this._points[p], this._points[p + 1])
        );
      case Verb.CubicTo:
        return PathEvent.Cubic(
          new CubicBezierSegment(
            this._points[p - 1],
            this._points[p],
            this._points[p + 1],
            this._points[p + 2]
          )
        );
      case Verb.Close:
        return PathEvent.Close(new LineSegment(this._points[p - 1], this._points[0]));
    }
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this._points === other._points &&
      this._verbs === other._verbs &&
      this.vertex === other.vertex &&
      this.verb === other.verb
    );
  }

  // Clone
  public clone(): this["Self"] {
    return new SubpathCursor(this._points, this._verbs, this.vertex, this.verb);
  }

  // Debug
  public fmt_debug(): string {
    return format(
      "SubpathCursor({:?},{:?},{:?},{:?})",
      this._points,
      this._verbs,
      this.vertex,
      this.verb
    );
  }
}

/**
 * A PathCursor refers to an event within a Path.
 */
export class PathCursor extends ImplEq(ImplPartialEq(Self)) implements Clone, Debug {
  public Self!: PathCursor;

  protected _points: Point[];
  protected _verbs: Verb[];

  public vertex: number;
  public verb: number;
  public first_vertex: number;
  public first_verb: number;

  public constructor(
    points: Point[],
    verbs: Verb[],
    vertex: number,
    verb: number,
    first_vertex: number,
    first_verb: number
  ) {
    super();
    this._points = points;
    this._verbs = verbs;
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
  public next(): boolean {
    if (this.verb >= this._verbs.len() - 1) {
      return false;
    }

    let verb = this._verbs[this.verb + 1];
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
  public previous(): boolean {
    if (this.verb === 0) {
      return false;
    }

    if (this._verbs[this.verb] === Verb.MoveTo) {
      let v = this.verb;
      let p = this.vertex;
      while (p > 0) {
        v -= 1;
        p -= n_stored_points(this._verbs[v]);
        if (this._verbs[v] === Verb.MoveTo) {
          break;
        }
      }

      this.first_vertex = p;
      this.first_verb = v;
    }

    this.vertex = this.vertex - n_stored_points(this._verbs[this.verb - 1]);
    this.verb -= 1;

    return true;
  }

  /**
   * Returns the `PathEvent` at the current cursor position in the path.
   */
  public event(): PathEvent {
    let p = this.vertex;
    switch (this._verbs[this.verb]) {
      case Verb.MoveTo:
        return PathEvent.MoveTo(this._points[p]);
      case Verb.LineTo:
        return PathEvent.Line(new LineSegment(this._points[p - 1], this._points[p]));
      case Verb.QuadraticTo:
        return PathEvent.Quadratic(
          new QuadraticBezierSegment(this._points[p - 1], this._points[p], this._points[p + 1])
        );
      case Verb.CubicTo:
        return PathEvent.Cubic(
          new CubicBezierSegment(
            this._points[p - 1],
            this._points[p],
            this._points[p + 1],
            this._points[p + 2]
          )
        );
      case Verb.Close:
        return PathEvent.Close(
          new LineSegment(this._points[p - 1], this._points[this.first_vertex])
        );
    }
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this._points === other._points &&
      this._verbs === other._verbs &&
      this.vertex === other.vertex &&
      this.verb === other.verb &&
      this.first_vertex === other.first_vertex &&
      this.first_verb === other.first_verb
    );
  }

  // Clone
  public clone(): this["Self"] {
    return new PathCursor(
      this._points,
      this._verbs,
      this.vertex,
      this.verb,
      this.first_vertex,
      this.first_verb
    );
  }

  // Debug
  public fmt_debug(): string {
    return format(
      "PathCursor({:?},{:?},{:?},{:?},{:?},{:?})",
      this._points,
      this._verbs,
      this.vertex,
      this.verb,
      this.first_vertex,
      this.first_verb
    );
  }
}

/**
 * An iterator for Subpath and SubpathSlice
 */
export class SubpathIter extends PathEventIterator implements Clone, Debug {
  public Self!: SubpathIter;

  private _points: ReturnType<ArrayIntoIter<Point>["peekable"]>;
  private _verbs: ArrayIntoIter<Verb>;
  private _current_front: Option<Point>;
  private _current_back: Option<Point>;
  private _first: Option<Point>;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this._points = points.iter().peekable();
    this._verbs = verbs.iter();
    this._current_front = None();
    this._current_back = None();
    this._first = None();
  }

  // Iterator
  public Item!: PathEvent;

  public next(): Option<PathEvent> {
    let next_verb = this._verbs.next();
    if (next_verb.is_some()) {
      let verb = next_verb.unwrap();
      switch (verb) {
        case Verb.MoveTo: {
          this._current_front = this._points.next().or(this._current_back);
          this._first = this._current_front;
          return Some(PathEvent.MoveTo(this._first.unwrap()));
        }
        case Verb.LineTo: {
          let from = this._current_front.unwrap();
          this._current_front = this._points.next().or(this._current_back);
          return Some(PathEvent.Line(new LineSegment(from, this._current_front.unwrap())));
        }
        case Verb.QuadraticTo: {
          let from = this._current_front.unwrap();
          let ctrl = this._points.next().unwrap();
          this._current_front = this._points.next().or(this._current_back);
          return Some(
            PathEvent.Quadratic(
              new QuadraticBezierSegment(from, ctrl, this._current_front.unwrap())
            )
          );
        }
        case Verb.CubicTo: {
          let from = this._current_front.unwrap();
          let ctrl1 = this._points.next().unwrap();
          let ctrl2 = this._points.next().unwrap();
          this._current_front = this._points.next().or(this._current_back);
          return Some(
            PathEvent.Cubic(
              new CubicBezierSegment(from, ctrl1, ctrl2, this._current_front.unwrap())
            )
          );
        }
        case Verb.Close: {
          return Some(
            PathEvent.Close(new LineSegment(this._current_front.unwrap(), this._first.unwrap()))
          );
        }
      }
    }
    return None();
  }

  public size_hint(): [number, Option<number>] {
    let n = this._verbs.len();
    return [n, Some(n)];
  }

  // DoubleEndedIterator
  public next_back(): Option<PathEvent> {
    let next_verb = this._verbs.next_back();
    if (next_verb.is_some()) {
      let verb = next_verb.unwrap();
      switch (verb) {
        case Verb.MoveTo: {
          this._current_back = this._points.next_back().or(this._current_back);
          return Some(PathEvent.MoveTo(this._current_back.unwrap()));
        }
        case Verb.LineTo: {
          let to = this._current_back.or_else(() => this._points.next_back()).unwrap();
          this._current_back = this._points.next_back().or(this._current_front);
          return Some(PathEvent.Line(new LineSegment(this._current_back.unwrap(), to)));
        }
        case Verb.QuadraticTo: {
          let to = this._current_back.or_else(() => this._points.next_back()).unwrap();
          let ctrl = this._points.next_back().unwrap();
          this._current_back = this._points.next_back().or(this._current_front);
          return Some(
            PathEvent.Quadratic(new QuadraticBezierSegment(this._current_back.unwrap(), ctrl, to))
          );
        }
        case Verb.CubicTo: {
          let to = this._current_back.or_else(() => this._points.next_back()).unwrap();
          let ctrl2 = this._points.next_back().unwrap();
          let ctrl1 = this._points.next_back().unwrap();
          this._current_back = this._points.next_back().or(this._current_front);
          return Some(
            PathEvent.Cubic(new CubicBezierSegment(this._current_back.unwrap(), ctrl1, ctrl2, to))
          );
        }
        case Verb.Close: {
          this._first = this._first.or_else(() => this._points.peek());
          this._current_back = this._points.next_back().or(this._current_front);
          return Some(
            PathEvent.Close(new LineSegment(this._current_back.unwrap(), this._first.unwrap()))
          );
        }
      }
    }
    return None();
  }

  // Clone
  public clone(): this["Self"] {
    return new SubpathIter(this._points.iter.as_array(), this._verbs.as_array());
  }

  // Debug
  public fmt_debug(): string {
    return format("SubpathIter({:?},{:?})", this._points, this._verbs);
  }
}

/**
 * Turns an iterator of `PathEvent` into an iterator of `Subpath`.
 */
export class Subpaths extends DoubleEndedIterator<Subpath> implements Clone, Debug {
  public Self!: Subpaths;

  private _points: Point[];
  private _verbs: Verb[];
  private _iter: ReturnType<ArrayIntoIter<Verb>["enumerate"]>;
  private _first: boolean;
  private _first_verb: number;
  private _last_verb: number;
  private _first_position: number;
  private _last_position: number;
  private _current_front: number;
  private _current_back: number;

  public constructor(points: Point[], verbs: Verb[]) {
    super();
    this._points = points;
    this._verbs = verbs;
    this._iter = this._verbs.iter().enumerate();
    this._first = true;
    this._first_verb = 0;
    this._last_verb = this._verbs.len();
    this._first_position = 0;
    this._last_position = this._points.len();
    this._current_front = 0;
    this._current_back = this._points.len() - 1;
  }

  // Iterator
  public Item!: Subpath;

  public next(): Option<Subpath> {
    let next = this._iter.next();
    if (next.is_some()) {
      let [i, verb] = next.unwrap();
      switch (verb) {
        case Verb.MoveTo: {
          if (this._first) {
            this._first_verb = i;
            this._first_position = this._current_front;
            this._first = false;
            break;
          }
          let v = this._first_verb;
          let from = this._first_position;
          this._first_verb = i;
          this._first_position = this._current_front;
          this._current_front += n_stored_points(verb);
          return Some(
            new Subpath(this._points.slice(from, this._current_front), this._verbs.slice(v, i))
          );
        }
        default:
          break;
      }
      this._current_front += n_stored_points(verb);
      return this.next();
    } else if (
      this._first_position !== this._current_front &&
      this._first_verb !== this._last_verb
    ) {
      let from = this._first_position;
      this._first_position = this._current_front;
      let v = this._first_verb;
      this._first_verb = this._last_verb;
      return Some(
        new Subpath(
          this._points.slice(from, this._current_front),
          this._verbs.slice(v, this._last_verb)
        )
      );
    }
    return None();
  }

  public size_hint(): [number, Option<number>] {
    let n = this._verbs
      .iter()
      .filter((v: Verb) => v === Verb.MoveTo)
      .count();
    return [n, Some(n)];
  }

  // DoubleEndedIterator
  public next_back(): Option<Subpath> {
    let next = this._iter.next_back();
    if (next.is_some()) {
      let [i, verb] = next.unwrap();
      switch (verb) {
        case Verb.MoveTo: {
          let j = this._last_verb;
          this._last_verb = i;
          let to = this._last_position;
          this._last_position = this._current_back;
          let from = this._current_back;
          this._current_back -= n_stored_points(verb);
          return Some(new Subpath(this._points.slice(from, to), this._verbs.slice(i, j)));
        }
        default:
          break;
      }
      this._current_back -= n_stored_points(verb);
      return this.next_back();
    } else if (this._last_position !== this._current_back && this._last_verb !== this._first_verb) {
      let to = this._last_position;
      this._last_position = this._current_back;
      let v = this._last_verb;
      this._last_verb = this._first_verb;
      return Some(
        new Subpath(
          this._points.slice(this._current_back, to),
          this._verbs.slice(this._first_verb, v)
        )
      );
    }
    return None();
  }

  // Clone
  public clone(): this["Self"] {
    return new Subpaths(this._points, this._verbs);
  }

  // Debug
  public fmt_debug(): string {
    return format("Subpaths({:?},{:?})", this._points, this._verbs);
  }
}

/**
 * An iterator for Path and PathSlice
 */
export class PathIter extends PathEventIterator implements Clone, Debug {
  public Self!: PathIter;

  private _paths: Subpaths;
  private _current_front: Option<SubpathIter>;
  private _current_back: Option<SubpathIter>;

  public constructor(paths: Subpaths) {
    super();
    this._paths = paths;
    this._current_front = this._paths.next().map((p: Subpath) => p.iter());
    this._current_back = this._paths
      .next_back()
      .map_or(this._current_front, (p: Subpath) => Some(p.iter()));
  }

  public static new(points: Point[], verbs: Verb[]): PathIter {
    return new PathIter(new Subpaths(points, verbs));
  }

  // Iterator
  public Item!: PathEvent;

  public next(): Option<PathEvent> {
    return this._current_front.and_then((i: SubpathIter) =>
      i.next().or_else(() => {
        this._current_front = this._paths
          .next()
          .map_or(this._current_back, (p: Subpath) => Some(p.iter()));
        let next = this._current_front.and_then((i: SubpathIter) => i.next());
        if (next.is_none() && this._current_back === this._current_front) {
          this._current_front = None();
          this._current_back = None();
        }
        return next;
      })
    );
  }

  // DoubleEndedIterator
  public next_back(): Option<PathEvent> {
    return this._current_back.and_then((i: SubpathIter) =>
      i.next_back().or_else(() => {
        this._current_back = this._paths
          .next_back()
          .map_or(this._current_front, (p: Subpath) => Some(p.iter()));
        let next = this._current_back.and_then((i: SubpathIter) => i.next_back());
        if (next.is_none() && this._current_back === this._current_front) {
          this._current_front = None();
          this._current_back = None();
        }
        return next;
      })
    );
  }

  // Clone
  public clone(): this["Self"] {
    return new PathIter(this._paths.clone());
  }

  // Debug
  public fmt_debug(): string {
    return format("PathIter({:?})", this._paths);
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
// export type FlattenedPathBuilder = SvgPathBuilderAndBuild<
//   FlatteningBuilderAndBuild<PathObjectBuilder>
// >;
/**
 * FlattenedPathBuilder constructor
 */
// export function flattened_path_builder(tolerance: number): FlattenedPathBuilder {
//   return new SvgPathBuilderAndBuild(new FlatteningBuilderAndBuild(Path.builder(), tolerance));
// }

function nan_check(p: Point) {
  debug_assert(isFinite(p.x));
  debug_assert(isFinite(p.y));
}
