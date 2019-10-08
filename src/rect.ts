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
  max,
  Range,
  range
} from '@rusts/std'
import {
  // box.ts
  Box2D,
  box2,
  // scalar.ts
  Scalar,
  // nonempty.ts
  NonEmptyRect,
  // point.ts
  Point2D,
  point2,
  // scale.ts
  Scale,
  // side_offsets.ts
  SideOffsets2D,
  // size.ts
  Size2D,
  size2,
  // vector.ts
  Vector2D
} from './internal'

export class Rect<U = any> extends ImplEq(ImplPartialEq(Self)) implements Clone, Debug, Display {
  public Self!: Rect<U>

  public origin: Point2D<U>
  public size: Size2D<U>
  public _unit!: U

  public constructor(origin: Point2D<U>, size: Size2D<U>) {
    super()
    this.origin = origin
    this.size = size
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    return new Rect(this.origin.clone(), this.size.clone())
  }

  // PartialEq
  public eq(other: this['Self']): boolean {
    return this.origin.eq(other.origin) && this.size.eq(other.size)
  }

  // Display
  public fmt_display(): string {
    return format('Rect({} at {})', this.size, this.origin)
  }

  // Debug
  public fmt_debug(): string {
    return format('Rect({:?} at {:?})', this.size, this.origin)
  }

  // Default
  public static default<U>(): Rect<U> {
    return new Rect(Point2D.default(), Size2D.default())
  }

  // Zero
  public static zero<U>(): Rect<U> {
    return new Rect(Point2D.zero(), Size2D.zero())
  }

  public static from_size<U>(size: Size2D<U>): Rect<U> {
    return new Rect(Point2D.origin(), size)
  }

  public static from_points<U>(points: Point2D<U>[]): Rect<U> {
    if (points.length < 2) {
      return Rect.zero()
    }
    let min_x = points[0].x
    let min_y = points[0].y
    let max_x = min_x
    let max_y = min_y

    for (let p of points) {
      if (p.x < min_x) {
        min_x = p.x
      }
      if (p.x > max_x) {
        max_x = p.x
      }
      if (p.y < min_y) {
        min_y = p.y
      }
      if (p.y > max_y) {
        max_y = p.y
      }
    }

    return new Rect(point2(min_x, min_y), size2(max_x - min_x, max_y - min_y))
  }

  public min(): Point2D<U> {
    return this.origin
  }

  public max(): Point2D<U> {
    return this.origin.add_size(this.size)
  }

  public max_x(): Scalar {
    return this.origin.x + this.size.width
  }

  public min_x(): Scalar {
    return this.origin.x
  }

  public max_y(): Scalar {
    return this.origin.y + this.size.height
  }

  public min_y(): Scalar {
    return this.origin.y
  }

  public x_range(): Range {
    return range(this.min_x(), this.max_x())
  }

  public y_range(): Range {
    return range(this.min_y(), this.max_y())
  }

  public to_non_empty(): Option<NonEmptyRect> {
    if (this.is_empty_or_negative()) {
      return None()
    }

    return Some(new NonEmptyRect(this))
  }

  public intersects(other: this['Self']): boolean {
    return (
      this.origin.x < other.origin.x + other.size.width &&
      other.origin.x < this.origin.x + this.size.width &&
      this.origin.y < other.origin.y + other.size.height &&
      other.origin.y < this.origin.y + this.size.height
    )
  }

  public intersection(other: Rect): Option<this['Self']> {
    if (!this.intersects(other)) {
      return None()
    }

    let upper_left = point2(max(this.min_x(), other.min_x()), max(this.min_y(), other.min_y()))

    let lower_right_x = min(this.max_x(), other.max_x())
    let lower_right_y = min(this.max_y(), other.max_y())

    return Some(
      new Rect(upper_left, size2(lower_right_x - upper_left.x, lower_right_y - upper_left.y))
    )
  }

  public translate(by: Vector2D<U>): this['Self'] {
    return new Rect(this.origin.add(by), this.size.clone())
  }

  public contains(p: Point2D<U>): boolean {
    return (
      this.origin.x <= p.x &&
      p.x < this.origin.x + this.size.width &&
      this.origin.y <= p.y &&
      p.y < this.origin.y + this.size.height
    )
  }

  public contains_rect(other: this['Self']): boolean {
    return (
      other.is_empty_or_negative() ||
      (this.min_x() <= other.min_x() &&
        other.max_x() <= this.max_x() &&
        this.min_y() <= other.min_y() &&
        other.max_y() <= this.max_y())
    )
  }

  public to_box2d(): Box2D<U> {
    return box2(this.min(), this.max())
  }

  public inflate(width: Scalar, height: Scalar): this['Self'] {
    return new Rect(
      point2(this.origin.x - width, this.origin.y - height),
      size2(this.size.width + width + width, this.size.height + height + height)
    )
  }

  public top_right(): Point2D<U> {
    return point2(this.max_x(), this.origin.y)
  }

  public bottom_left(): Point2D<U> {
    return point2(this.origin.x, this.max_y())
  }

  public bottom_right(): Point2D<U> {
    return point2(this.max_x(), this.max_y())
  }

  public inner_rect(offsets: SideOffsets2D): this['Self'] {
    let r = new Rect(
      point2(this.origin.x + offsets.left, this.origin.y + offsets.top),
      size2(this.size.width - offsets.horizontal(), this.size.height - offsets.vertical())
    )
    return r
  }

  public outer_rect(offsets: SideOffsets2D): this['Self'] {
    let r = new Rect(
      point2(this.origin.x - offsets.left, this.origin.y - offsets.top),
      size2(this.size.width + offsets.horizontal(), this.size.height + offsets.vertical())
    )
    return r
  }

  public lerp(other: this['Self'], t: Scalar): this['Self'] {
    return new Rect(this.origin.lerp(other.origin, t), this.size.lerp(other.size, t))
  }

  public center(): Point2D<U> {
    return this.origin.add(this.size.to_vector().div_assign(2))
  }

  public union(other: Rect): this['Self'] {
    if (this.size.is_zero()) {
      return other
    }
    if (other.size.is_zero()) {
      return this
    }

    let upper_left = point2(min(this.min_x(), other.min_x()), min(this.min_y(), other.min_y()))

    let lower_right_x = max(this.max_x(), other.max_x())
    let lower_right_y = max(this.max_y(), other.max_y())

    return new Rect(upper_left, size2(lower_right_x - upper_left.x, lower_right_y - upper_left.y))
  }

  public scale(x: Scalar, y: Scalar): this['Self'] {
    return new Rect(
      point2(this.origin.x * x, this.origin.y * y),
      size2(this.size.width * x, this.size.height * y)
    )
  }

  public area(): Scalar {
    return this.size.area()
  }

  public is_empty(): boolean {
    return this.size.width === 0 || this.size.height === 0
  }

  public is_empty_or_negative(): boolean {
    return this.size.is_empty_or_negative()
  }

  public mul<U1, U2>(scale: Scale<U1, U2>): Rect<U2>
  public mul(scale: Scalar): this['Self']
  public mul(scale: any): Rect<any> {
    return new Rect(this.origin.mul(scale), this.size.mul(scale))
  }

  public div<U1, U2>(scale: Scale<U1, U2>): Rect<U2>
  public div(scale: Scalar): this['Self']
  public div(scale: any): Rect<any> {
    return new Rect(this.origin.div(scale), this.size.div(scale))
  }

  // Drop the units, preserving only the numeric value.
  public to_untyped(): Rect<any> {
    return new Rect(this.origin.to_untyped(), this.size.to_untyped())
  }

  // Tag a unit-less value with units.
  public static from_untyped<V>(r: Rect<any>): Rect<V> {
    return new Rect(Point2D.from_untyped(r.origin), Size2D.from_untyped(r.size))
  }

  // Cast the unit
  public cast_unit<V>(): Rect<V> {
    return new Rect(this.origin.cast_unit<V>(), this.size.cast_unit<V>())
  }

  public round(): this['Self'] {
    let origin = this.origin.round()
    let size = this.origin
      .add_size(this.size)
      .round()
      .sub(origin)
    return new Rect(origin, size2(size.x, size.y))
  }

  public round_in(): this['Self'] {
    let origin = this.origin.ceil()
    let size = this.origin
      .add_size(this.size)
      .floor()
      .sub(origin)
    return new Rect(origin, size2(size.x, size.y))
  }

  public round_out(): this['Self'] {
    let origin = this.origin.floor()
    let size = this.origin
      .add_size(this.size)
      .ceil()
      .sub(origin)
    return new Rect(origin, size2(size.x, size.y))
  }
}

export function rect<U = any>(x: Scalar, y: Scalar, w: Scalar, h: Scalar): Rect<U> {
  return new Rect(point2(x, y), size2(w, h))
}
