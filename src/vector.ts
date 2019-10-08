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
  debug_assert,
  maxnum,
  minnum
} from '@rusts/std'
import {
  // rotation.ts
  Angle,
  // scalar.ts
  Scalar,
  EPSILON,
  approx_eq,
  approx_eq_eps,
  infinity,
  // point.ts
  Point2D,
  point2,
  // scale.ts
  Scale,
  // size.ts
  Size2D,
  size2,
  // transform.ts
  Transform2D
} from './internal'

export class Vector2D<U = any> extends ImplOrd(ImplPartialOrd(ImplEq(ImplPartialEq(Self))))
  implements Clone, Debug, Display {
  public Self!: Vector2D<U>

  public x: Scalar
  public y: Scalar
  public _unit!: U

  public constructor(x: Scalar, y: Scalar) {
    super()
    this.x = x
    this.y = y
  }

  // Zero
  public static zero<U>(): Vector2D<U> {
    return new Vector2D(0, 0)
  }

  // Default
  public static default<U>(): Vector2D<U> {
    return Vector2D.zero()
  }

  public static polar<U>(angle: Scalar, radius?: Scalar): Vector2D<U> {
    let sin = Math.sin(angle)
    let cos = Math.cos(angle)
    let ret = new Vector2D(sin, cos)
    if (radius) {
      ret.mul_assign(radius)
    }
    return ret
  }

  public static from_array<U>(array: Scalar[]): Vector2D<U> {
    if (array.length != 2) {
      throw new Error(
        `Vector2D.from_array: array ${array} length ${array.length} is not of length 2`
      )
    }
    return new Vector2D(array[0], array[1])
  }

  public static from_tuple<U>(tuple: [Scalar, Scalar]): Vector2D<U> {
    return new Vector2D(tuple[0], tuple[1])
  }

  public static from_size<U>(size: Size2D<U>): Vector2D<U> {
    return size.to_vector()
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    return new Vector2D(this.x, this.y)
  }

  // PartialEq
  public eq(other: this['Self']): boolean {
    return this.x === other.x && this.y === other.y
  }

  // Ord
  public cmp(other: this['Self']): Ordering {
    if (this.y < other.y || (this.y === other.y && this.x < other.x)) {
      return Less
    } else if (this.y > other.y || (this.y === other.y && this.x > other.x)) {
      return Greater
    } else {
      return Equal
    }
  }

  // PartialOrd
  public partial_cmp(other: this['Self']): Option<Ordering> {
    return Some(this.cmp(other))
  }

  // Debug
  public fmt_debug(): string {
    return format('({:?},{:?})', this.x, this.y)
  }

  // Display
  public fmt_display(): string {
    return format('({},{})', this.x, this.y)
  }

  public approx_eq(other: this['Self']): boolean {
    return approx_eq(this.sub(other).length(), 0)
  }

  public approx_eq_eps(other: this['Self'], eps: this['Self']): boolean {
    return approx_eq_eps(this.x, other.x, eps.x) && approx_eq_eps(this.y, other.y, eps.y)
  }

  // Cast this vector into a point
  public to_point(): Point2D<U> {
    return point2(this.x, this.y)
  }

  // Cast this vector into a size
  public to_size(): Size2D<U> {
    return size2(this.x, this.y)
  }

  // Drop the units, preserving only the numeric value.
  public to_untyped(): Vector2D<any> {
    return new Vector2D(this.x, this.y)
  }

  // Tag a unit-less value with units.
  public static from_untyped<V>(v: Vector2D<any>): Vector2D<V> {
    return new Vector2D(v.x, v.y)
  }

  // Cast the unit
  public cast_unit<V>(): Vector2D<V> {
    return new Vector2D(this.x, this.y)
  }

  // Swap x and y
  public yx(): this['Self'] {
    return new Vector2D(this.y, this.x)
  }

  public to_array(): number[] {
    return [this.x, this.y]
  }

  public to_tuple(): [number, number] {
    return [this.x, this.y]
  }

  public to_transform(): Transform2D {
    return Transform2D.create_translation(this.x, this.y)
  }

  // Negate the point
  public neg(): this['Self'] {
    return new Vector2D(-this.x, -this.y)
  }

  public neg_assign(): this['Self'] {
    this.x = -this.x
    this.y = -this.y
    return this
  }

  // Addition
  public add(other: this['Self']): this['Self'] {
    return new Vector2D(this.x + other.x, this.y + other.y)
  }

  public add_assign(other: this['Self']): this['Self'] {
    this.x += other.x
    this.y += other.y
    return this
  }

  // Subtraction
  public sub(other: this['Self']): this['Self'] {
    return new Vector2D(this.x - other.x, this.y - other.y)
  }

  public sub_assign(other: this['Self']): this['Self'] {
    this.x -= other.x
    this.y -= other.y
    return this
  }

  // Multiplication
  public mul<U1, U2>(scale: Scale<U1, U2>): Vector2D<U2>
  public mul(scale: Scalar): this['Self']
  public mul(scale: any): Vector2D<any> {
    if (typeof scale === 'number') {
      return new Vector2D(this.x * scale, this.y * scale)
    } else {
      return new Vector2D(this.x * scale.get(), this.y * scale.get())
    }
  }

  public mul_assign(scale: Scalar): this['Self'] {
    this.x *= scale
    this.y *= scale
    return this
  }

  // Division
  public div<U1, U2>(scale: Scale<U1, U2>): Vector2D<U2>
  public div(scale: Scalar): this['Self']
  public div(scale: any): Vector2D<any> {
    if (typeof scale === 'number') {
      return new Vector2D(this.x / scale, this.y / scale)
    } else {
      return new Vector2D(this.x / scale.get(), this.y / scale.get())
    }
  }

  public div_assign(scale: Scalar): this['Self'] {
    this.x /= scale
    this.y /= scale
    return this
  }

  public angle_from_x_axis(): Angle {
    return Angle.radians(Math.atan2(this.y, this.x))
  }

  public angle_to(other: this['Self']): Angle {
    return Angle.radians(Math.atan2(this.cross(other), this.dot(other)))
  }

  public dot(other: this['Self']): Scalar {
    return this.x * other.x + this.y * other.y
  }

  public cross(other: this['Self']): Scalar {
    return this.x * other.y - this.y * other.x
  }

  public normalize(): this['Self'] {
    return this.div(this.length())
  }

  public robust_normalize(): this['Self'] {
    let length = this.length()
    if (!isFinite(length)) {
      let scaled = this.div(Number.MAX_VALUE)
      return scaled.div(scaled.length())
    } else {
      return this.div(this.length())
    }
  }

  public square_length(): Scalar {
    return this.x * this.x + this.y * this.y
  }

  // Compute length
  public length(): Scalar {
    return Math.sqrt(this.square_length())
  }

  public project_onto_vector(onto: this['Self']): this['Self'] {
    return onto.mul(this.dot(onto) / onto.square_length())
  }

  public with_max_length(max_length: Scalar): this['Self'] {
    let square_length = this.square_length()
    if (square_length > max_length * max_length) {
      return this.mul(max_length / Math.sqrt(square_length))
    }

    return this
  }

  public with_min_length(min_length: Scalar): this['Self'] {
    let square_length = this.square_length()
    if (square_length < min_length * min_length) {
      return this.mul(min_length / Math.sqrt(square_length))
    }

    return this
  }

  public clamp_length(min: Scalar, max: Scalar): this['Self'] {
    debug_assert(min <= max)
    return this.with_min_length(min).with_max_length(max)
  }

  public min(other: this['Self']): this['Self'] {
    return new Vector2D(minnum(this.x, other.x), minnum(this.y, other.y))
  }

  public max(other: this['Self']): this['Self'] {
    return new Vector2D(maxnum(this.x, other.x), maxnum(this.y, other.y))
  }

  public clamp(start: this['Self'], end: this['Self']): this['Self'] {
    return this.max(start).min(end)
  }

  public round(): this['Self'] {
    return new Vector2D(Math.round(this.x), Math.round(this.y))
  }

  public ceil(): this['Self'] {
    return new Vector2D(Math.ceil(this.x), Math.ceil(this.y))
  }

  public floor(): this['Self'] {
    return new Vector2D(Math.floor(this.x), Math.floor(this.y))
  }

  public abs(): this['Self'] {
    return new Vector2D(Math.abs(this.x), Math.abs(this.y))
  }

  // Linear interpolation between this and an'other' Vector2D
  public lerp(other: this['Self'], t: Scalar): this['Self'] {
    let one_t = 1 - t
    return this.mul(one_t).add(other.mul(t))
  }

  public reflect(normal: this['Self']): this['Self'] {
    return this.sub(normal.mul(2).mul(this.dot(normal)))
  }

  public is_finite(): boolean {
    return isFinite(this.x) && isFinite(this.y)
  }

  public is_zero(): boolean {
    return this.x === 0 && this.y === 0
  }

  public is_normalized(): boolean {
    return approx_eq(this.length(), 1.0)
  }

  public greater_than(other: this['Self']): BoolVector2D {
    return bvec2(this.x > other.x, this.y > other.y)
  }

  public lower_than(other: this['Self']): BoolVector2D {
    return bvec2(this.x < other.x, this.y < other.y)
  }

  public equal(other: this['Self']): BoolVector2D {
    return bvec2(this.x === other.x, this.y === other.y)
  }

  public not_equal(other: this['Self']): BoolVector2D {
    return bvec2(this.x !== other.x, this.y !== other.y)
  }
}

export class BoolVector2D {
  public x: boolean
  public y: boolean

  public constructor(x: boolean, y: boolean) {
    this.x = x
    this.y = y
  }

  public all(): boolean {
    return this.x && this.y
  }

  public any(): boolean {
    return this.x || this.y
  }

  public none(): boolean {
    return !this.any()
  }

  public and(other: BoolVector2D): BoolVector2D {
    return new BoolVector2D(this.x && other.x, this.y && other.y)
  }

  public or(other: BoolVector2D): BoolVector2D {
    return new BoolVector2D(this.x || other.x, this.y || other.y)
  }

  public not(): BoolVector2D {
    return new BoolVector2D(!this.x, !this.y)
  }

  public select_point<U>(a: Point2D<U>, b: Point2D<U>): Point2D<U> {
    return point2(this.x ? a.x : b.x, this.y ? a.y : b.y)
  }

  public select_vector<U>(a: Vector2D<U>, b: Vector2D<U>): Vector2D<U> {
    return vec2(this.x ? a.x : b.x, this.y ? a.y : b.y)
  }
}

export function vec2<U = any>(x: Scalar, y: Scalar): Vector2D<U> {
  return new Vector2D(x, y)
}

export function bvec2<U = any>(x: boolean, y: boolean): BoolVector2D {
  return new BoolVector2D(x, y)
}

// // Compute the first norm of 'p'
// export function first_norm(p: Vector2D<U>): Scalar {
//   return Math.abs(p.x) + Math.abs(p.y)
// }
//
// // Compute the second norm of 'p'
// export function second_norm(p: Vector2D<U>): Scalar {
//   return p.length()
// }
//
// // Compute the square of the second norm of 'p'
// export function second_norm_sq(p: Vector2D<U>): Scalar {
//   return p.x*p.x + p.y*p.y
// }
//
// // Compute the uniform norm of 'p'
// export function uniform_norm(p: Vector2D<U>): Scalar {
//   let a = Math.abs(p.x)
//   let b = Math.abs(p.y)
//   return (a < b || isNaN(b)) ? b : a
// }
//
// export function distance(a: Vector2D<U>, b: Vector2D<U>): Scalar {
//   return a.sub(b).length()
// }
//
// export function distance_sq(a: Vector2D<U>, b: Vector2D<U>): Scalar {
//   return second_norm_sq(a.sub(b))
// }
//
// export function are_collinear(p1: Vector2D<U>, p2: Vector2D<U>, p3: Vector2D<U>, eps: Scalar = EPSILON): boolean {
//   return are_near(cross(p3, p2) - cross(p3, p1) + cross(p2, p1), 0, eps)
// }
//
// export function is_zero(p: Vector2D<U>): boolean {
//   return p.is_zero()
// }
//
// export function is_unit_vector(p: Vector2D<U>, eps: Scalar = EPSILON) {
//   return are_near(L2(p), 1.0, eps)
// }
//
// export function atan2(p: Vector2D<U>): Scalar {
//   return Math.atan2(p.y, p.x)
// }
//
// export function angle_between(p: Vector2D<U>, b: Vector2D<U>): Scalar {
//   return Math.atan2(cross(a, b), dot(a, b))
// }
//
// export function unit_vector(p: Vector2D<U>): Vector2D<U> {
//   return p.normalized()
// }
