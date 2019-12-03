import {
  Self,
  Clone,
  Debug,
  format,
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

  // Returns whether this segment is degenerate.
  public is_degenerate(tolerance: Scalar): boolean {
    abstract_panic("Segment", "is_degenerate");
    // Unreachable
    return false;
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

  // DoubleEndedIterator
  // public next_back(): Option<this["Item"]> {
  //   if (this.done) {
  //     return None();
  //   }
  //   let flipped_curve = this.curve.flip();
  //   let t = flipped_curve.flattening_step(this.tolerance);
  //   if (t >= 1) {
  //     this.done = true;
  //     return Some(flipped_curve.to());
  //   }
  //   this.curve = flipped_curve.after_split(t).flip() as T;
  //   return Some(this.curve.from());
  // }
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

export enum BezierSegmentType {
  Linear = "Linear",
  Quadratic = "Quadratic",
  Cubic = "Cubic"
}

type SegmentVariant<T, V> = { type: T; value: V };

function create_bezier_segment<T extends BezierSegmentType, V>(
  type: T,
  value: V
): SegmentVariant<T, V> {
  return { type, value };
}

const BezierSegmentPayloads = {
  Linear: (segment: LineSegment) => create_bezier_segment(BezierSegmentType.Linear, segment),
  Quadratic: (segment: QuadraticBezierSegment) =>
    create_bezier_segment(BezierSegmentType.Quadratic, segment),
  Cubic: (segment: CubicBezierSegment) => create_bezier_segment(BezierSegmentType.Cubic, segment)
};

export type BezierSegmentPayload = ReturnType<
  typeof BezierSegmentPayloads[keyof typeof BezierSegmentPayloads]
>;

export class BezierSegment<U = any> extends Segment implements BoundingRect, Clone, Debug {
  public Self!: BezierSegment<U>;
  public _unit!: U;

  public payload: BezierSegmentPayload;

  private constructor(payload: BezierSegmentPayload) {
    super();
    this.payload = payload;
  }

  public static Linear<U = any>(segment: LineSegment<U>): BezierSegment<U> {
    return new BezierSegment(BezierSegmentPayloads.Linear(segment));
  }

  public static Quadratic<U = any>(segment: QuadraticBezierSegment<U>): BezierSegment<U> {
    return new BezierSegment(BezierSegmentPayloads.Quadratic(segment));
  }

  public static Cubic<U = any>(segment: CubicBezierSegment<U>): BezierSegment<U> {
    return new BezierSegment(BezierSegmentPayloads.Cubic(segment));
  }

  public match(): BezierSegmentPayload {
    return this.payload;
  }

  public linear(): LineSegment<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value;
      case BezierSegmentType.Quadratic:
        throw new Error("called `BezierSegment.linear()` on a `Quadratic` value");
      case BezierSegmentType.Cubic:
        throw new Error("called `BezierSegment.linear()` on a `Cubic` value");
    }
  }

  public quadratic(): QuadraticBezierSegment<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        throw new Error("called `BezierSegment.quadratic()` on a `Linear` value");
      case BezierSegmentType.Quadratic:
        return this.payload.value;
      case BezierSegmentType.Cubic:
        throw new Error("called `BezierSegment.quadratic()` on a `Cubic` value");
    }
  }

  public cubic(): CubicBezierSegment<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        throw new Error("called `BezierSegment.cubic()` on a `Linear` value");
      case BezierSegmentType.Quadratic:
        throw new Error("called `BezierSegment.cubic()` on a `Quadratic` value");
      case BezierSegmentType.Cubic:
        return this.payload.value;
    }
  }

  // Segment
  public from(): Point {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.from();
      case BezierSegmentType.Quadratic:
        return this.payload.value.from();
      case BezierSegmentType.Cubic:
        return this.payload.value.from();
    }
  }

  public to(): Point {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.to();
      case BezierSegmentType.Quadratic:
        return this.payload.value.to();
      case BezierSegmentType.Cubic:
        return this.payload.value.to();
    }
  }

  public sample(t: Scalar): Point {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.sample(t);
      case BezierSegmentType.Quadratic:
        return this.payload.value.sample(t);
      case BezierSegmentType.Cubic:
        return this.payload.value.sample(t);
    }
  }

  public x(t: Scalar): Scalar {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.x(t);
      case BezierSegmentType.Quadratic:
        return this.payload.value.x(t);
      case BezierSegmentType.Cubic:
        return this.payload.value.x(t);
    }
  }

  public y(t: Scalar): Scalar {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.y(t);
      case BezierSegmentType.Quadratic:
        return this.payload.value.y(t);
      case BezierSegmentType.Cubic:
        return this.payload.value.y(t);
    }
  }

  // Sample derivative at t (expecting t between 0 and 1
  public derivative(t: Scalar): Vector<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.derivative(t);
      case BezierSegmentType.Quadratic:
        return this.payload.value.derivative(t);
      case BezierSegmentType.Cubic:
        return this.payload.value.derivative(t);
    }
  }

  // Sample x derivative at t (expecting t between 0 and 1)
  public dx(t: Scalar): Scalar {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.dx(t);
      case BezierSegmentType.Quadratic:
        return this.payload.value.dx(t);
      case BezierSegmentType.Cubic:
        return this.payload.value.dx(t);
    }
  }

  // Sample y derivative at t (expecting t between 0 and 1)
  public dy(t: Scalar): Scalar {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.dy(t);
      case BezierSegmentType.Quadratic:
        return this.payload.value.dy(t);
      case BezierSegmentType.Cubic:
        return this.payload.value.dy(t);
    }
  }

  public split(t: Scalar): [this["Self"], this["Self"]] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear: {
        let [a, b] = this.payload.value.split(t);
        return [BezierSegment.Linear(a), BezierSegment.Linear(b)];
      }
      case BezierSegmentType.Quadratic: {
        let [a, b] = this.payload.value.split(t);
        return [BezierSegment.Quadratic(a), BezierSegment.Quadratic(b)];
      }
      case BezierSegmentType.Cubic: {
        let [a, b] = this.payload.value.split(t);
        return [BezierSegment.Cubic(a), BezierSegment.Cubic(b)];
      }
    }
  }

  public before_split(t: Scalar): this["Self"] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear: {
        let a = this.payload.value.before_split(t);
        return BezierSegment.Linear(a);
      }
      case BezierSegmentType.Quadratic: {
        let a = this.payload.value.before_split(t);
        return BezierSegment.Quadratic(a);
      }
      case BezierSegmentType.Cubic: {
        let a = this.payload.value.before_split(t);
        return BezierSegment.Cubic(a);
      }
    }
  }

  public after_split(t: Scalar): this["Self"] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear: {
        let a = this.payload.value.after_split(t);
        return BezierSegment.Linear(a);
      }
      case BezierSegmentType.Quadratic: {
        let a = this.payload.value.after_split(t);
        return BezierSegment.Quadratic(a);
      }
      case BezierSegmentType.Cubic: {
        let a = this.payload.value.after_split(t);
        return BezierSegment.Cubic(a);
      }
    }
  }

  public split_range(t_range: Range<number>): this["Self"] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear: {
        let a = this.payload.value.split_range(t_range);
        return BezierSegment.Linear(a);
      }
      case BezierSegmentType.Quadratic: {
        let a = this.payload.value.split_range(t_range);
        return BezierSegment.Quadratic(a);
      }
      case BezierSegmentType.Cubic: {
        let a = this.payload.value.split_range(t_range);
        return BezierSegment.Cubic(a);
      }
    }
  }

  public flip(): this["Self"] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear: {
        let a = this.payload.value.flip();
        return BezierSegment.Linear(a);
      }
      case BezierSegmentType.Quadratic: {
        let a = this.payload.value.flip();
        return BezierSegment.Quadratic(a);
      }
      case BezierSegmentType.Cubic: {
        let a = this.payload.value.flip();
        return BezierSegment.Cubic(a);
      }
    }
  }

  public approx_length(tolerance: Scalar): Scalar {
    switch (this.payload.type) {
      case BezierSegmentType.Linear: {
        return this.payload.value.approx_length(tolerance);
      }
      case BezierSegmentType.Quadratic: {
        return this.payload.value.approx_length(tolerance);
      }
      case BezierSegmentType.Cubic: {
        return this.payload.value.approx_length(tolerance);
      }
    }
  }

  public is_degenerate(tolerance: Scalar): boolean {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.is_degenerate(tolerance);
      case BezierSegmentType.Quadratic:
        return this.payload.value.is_degenerate(tolerance);
      case BezierSegmentType.Cubic:
        return this.payload.value.is_degenerate(tolerance);
    }
  }

  public is_linear(tolerance: Scalar): boolean {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return true;
      case BezierSegmentType.Quadratic:
        return this.payload.value.is_linear(tolerance);
      case BezierSegmentType.Cubic:
        return this.payload.value.is_linear(tolerance);
    }
  }

  public baseline(): LineSegment<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value;
      case BezierSegmentType.Quadratic:
        return this.payload.value.baseline();
      case BezierSegmentType.Cubic:
        return this.payload.value.baseline();
    }
  }

  // BoundingRect
  public bounding_rect(): Rect<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.bounding_rect();
      case BezierSegmentType.Quadratic:
        return this.payload.value.bounding_rect();
      case BezierSegmentType.Cubic:
        return this.payload.value.bounding_rect();
    }
  }

  public fast_bounding_rect(): Rect<U> {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.fast_bounding_rect();
      case BezierSegmentType.Quadratic:
        return this.payload.value.fast_bounding_rect();
      case BezierSegmentType.Cubic:
        return this.payload.value.fast_bounding_rect();
    }
  }

  public bounding_range_x(): [Scalar, Scalar] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.bounding_range_x();
      case BezierSegmentType.Quadratic:
        return this.payload.value.bounding_range_x();
      case BezierSegmentType.Cubic:
        return this.payload.value.bounding_range_x();
    }
  }

  public bounding_range_y(): [Scalar, Scalar] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.bounding_range_y();
      case BezierSegmentType.Quadratic:
        return this.payload.value.bounding_range_y();
      case BezierSegmentType.Cubic:
        return this.payload.value.bounding_range_y();
    }
  }

  public fast_bounding_range_x(): [Scalar, Scalar] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.fast_bounding_range_x();
      case BezierSegmentType.Quadratic:
        return this.payload.value.fast_bounding_range_x();
      case BezierSegmentType.Cubic:
        return this.payload.value.fast_bounding_range_x();
    }
  }

  public fast_bounding_range_y(): [Scalar, Scalar] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return this.payload.value.fast_bounding_range_y();
      case BezierSegmentType.Quadratic:
        return this.payload.value.fast_bounding_range_y();
      case BezierSegmentType.Cubic:
        return this.payload.value.fast_bounding_range_y();
    }
  }

  // Clone
  public clone(): this["Self"] {
    switch (this.payload.type) {
      case BezierSegmentType.Linear:
        return BezierSegment.Linear(this.payload.value.clone());
      case BezierSegmentType.Quadratic:
        return BezierSegment.Quadratic(this.payload.value.clone());
      case BezierSegmentType.Cubic:
        return BezierSegment.Cubic(this.payload.value.clone());
    }
  }

  // Debug
  public fmt_debug(): string {
    return format(`BezierSegment.${this.payload.type}({:?})`, this.payload.value);
  }
}
