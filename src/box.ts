import {
  Self,
  Clone,
  clone,
  Debug,
  Display,
  format,
  Option,
  Some,
  None,
  ImplEq,
  ImplPartialEq,
  eq,
  min,
  max
} from "@rusts/std";
import {
  // scalar.ts
  Scalar,
  // nonempty.ts
  NonEmptyBox2D,
  // point.ts
  Point2D,
  point2,
  // rect.ts
  Rect,
  // scale.ts
  Scale,
  // side_offsets.ts
  SideOffsets2D,
  // size.ts
  Size2D,
  // vector.ts
  Vector2D,
  vec2
} from "./internal";

export class Box2D<U = any> extends ImplEq(ImplPartialEq(Self)) implements Clone, Debug, Display {
  public Self!: Box2D<U>;

  public min: Point2D<U>;
  public max: Point2D<U>;
  public _unit!: U;

  constructor(min: Point2D<U>, max: Point2D<U>) {
    super();
    this.min = min;
    this.max = max;
  }

  // Clone
  public clone(): Box2D<U> {
    return new Box2D(this.min.clone(), this.max.clone());
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return this.min.eq(other.min) && this.max.eq(other.max);
  }

  // Debug
  public fmt_debug(): string {
    return format("Box2D({:?},{:?})", this.min, this.max);
  }

  // Display
  public fmt_display(): string {
    return format("Box2D({},{})", this.min, this.max);
  }

  public static default<U>(): Box2D<U> {
    return new Box2D(Point2D.default(), Point2D.default());
  }

  public static zero<U>(): Box2D<U> {
    return new Box2D(Point2D.zero(), Point2D.zero());
  }

  public static from_points<U>(points: Point2D<U>[]): Box2D<U> {
    if (points.length < 2) {
      return Box2D.zero();
    }
    let min_x = points[0].x;
    let min_y = points[0].y;
    let max_x = min_x;
    let max_y = min_y;

    for (let p of points) {
      if (p.x < min_x) {
        min_x = p.x;
      }
      if (p.x > max_x) {
        max_x = p.x;
      }
      if (p.y < min_y) {
        min_y = p.y;
      }
      if (p.y > max_y) {
        max_y = p.y;
      }
    }

    return new Box2D(point2(min_x, min_y), point2(max_x, max_y));
  }

  public static from_size<U>(size: Size2D<U>): Box2D<U> {
    let zero = Point2D.zero();
    let point = size.to_point();
    return Box2D.from_points([zero, point]);
  }

  public is_negative(): boolean {
    return this.max.x < this.min.x || this.max.y < this.min.y;
  }

  public is_empty_or_negative(): boolean {
    return this.max.x <= this.min.x || this.max.y <= this.min.y;
  }

  public to_non_empty(): Option<NonEmptyBox2D<U>> {
    if (this.is_empty_or_negative()) {
      return None();
    }

    return Some(new NonEmptyBox2D(this));
  }

  public intersects(other: Box2D<U>): boolean {
    return (
      this.min.x < other.max.x &&
      this.max.x > other.min.x &&
      this.min.y < other.max.y &&
      this.max.y > other.min.y
    );
  }

  public intersection(other: Box2D<U>): Box2D<U> {
    return new Box2D(
      point2(max(this.min.x, other.min.x), max(this.min.y, other.min.y)),
      point2(min(this.max.x, other.max.x), min(this.max.y, other.max.y))
    );
  }

  public try_intersection(other: Box2D<U>): Option<NonEmptyBox2D<U>> {
    let intersection = this.intersection(other);

    if (intersection.is_negative()) {
      return None();
    }

    return Some(new NonEmptyBox2D(intersection));
  }

  public translate(by: Vector2D<U>): Box2D<U> {
    return new Box2D(this.min.add(by), this.max.add(by));
  }

  public contains(p: Point2D<U>): boolean {
    return this.min.x <= p.x && p.x < this.max.x && this.min.y <= p.y && p.y < this.max.y;
  }

  public contains_box(other: Box2D<U>): boolean {
    return (
      other.is_empty_or_negative() ||
      (this.min.x <= other.min.x &&
        other.max.x <= this.max.x &&
        this.min.y <= other.min.y &&
        other.max.y <= this.max.y)
    );
  }

  public size(): Size2D<U> {
    return this.max.sub(this.min).to_size();
  }

  public to_rect(): Rect {
    return new Rect(this.min, this.size());
  }

  public inflate(width: Scalar, height: Scalar): Box2D<U> {
    return new Box2D(
      point2(this.min.x - width, this.min.y - height),
      point2(this.max.x + width, this.max.y + height)
    );
  }

  public inner_box(offsets: SideOffsets2D): Box2D<U> {
    return new Box2D(
      this.min.add(vec2(offsets.left, offsets.top)),
      this.max.sub(vec2(offsets.right, offsets.bottom))
    );
  }

  public outer_box(offsets: SideOffsets2D): Box2D<U> {
    return new Box2D(
      this.min.sub(vec2(offsets.left, offsets.top)),
      this.max.add(vec2(offsets.right, offsets.bottom))
    );
  }

  public lerp(other: Box2D<U>, t: Scalar): Box2D<U> {
    return new Box2D(this.min.lerp(other.min, t), this.max.lerp(other.max, t));
  }

  public center(): Point2D<U> {
    return this.min.add(this.max.to_vector()).div_assign(2);
  }

  public union(other: Box2D<U>): Box2D<U> {
    return new Box2D(
      point2(min(this.min.x, other.min.x), min(this.min.y, other.min.y)),
      point2(max(this.max.x, other.max.x), max(this.max.y, other.max.y))
    );
  }

  public scale(x: Scalar, y: Scalar): Box2D<U> {
    return new Box2D(
      point2(this.min.x * x, this.min.y * y),
      point2(this.max.x * x, this.max.y * y)
    );
  }

  public area(): Scalar {
    let size = this.size();
    return size.width * size.height;
  }

  public is_empty(): boolean {
    return this.min.x === this.max.x || this.min.y === this.max.y;
  }

  public div<U1, U2>(scale: Scale<U1, U2>): Box2D<U2>;
  public div(scale: Scalar): Box2D<U>;
  public div(scale: any): Box2D<any> {
    return new Box2D(this.min.div(scale), this.max.div(scale));
  }

  public mul<U1, U2>(scale: Scale<U1, U2>): Box2D<U2>;
  public mul(scale: Scalar): Box2D<U>;
  public mul(scale: any): Box2D<any> {
    return new Box2D(this.min.mul(scale), this.max.mul(scale));
  }

  // Drop the units, preserving only the numeric value.
  public to_untyped(): Box2D<any> {
    return new Box2D(this.min, this.max);
  }

  // Tag a unit-less value with units.
  public static from_untyped<V>(b: Box2D<any>): Box2D<V> {
    return new Box2D(Point2D.from_untyped(b.min), Point2D.from_untyped(b.max));
  }

  // Cast the unit
  public cast_unit<V>(): Box2D<V> {
    return new Box2D(this.min.cast_unit<V>(), this.max.cast_unit<V>());
  }

  public round(): Box2D<U> {
    return new Box2D(this.min.round(), this.max.round());
  }

  public round_in(): Box2D<U> {
    return new Box2D(this.min.ceil(), this.max.floor());
  }

  public round_out(): Box2D<U> {
    return new Box2D(this.min.floor(), this.max.ceil());
  }
}

export function box2<U>(min: Point2D<U>, max: Point2D<U>): Box2D<U> {
  return new Box2D(min, max);
}
