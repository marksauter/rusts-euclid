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
} from '@rusts/std'
import { BoolVector2D, bvec2, Scalar, EPSILON, Point2D, point2, Vector2D, vec2 } from './internal'

export class Size2D<U = any> extends ImplEq(ImplPartialEq(Self)) implements Clone, Debug, Display {
  public Self!: Size2D<U>

  public width: Scalar
  public height: Scalar
  public _unit!: U

  public constructor(width: Scalar, height: Scalar) {
    super()
    this.width = width
    this.height = height
  }

  // Default
  public static default<U>(): Size2D<U> {
    return new Size2D(0, 0)
  }

  // Zero
  public static zero<U>(): Size2D<U> {
    return new Size2D(0, 0)
  }

  public is_zero(): boolean {
    return this.width === 0 && this.height === 0
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    return new Size2D(this.width, this.height)
  }

  // PartialEq
  public eq(p: this['Self']): boolean {
    return this.width === p.width && this.height === p.height
  }

  // Debug
  public fmt_debug(): string {
    return format('{:?}×{:?}', this.width, this.height)
  }

  // Display
  public fmt_display(): string {
    return format('({}×{})', this.width, this.height)
  }

  public to_array(): number[] {
    return [this.width, this.height]
  }

  public to_tuple(): [number, number] {
    return [this.width, this.height]
  }

  public to_point(): Point2D<U> {
    return point2(this.width, this.height)
  }

  public to_vector(): Vector2D<U> {
    return vec2(this.width, this.height)
  }

  // Drop the units, preserving only the numeric value.
  public to_untyped(): Size2D<any> {
    return new Size2D(this.width, this.height)
  }

  // Tag a unit-less value with units.
  public static from_untyped<V>(v: Size2D<any>): Size2D<V> {
    return new Size2D(v.width, v.height)
  }

  // Cast the unit
  public cast_unit<V>(): Size2D<V> {
    return new Size2D(this.width, this.height)
  }

  // Addition
  public add(other: this['Self']): this['Self'] {
    return new Size2D(this.width + other.width, this.height + other.height)
  }

  public add_assign(other: this['Self']): this['Self'] {
    this.width += other.width
    this.height += other.height
    return this
  }

  // Subtraction
  public sub(other: this['Self']): this['Self'] {
    return new Size2D(this.width - other.width, this.height - other.height)
  }

  public sub_assign(other: this['Self']): this['Self'] {
    this.width -= other.width
    this.height -= other.height
    return this
  }

  // Multiplication
  public mul(scale: Scalar): this['Self'] {
    return new Size2D(this.width * scale, this.height * scale)
  }

  public mul_assign(scale: Scalar): this['Self'] {
    this.width *= scale
    this.height *= scale
    return this
  }

  // Division
  public div(scale: Scalar): this['Self'] {
    return new Size2D(this.width / scale, this.height / scale)
  }

  public div_assign(scale: Scalar): this['Self'] {
    this.width /= scale
    this.height /= scale
    return this
  }

  public area(): Scalar {
    return this.width * this.height
  }

  public min(other: this['Self']): this['Self'] {
    return new Size2D(min(this.width, other.width), min(this.height, other.height))
  }

  public max(other: this['Self']): this['Self'] {
    return new Size2D(max(this.width, other.width), max(this.height, other.height))
  }

  public clamp(start: this['Self'], end: this['Self']): this['Self'] {
    return this.max(start).min(end)
  }

  public round(): this['Self'] {
    return new Size2D(Math.round(this.width), Math.round(this.height))
  }

  public ceil(): this['Self'] {
    return new Size2D(Math.ceil(this.width), Math.ceil(this.height))
  }

  public floor(): this['Self'] {
    return new Size2D(Math.floor(this.width), Math.floor(this.height))
  }

  // Linear interpolation between this and an'other' Size2D
  public lerp(other: this['Self'], t: Scalar): this['Self'] {
    return new Size2D(1 * this.width + t * other.width, 1 * this.height + t * other.height)
  }

  public is_empty_or_negative(): boolean {
    return this.width <= 0 || this.height <= 0
  }

  public abs(): this['Self'] {
    return new Size2D(Math.abs(this.width), Math.abs(this.height))
  }

  public is_positive(): boolean {
    return this.width > 0 && this.height > 0
  }

  public greater_than(other: this['Self']): BoolVector2D {
    return bvec2(this.width > other.width, this.height > other.height)
  }

  public lower_than(other: this['Self']): BoolVector2D {
    return bvec2(this.width < other.width, this.height < other.height)
  }

  public equal(other: this['Self']): BoolVector2D {
    return bvec2(this.width === other.width, this.height === other.height)
  }

  public not_equal(other: this['Self']): BoolVector2D {
    return bvec2(this.width !== other.width, this.height !== other.height)
  }
}

export function size2<U = any>(width: Scalar, height: Scalar): Size2D<U> {
  return new Size2D(width, height)
}
