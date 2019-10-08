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
  ImplOrd,
  ImplPartialOrd,
  Ordering,
  Less,
  Equal,
  Greater,
  cmp,
  maxnum,
  minnum
} from '@rusts/std'
import {
  // scalar.ts
  Scalar,
  EPSILON,
  approx_eq,
  approx_eq_eps,
  // scale.ts
  Scale,
  // size.ts
  Size2D,
  size2,
  // vector.ts
  Vector2D,
  vec2
} from './internal'

export class Point2D<U = any> extends ImplOrd(ImplPartialOrd(ImplEq(ImplPartialEq(Self))))
  implements Clone, Debug, Display {
  public Self!: Point2D<U>

  public x: Scalar
  public y: Scalar
  public _unit!: U

  public constructor(x: Scalar, y: Scalar) {
    super()
    this.x = x
    this.y = y
  }

  public static origin<U = any>(): Point2D<U> {
    return new Point2D(0, 0)
  }

  public static default<U = any>(): Point2D<U> {
    return Point2D.origin()
  }

  public static zero<U = any>(): Point2D<U> {
    return Point2D.origin()
  }

  public static from_array<U>(array: Scalar[]): Point2D<U> {
    if (array.length != 2) {
      throw new Error(
        `Point2D.from_array: array ${array} length ${array.length} is not of length 2`
      )
    }
    return new Point2D(array[0], array[1])
  }

  public static from_tuple<U>(tuple: [Scalar, Scalar]): Point2D<U> {
    return new Point2D(tuple[0], tuple[1])
  }

  public static polar<U = any>(angle: Scalar, radius?: Scalar): Point2D<U> {
    let sin = Math.sin(angle)
    let cos = Math.cos(angle)
    let ret = new Point2D(sin, cos)
    if (radius) {
      ret.mul_assign(radius)
    }
    return ret
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    return new Point2D(this.x, this.y)
  }

  public eq(other: this['Self']): boolean {
    return this.x === other.x && this.y === other.y
  }

  public cmp(other: this['Self']): Ordering {
    if (this.y < other.y || (this.y === other.y && this.x < other.x)) {
      return Less
    } else if (this.y > other.y || (this.y === other.y && this.x > other.x)) {
      return Greater
    } else {
      return Equal
    }
  }

  public partial_cmp(other: this['Self']): Option<Ordering> {
    return Some(this.cmp(other))
  }

  public fmt_debug(): string {
    return format('({:?},{:?})', this.x, this.y)
  }

  public fmt_display(): string {
    return format('({},{})', this.x, this.y)
  }

  public approx_eq(other: this['Self']): boolean {
    return approx_eq(this.x, other.x) && approx_eq(this.y, other.y)
  }

  public approx_eq_eps(other: this['Self'], eps: this['Self']): boolean {
    return approx_eq_eps(this.x, other.x, eps.x) && approx_eq_eps(this.y, other.y, eps.y)
  }

  public to_size(): Size2D<U> {
    return size2(this.x, this.y)
  }

  public to_vector(): Vector2D<U> {
    return vec2(this.x, this.y)
  }

  // Drop the units, preserving only the numeric value.
  public to_untyped(): Point2D<any> {
    return new Point2D(this.x, this.y)
  }

  // Tag a unit-less value with units.
  public static from_untyped<U>(p: Point2D<any>): Point2D<U> {
    return new Point2D(p.x, p.y)
  }

  // Cast the unit
  public cast_unit<V>(): Point2D<V> {
    return new Point2D(this.x, this.y)
  }

  // Swap x and y
  public yx(): this['Self'] {
    return new Point2D(this.y, this.x)
  }

  public to_array(): number[] {
    return [this.x, this.y]
  }

  public to_tuple(): [number, number] {
    return [this.x, this.y]
  }

  // Negate the point
  public neg(): this['Self'] {
    return new Point2D(-this.x, -this.y)
  }

  public neg_assign(): this['Self'] {
    this.x = -this.x
    this.y = -this.y
    return this
  }

  // Addition
  public add(other: this['Self']): this['Self']
  public add(other: Vector2D<U>): this['Self']
  public add(other: any): this['Self'] {
    return new Point2D(this.x + other.x, this.y + other.y)
  }

  public add_assign(other: this['Self']): this['Self']
  public add_assign(other: Vector2D<U>): this['Self']
  public add_assign(other: any): this['Self'] {
    this.x += other.x
    this.y += other.y
    return this
  }

  public add_size(size: Size2D<U>): this['Self'] {
    return new Point2D(this.x + size.width, this.y + size.height)
  }

  // Subtraction
  public sub(other: this['Self']): Vector2D<U>
  public sub(other: Vector2D<U>): this['Self']
  public sub(other: any): any {
    if (other instanceof Point2D) {
      return vec2(this.x - other.x, this.y - other.y)
    } else {
      return new Point2D<U>(this.x - other.x, this.y - other.y)
    }
  }

  public sub_assign(other: Vector2D<U>): this['Self'] {
    this.x -= other.x
    this.y -= other.y
    return this
  }

  // Multiplication
  public mul<U1, U2>(scale: Scale<U1, U2>): Point2D<U2>
  public mul(scale: Scalar): this['Self']
  public mul(scale: any): Point2D<any> {
    if (typeof scale === 'number') {
      return new Point2D(this.x * scale, this.y * scale)
    } else {
      return new Point2D(this.x * scale.get(), this.y * scale.get())
    }
  }

  public mul_assign(scale: Scalar): this['Self'] {
    this.x *= scale
    this.y *= scale
    return this
  }

  // Division
  public div<U1, U2>(scale: Scale<U1, U2>): Point2D<U2>
  public div(scale: Scalar): this['Self']
  public div(scale: any): Point2D<any> {
    if (typeof scale === 'number') {
      return new Point2D(this.x / scale, this.y / scale)
    } else {
      return new Point2D(this.x / scale.get(), this.y / scale.get())
    }
  }

  public div_assign(scale: Scalar): this['Self'] {
    this.x /= scale
    this.y /= scale
    return this
  }

  public min(other: this['Self']): this['Self'] {
    return new Point2D(minnum(this.x, other.x), minnum(this.y, other.y))
  }

  public max(other: this['Self']): this['Self'] {
    return new Point2D(maxnum(this.x, other.x), maxnum(this.y, other.y))
  }

  public clamp(start: this['Self'], end: this['Self']): this['Self'] {
    return this.max(start).min(end)
  }

  public round(): this['Self'] {
    return new Point2D(Math.round(this.x), Math.round(this.y))
  }

  public ceil(): this['Self'] {
    return new Point2D(Math.ceil(this.x), Math.ceil(this.y))
  }

  public floor(): this['Self'] {
    return new Point2D(Math.floor(this.x), Math.floor(this.y))
  }

  // Linear interpolation between this and an'other' Point2D
  public lerp(other: this['Self'], t: Scalar): this['Self'] {
    let one_t = 1 - t
    return new Point2D(one_t * this.x + t * other.x, one_t * this.y + t * other.y)
  }

  public is_finite(): boolean {
    return isFinite(this.x) && isFinite(this.y)
  }

  public is_zero(): boolean {
    return this.x === 0 && this.y === 0
  }
}

export function point2<U = any>(x: Scalar, y: Scalar): Point2D<U> {
  return new Point2D(x, y)
}

// Get the middle point between this and an'other' Point2D
export function midpoint<U = any>(a: Point2D<U>, b: Point2D<U>): Point2D<U> {
  return a.lerp(b, 0.5)
}
