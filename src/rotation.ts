import {
  Self,
  Clone,
  clone,
  Debug,
  Display,
  format,
  Option,
  ImplEq,
  ImplPartialEq,
  eq,
  ImplPartialOrd,
  partial_cmp,
  Ordering,
  PI,
  FRAC_PI_2,
  FRAC_PI_3,
  FRAC_PI_4
} from '@rusts/std'
import {
  Point2D,
  point2,
  degrees_to_radians,
  radians_to_degrees,
  Transform2D,
  Vector2D,
  vec2,
  sin_cos
} from './internal'

export class Angle extends ImplPartialOrd(ImplEq(ImplPartialEq(Self))) implements Clone, Debug {
  public Self!: Angle

  public radians: number

  private constructor(radians: number) {
    super()
    this.radians = radians
  }

  public static radians(radians: number): Angle {
    return new Angle(radians)
  }

  public static degrees(deg: number): Angle {
    return Angle.radians(degrees_to_radians(deg))
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    return new Angle(this.radians)
  }

  // Debug
  public fmt_debug(): string {
    return format('Angle({:?})', this.radians)
  }

  // PartialEq
  public eq(other: this['Self']): boolean {
    return this.radians === other.radians
  }

  // PartialOrd
  public partial_cmp(other: this['Self']): Option<Ordering> {
    return partial_cmp(this.radians, other.radians)
  }

  public to_degrees(): number {
    return radians_to_degrees(this.radians)
  }

  public get(): number {
    return this.radians
  }

  public static zero(): Angle {
    return Angle.radians(0)
  }

  public static pi(): Angle {
    return Angle.radians(PI)
  }

  public static two_pi(): Angle {
    return Angle.radians(PI + PI)
  }

  public static frac_pi_2(): Angle {
    return Angle.radians(FRAC_PI_2)
  }

  public static frac_pi_3(): Angle {
    return Angle.radians(FRAC_PI_3)
  }

  public static frac_pi_4(): Angle {
    return Angle.radians(FRAC_PI_4)
  }

  public positive(): this['Self'] {
    let two_pi = PI + PI
    let a = this.radians % two_pi
    if (a < 0) {
      a = a + two_pi
    }
    return Angle.radians(a)
  }

  public signed(): this['Self'] {
    return Angle.pi().sub_assign(
      Angle.pi()
        .sub_assign(this)
        .positive()
    )
  }

  public sin_cos(): [number, number] {
    return sin_cos(this.radians)
  }

  public add(other: this['Self']): this['Self'] {
    return Angle.radians(this.radians + other.radians)
  }

  public add_assign(other: this['Self']): this['Self'] {
    this.radians += other.radians
    return this
  }

  public sub(other: this['Self']): this['Self'] {
    return Angle.radians(this.radians - other.radians)
  }

  public sub_assign(other: this['Self']): this['Self'] {
    this.radians -= other.radians
    return this
  }

  public div(other: this['Self']): this['Self']
  public div(factor: number): this['Self']
  public div(other_factor: any): this['Self'] {
    if (typeof other_factor === 'number') {
      return Angle.radians(this.radians / other_factor)
    } else {
      return Angle.radians(this.radians / other_factor.radians)
    }
  }

  public div_assign(other: this['Self']): this['Self'] {
    this.radians /= other.radians
    return this
  }

  public mul(other: this['Self']): this['Self']
  public mul(factor: number): this['Self']
  public mul(other_factor: any): this['Self'] {
    if (typeof other_factor === 'number') {
      return Angle.radians(this.radians * other_factor)
    } else {
      return Angle.radians(this.radians * other_factor.radians)
    }
  }

  public mul_assign(other: this['Self']): this['Self'] {
    this.radians *= other.radians
    return this
  }

  public neg(): this['Self'] {
    return Angle.radians(-this.radians)
  }

  public neg_assign(): this['Self'] {
    this.radians = -this.radians
    return this
  }
}

export class Rotation2D<Src = any, Dst = any> extends ImplEq(ImplPartialEq(Self))
  implements Clone, Debug, Display {
  public Self!: Rotation2D<Src, Dst>

  public angle: number
  public _src_unit!: Src
  public _dst_unit!: Dst

  private constructor(angle: number) {
    super()
    this.angle = angle
  }

  public static radians<Src = any, Dst = any>(angle: number): Rotation2D<Src, Dst> {
    return new Rotation2D(angle)
  }

  public static degrees<Src = any, Dst = any>(angle: number): Rotation2D<Src, Dst> {
    return new Rotation2D(degrees_to_radians(angle))
  }

  public static identity<Src = any, Dst = any>(): Rotation2D<Src, Dst> {
    return Rotation2D.radians(0)
  }

  public static from_angle<Src = any, Dst = any>(angle: Angle): Rotation2D<Src, Dst> {
    return Rotation2D.radians(angle.radians)
  }

  public get_angle(): Angle {
    return Angle.radians(this.angle)
  }

  // Clone
  readonly isClone = true

  public clone(): this['Self'] {
    return Rotation2D.radians(this.angle)
  }

  // PartialEq
  public eq(other: this['Self']): boolean {
    return this.angle === other.angle
  }

  // Debug
  public fmt_debug(): string {
    return format('Rotation2D({:?} rad)', this.angle)
  }

  // Display
  public fmt_display(): string {
    return format('Rotation2D({} rad)', this.angle)
  }

  public inverse(): this['Self'] {
    return Rotation2D.radians(-this.angle)
  }

  public pre_rotate(other: this['Self']): this['Self'] {
    return Rotation2D.radians(this.angle + other.angle)
  }

  public post_rotate(other: this['Self']): this['Self'] {
    return other.pre_rotate(this)
  }

  public transform_point(point: Point2D<Src>): Point2D<Dst> {
    let sin = Math.sin(this.angle)
    let cos = Math.cos(this.angle)
    return point2(point.x * cos - point.y * sin, point.y * cos + point.x * sin)
  }

  public transform_vector(vector: Vector2D<Src>): Vector2D<Dst> {
    let sin = Math.sin(this.angle)
    let cos = Math.cos(this.angle)
    return vec2(vector.x * cos - vector.y * sin, vector.y * cos + vector.x * sin)
  }

  public to_transform(): Transform2D<Src, Dst> {
    return Transform2D.create_rotation(this.get_angle())
  }

  public is_identity(): boolean {
    return this.angle === 0
  }
}

export function rad(radians: number): Angle {
  return Angle.radians(radians)
}
