import { Self, Clone, Option, Some, None, Range, assert } from '@rusts/std'
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
} from './internal'

export abstract class Segment<U = any> extends Self {
  // Start of the curve
  public abstract from(): Point<U>

  // End of the curve
  public abstract to(): Point<U>

  // Sample the curve at t (expecting t between 0 and 1
  public abstract sample(t: Scalar): Point<U>

  // Sample x at t (expecting t between 0 and 1)
  public x(t: Scalar): Scalar {
    return this.sample(t).x
  }

  // Sample x at t (expecting t between 0 and 1)
  public y(t: Scalar): Scalar {
    return this.sample(t).x
  }

  // Sample derivative at t (expecting t between 0 and 1
  public abstract derivative(t: Scalar): Vector

  // Sample x derivative at t (expecting t between 0 and 1)
  public dx(t: Scalar): Scalar {
    return this.derivative(t).x
  }

  // Sample y derivative at t (expecting t between 0 and 1)
  public dy(t: Scalar): Scalar {
    return this.derivative(t).x
  }

  // Split the curve into two sub-curves
  public abstract split(t: Scalar): [this['Self'], this['Self']]

  // Return the curve before the split point
  public abstract before_split(t: Scalar): this['Self']

  // Return the curve after the split point
  public abstract after_split(t: Scalar): this['Self']

  // Return the curve inside a given range of t
  //
  // This is equivalent to splitting at the range's end points.
  public abstract split_range(t_range: Range): this['Self']

  // Swap the direction of the segment
  public abstract flip(): this['Self']

  // Compute the length of the segment using a flattened approximation
  public abstract approx_length(tolerance: Scalar): Scalar
}

export interface BoundingRect<U = any> {
  // Returns a rectangle that contains the curve
  bounding_rect(): Rect<U>

  // Returns a rectangle that contains the curve
  //
  // This does not necessarily return the smallest possible bounding rectangle
  fast_bounding_rect(): Rect<U>

  // Returns a range of x values that contain the curve.
  bounding_range_x(): [Scalar, Scalar]

  // Returns a range of y values that contain the curve.
  bounding_range_y(): [Scalar, Scalar]

  // Returns a range of x values that contain the curve.
  fast_bounding_range_x(): [Scalar, Scalar]

  // Returns a range of y values that contain the curve.
  fast_bounding_range_y(): [Scalar, Scalar]
}

// Types that implement callback based iteration
export abstract class SegmentFlattenedForEach<U = any> extends Segment<U> {
  // Iterates through the curve invoking the callback at each point
  public abstract for_each_flattened(tolerance: Scalar, callback: (point: Point<U>) => void): void
}

// Types that implement local flattening approximation at the start of the curve
export abstract class SegmentWithFlatteningStep<U = any> extends SegmentFlattenedForEach<U> {
  // Find the interval at the beginning of the curve that can be approximated
  // with a line segment
  public abstract flattening_step(tolerance: Scalar): Scalar

  // Returns the flattened representation of the curve as an iterator, starting
  // *after* the current point
  public flattened(tolerance: Scalar): Flattened<any> {
    return new Flattened(this, tolerance)
  }

  public for_each_flattened(tolerance: Scalar, callback: (point: Point<U>) => void) {
    do {
      let t = this.flattening_step(tolerance)
      if (t >= 1) {
        callback(this.to())
        break
      }
      let split = this.after_split(t)
      callback(split.from())
    } while (true)
  }
}

// An iterator over a generic curve segment that yields line segments
// approximating the curve for a given approximation threshold.
//
// The iterator starts at the first point *after* the origin of the curve and
// ends at the destination
export class Flattened<T extends SegmentWithFlatteningStep> {
  public curve: T
  public tolerance: Scalar
  public done: boolean

  public constructor(curve: T, tolerance: Scalar) {
    assert(tolerance > 0)
    this.curve = curve
    this.tolerance = tolerance
    this.done = false
  }

  public next(): Option<Point> {
    if (this.done) {
      return None()
    }
    let t = this.curve.flattening_step(this.tolerance)
    if (t >= 1) {
      this.done = true
      return Some(this.curve.to())
    }
    this.curve = this.curve.after_split(t) as T
    return Some(this.curve.from())
  }
}

export function approx_length_from_flattening<T extends SegmentFlattenedForEach>(
  curve: T,
  tolerance: Scalar
): Scalar {
  let start = curve.from()
  let len = 0
  curve.for_each_flattened(tolerance, (p: Point) => {
    len = len + p.sub(start).length()
    start = p
  })
  return len
}

enum BezierSegmentType {
  Linear = 'Linear',
  Quadratic = 'Quadratic',
  Cubic = 'Cubic'
}

type SegmentVariant<T, S> = { type: T; segment: S }

function create_bezier_segment<T extends BezierSegmentType, S>(
  type: T,
  segment: S
): SegmentVariant<T, S> {
  return { type, segment }
}

const BezierSegments = {
  Linear: (segment: LineSegment) => create_bezier_segment(BezierSegmentType.Linear, segment),
  Quadratic: (segment: QuadraticBezierSegment) =>
    create_bezier_segment(BezierSegmentType.Quadratic, segment),
  Cubic: (segment: CubicBezierSegment) => create_bezier_segment(BezierSegmentType.Cubic, segment)
}

type BezierSegmentSegment = ReturnType<typeof BezierSegments[keyof typeof BezierSegments]>

export class BezierSegment implements Clone {
  public Self!: BezierSegment

  public segment: BezierSegmentSegment

  private constructor(segment: BezierSegmentSegment) {
    this.segment = segment
  }

  public static linear(segment: LineSegment): BezierSegment {
    return new BezierSegment(BezierSegments.Linear(segment))
  }

  public static quadratic(segment: QuadraticBezierSegment): BezierSegment {
    return new BezierSegment(BezierSegments.Quadratic(segment))
  }

  public static cubic(segment: CubicBezierSegment): BezierSegment {
    return new BezierSegment(BezierSegments.Cubic(segment))
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return BezierSegment.linear(this.segment.segment.clone())
      case BezierSegmentType.Quadratic:
        return BezierSegment.quadratic(this.segment.segment.clone())
      case BezierSegmentType.Cubic:
        return BezierSegment.cubic(this.segment.segment.clone())
    }
  }

  public sample(t: Scalar): Point {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment.sample(t)
      case BezierSegmentType.Quadratic:
        return this.segment.segment.sample(t)
      case BezierSegmentType.Cubic:
        return this.segment.segment.sample(t)
    }
  }

  public from(): Point {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment.from()
      case BezierSegmentType.Quadratic:
        return this.segment.segment.from()
      case BezierSegmentType.Cubic:
        return this.segment.segment.from()
    }
  }

  public to(): Point {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment.to()
      case BezierSegmentType.Quadratic:
        return this.segment.segment.to()
      case BezierSegmentType.Cubic:
        return this.segment.segment.to()
    }
  }

  public is_linear(tolerance: Scalar): boolean {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return true
      case BezierSegmentType.Quadratic:
        return this.segment.segment.is_linear(tolerance)
      case BezierSegmentType.Cubic:
        return this.segment.segment.is_linear(tolerance)
    }
  }

  public baseline(): LineSegment {
    switch (this.segment.type) {
      case BezierSegmentType.Linear:
        return this.segment.segment
      case BezierSegmentType.Quadratic:
        return this.segment.segment.baseline()
      case BezierSegmentType.Cubic:
        return this.segment.segment.baseline()
    }
  }

  public split(t: Scalar): [this['Self'], this['Self']] {
    switch (this.segment.type) {
      case BezierSegmentType.Linear: {
        let [a, b] = this.segment.segment.split(t)
        return [BezierSegment.linear(a), BezierSegment.linear(b)]
      }
      case BezierSegmentType.Quadratic: {
        let [a, b] = this.segment.segment.split(t)
        return [BezierSegment.quadratic(a), BezierSegment.quadratic(b)]
      }
      case BezierSegmentType.Cubic: {
        let [a, b] = this.segment.segment.split(t)
        return [BezierSegment.cubic(a), BezierSegment.cubic(b)]
      }
    }
  }
}
