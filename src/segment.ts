import {
  Self,
  Clone,
  Option,
  Some,
  None,
  Range,
  assert,
  IteratorBase,
  abstract_panic
} from "@rusts/std";
import {
  // scalar.ts
  Scalar,
  // point.ts
  Point,
  // rect.ts
  Rect,
  // line.ts
  LineSegment,
  // vector.ts
  Vector,
  // cubic_bezier.ts
  CubicBezierSegment,
  // quadratic_bezier.ts
  QuadraticBezierSegment
} from "./internal";

export class Segment<U = any> extends Self {
  // Start of the curve
  public from(): Point<U> {
    abstract_panic("Segment", "from");
    // Unreachable
    return (undefined as unknown) as Point<U>;
  }

  // End of the curve
  public to(): Point<U> {
    abstract_panic("Segment", "to");
    // Unreachable
    return (undefined as unknown) as Point<U>;
  }

  // Sample the curve at t (expecting t between 0 and 1
  public sample(t: Scalar): Point<U> {
    abstract_panic("Segment", "sample");
    // Unreachable
    return (undefined as unknown) as Point<U>;
  }

  // Sample x at t (expecting t between 0 and 1)
  public x(t: Scalar): Scalar {
    return this.sample(t).x;
  }

  // Sample x at t (expecting t between 0 and 1)
  public y(t: Scalar): Scalar {
    return this.sample(t).x;
  }

  // Sample derivative at t (expecting t between 0 and 1
  public derivative(t: Scalar): Vector<U> {
    abstract_panic("Segment", "derivative");
    // Unreachable
    return (undefined as unknown) as Vector<U>;
  }

  // Sample x derivative at t (expecting t between 0 and 1)
  public dx(t: Scalar): Scalar {
    return this.derivative(t).x;
  }

  // Sample y derivative at t (expecting t between 0 and 1)
  public dy(t: Scalar): Scalar {
    return this.derivative(t).x;
  }

  // Split the curve into two sub-curves
  public split(t: Scalar): [this["Self"], this["Self"]] {
    abstract_panic("Segment", "split");
    // Unreachable
    return (undefined as unknown) as [this["Self"], this["Self"]];
  }

  // Return the curve before the split point
  public before_split(t: Scalar): this["Self"] {
    abstract_panic("Segment", "before_split");
    // Unreachable
    return (undefined as unknown) as this["Self"];
  }

  // Return the curve after the split point
  public after_split(t: Scalar): this["Self"] {
    abstract_panic("Segment", "after_split");
    // Unreachable
    return (undefined as unknown) as this["Self"];
  }

  // Return the curve inside a given range of t
  //
  // This is equivalent to splitting at the range's end points.
  public split_range(t_range: Range<number>): this["Self"] {
    abstract_panic("Segment", "split_range");
    // Unreachable
    return (undefined as unknown) as this["Self"];
  }

  // Swap the direction of the segment
  public flip(): this["Self"] {
    abstract_panic("Segment", "flip");
    // Unreachable
    return (undefined as unknown) as this["Self"];
  }

  // Compute the length of the segment using a flattened approximation
  public approx_length(tolerance: Scalar): Scalar {
    abstract_panic("Segment", "approx_length");
    // Unreachable
    return (undefined as unknown) as Scalar;
  }
}

export interface BoundingRect<U = any> {
  // Returns a rectangle that contains the curve
  bounding_rect(): Rect<U>;

  // Returns a rectangle that contains the curve
  //
  // This does not necessarily return the smallest possible bounding rectangle
  fast_bounding_rect(): Rect<U>;

  // Returns a range of x values that contain the curve.
  bounding_range_x(): [Scalar, Scalar];

  // Returns a range of y values that contain the curve.
  bounding_range_y(): [Scalar, Scalar];

  // Returns a range of x values that contain the curve.
  fast_bounding_range_x(): [Scalar, Scalar];

  // Returns a range of y values that contain the curve.
  fast_bounding_range_y(): [Scalar, Scalar];
}

// Types that implement callback based iteration
export class SegmentFlattenedForEach<U = any> extends Segment<U> {
  // Iterates through the curve invoking the callback at each point
  public for_each_flattened(tolerance: Scalar, callback: (point: Point<U>) => void): void {
    abstract_panic("SegmentFlattenedForEach", "for_each_flattened");
  }
}

// Types that implement local flattening approximation at the start of the curve
export class SegmentWithFlatteningStep<U = any> extends SegmentFlattenedForEach<U> {
  // Find the interval at the beginning of the curve that can be approximated
  // with a line segment
  public flattening_step(tolerance: Scalar): Scalar {
    abstract_panic("SegmentWithFlatteningStep", "flattening_step");
    // Unreachable
    return (undefined as unknown) as Scalar;
  }

  // Returns the flattened representation of the curve as an iterator, starting
  // *after* the current point
  public flattened(tolerance: Scalar): Flattened<any> {
    return new Flattened(this, tolerance);
  }

  public for_each_flattened(tolerance: Scalar, callback: (point: Point<U>) => void) {
    do {
      let t = this.flattening_step(tolerance);
      if (t >= 1) {
        callback(this.to());
        break;
      }
      let split = this.after_split(t);
      callback(split.from());
    } while (true);
  }
}

// An iterator over a generic curve segment that yields line segments
// approximating the curve for a given approximation threshold.
//
// The iterator starts at the first point *after* the origin of the curve and
// ends at the destination
export class Flattened<T extends SegmentWithFlatteningStep> extends IteratorBase<Point> {
  public curve: T;
  public tolerance: Scalar;
  public done: boolean;

  public constructor(curve: T, tolerance: Scalar) {
    super();
    assert(tolerance > 0);
    this.curve = curve;
    this.tolerance = tolerance;
    this.done = false;
  }

  // Iterator
  public Item!: Point;

  public next(): Option<this["Item"]> {
    if (this.done) {
      return None();
    }
    let t = this.curve.flattening_step(this.tolerance);
    if (t >= 1) {
      this.done = true;
      return Some(this.curve.to());
    }
    this.curve = this.curve.after_split(t) as T;
    return Some(this.curve.from());
  }
}

export function approx_length_from_flattening<T extends SegmentFlattenedForEach>(
  curve: T,
  tolerance: Scalar
): Scalar {
  let start = curve.from();
  let len = 0;
  curve.for_each_flattened(tolerance, (p: Point) => {
    len = len + p.sub(start).length();
    start = p;
  });
  return len;
}

enum BezierSegmentType {
  Linear = "Linear",
  Quadratic = "Quadratic",
  Cubic = "Cubic"
}

type SegmentVariant<T, S> = { type: T; segment: S };

function create_bezier_segment<T extends BezierSegmentType, S>(
  type: T,
  segment: S
): SegmentVariant<T, S> {
  return { type, segment };
}

const BezierSegments = {
  Linear: (segment: LineSegment) => create_bezier_segment(BezierSegmentType.Linear, segment),
  Quadratic: (segment: QuadraticBezierSegment) =>
    create_bezier_segment(BezierSegmentType.Quadratic, segment),
  Cubic: (segment: CubicBezierSegment) => create_bezier_segment(BezierSegmentType.Cubic, segment)
};

type BezierSegmentSegment = ReturnType<typeof BezierSegments[keyof typeof BezierSegments]>;

export class BezierSegment<U = any> implements Clone {
  public Self!: BezierSegment<U>;
  public _unit!: U;

  public segment: BezierSegmentSegment;

  private constructor(segment: BezierSegmentSegment) {
    this.segment = segment;
  }

  public static Linear<U = any>(segment: LineSegment<U>): BezierSegment<U> {
    return new BezierSegment(BezierSegments.Linear(segment));
  }

  public static Quadratic<U = any>(segment: QuadraticBezierSegment<U>): BezierSegment<U> {
    return new BezierSegment(BezierSegments.Quadratic(segment));
  }

  public static Cubic<U = any>(segment: CubicBezierSegment<U>): BezierSegment<U> {
    return new BezierSegment(BezierSegments.Cubic(segment));
  }

  // Clone
  public clone(): this["Self"] {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return BezierSegment.Linear(this.segment.segment.clone());
      case BezierSegmentType.Quadratic:
        return BezierSegment.Quadratic(this.segment.segment.clone());
      case BezierSegmentType.Cubic:
        return BezierSegment.Cubic(this.segment.segment.clone());
    }
  }

  public sample(t: Scalar): Point {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment.sample(t);
      case BezierSegmentType.Quadratic:
        return this.segment.segment.sample(t);
      case BezierSegmentType.Cubic:
        return this.segment.segment.sample(t);
    }
  }

  public from(): Point {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment.from();
      case BezierSegmentType.Quadratic:
        return this.segment.segment.from();
      case BezierSegmentType.Cubic:
        return this.segment.segment.from();
    }
  }

  public to(): Point {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment.to();
      case BezierSegmentType.Quadratic:
        return this.segment.segment.to();
      case BezierSegmentType.Cubic:
        return this.segment.segment.to();
    }
  }

  public is_linear(tolerance: Scalar): boolean {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return true;
      case BezierSegmentType.Quadratic:
        return this.segment.segment.is_linear(tolerance);
      case BezierSegmentType.Cubic:
        return this.segment.segment.is_linear(tolerance);
    }
  }

  public baseline(): LineSegment<U> {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment;
      case BezierSegmentType.Quadratic:
        return this.segment.segment.baseline();
      case BezierSegmentType.Cubic:
        return this.segment.segment.baseline();
    }
  }

  public split(t: Scalar): [this["Self"], this["Self"]] {
    switch (this.segment.type) {
      case BezierSegmentType.Linear: {
        let [a, b] = this.segment.segment.split(t);
        return [BezierSegment.Linear(a), BezierSegment.Linear(b)];
      }
      case BezierSegmentType.Quadratic: {
        let [a, b] = this.segment.segment.split(t);
        return [BezierSegment.Quadratic(a), BezierSegment.Quadratic(b)];
      }
      case BezierSegmentType.Cubic: {
        let [a, b] = this.segment.segment.split(t);
        return [BezierSegment.Cubic(a), BezierSegment.Cubic(b)];
      }
    }
  }
}
