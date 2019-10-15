import {
  Self,
  Clone,
  clone,
  Debug,
  format,
  Option,
  Some,
  None,
  ImplEq,
  ImplPartialEq,
  eq
} from "@rusts/std";
import {
  Angle,
  approx_eq,
  approx_eq_eps,
  Scalar,
  Point2D,
  point2,
  Rect,
  Vector2D,
  vec2
} from "./internal";

export type Transform2DAsArray = [Scalar, Scalar, Scalar, Scalar, Scalar, Scalar];
export type RowArray = [Scalar, Scalar];
export type RowArrays = [RowArray, RowArray, RowArray];
export type ColumnArray = [Scalar, Scalar, Scalar];
export type ColumnArrays = [ColumnArray, ColumnArray];

export class Transform2D<Src = any, Dst = any> extends ImplEq(ImplPartialEq(Self))
  implements Clone, Debug {
  public Self!: Transform2D<Src, Dst>;

  public m11: Scalar;
  public m12: Scalar;
  public m21: Scalar;
  public m22: Scalar;
  public m31: Scalar;
  public m32: Scalar;
  public _src_unit!: Src;
  public _dst_unit!: Dst;

  private constructor(
    m11: Scalar,
    m12: Scalar,
    m21: Scalar,
    m22: Scalar,
    m31: Scalar,
    m32: Scalar
  ) {
    super();
    this.m11 = m11;
    this.m12 = m12;
    this.m21 = m21;
    this.m22 = m22;
    this.m31 = m31;
    this.m32 = m32;
  }

  // Clone
  public clone(): this["Self"] {
    return new Transform2D(this.m11, this.m12, this.m21, this.m22, this.m31, this.m32);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.m11 === other.m11 &&
      this.m12 === other.m12 &&
      this.m21 === other.m21 &&
      this.m22 === other.m22 &&
      this.m31 === other.m31 &&
      this.m32 === other.m32
    );
  }

  // Debug
  public fmt_debug(): string {
    if (this.is_identity()) {
      return "[I]";
    }
    return format("{}", this.to_row_major_array());
  }

  public static row_major<Src = any, Dst = any>(
    m11: Scalar,
    m12: Scalar,
    m21: Scalar,
    m22: Scalar,
    m31: Scalar,
    m32: Scalar
  ) {
    return new Transform2D(m11, m12, m21, m22, m31, m32);
  }

  public static column_major<Src = any, Dst = any>(
    m11: Scalar,
    m21: Scalar,
    m31: Scalar,
    m12: Scalar,
    m22: Scalar,
    m32: Scalar
  ) {
    return new Transform2D(m11, m12, m21, m22, m31, m32);
  }

  public static identity<Src = any, Dst = any>(): Transform2D<Src, Dst> {
    return Transform2D.row_major(1, 0, 0, 1, 0, 0);
  }

  public static default<Src = any, Dst = any>(): Transform2D<Src, Dst> {
    return Transform2D.identity();
  }

  public to_row_major_array(): Transform2DAsArray {
    return [this.m11, this.m12, this.m21, this.m22, this.m31, this.m32];
  }

  public to_column_major_array(): Transform2DAsArray {
    return [this.m11, this.m21, this.m31, this.m12, this.m22, this.m32];
  }

  public to_row_arrays(): RowArrays {
    return [[this.m11, this.m12], [this.m21, this.m22], [this.m31, this.m32]];
  }

  public to_column_arrays(): ColumnArrays {
    return [[this.m11, this.m21, this.m31], [this.m12, this.m22, this.m32]];
  }

  public from_row_major_array(a: Transform2DAsArray): this["Self"] {
    return Transform2D.row_major(a[0], a[1], a[2], a[3], a[4], a[5]);
  }

  public from_row_arrays(array: RowArrays): this["Self"] {
    return Transform2D.row_major(
      array[0][0],
      array[0][1],
      array[1][0],
      array[1][1],
      array[2][0],
      array[2][1]
    );
  }

  public to_untyped(): Transform2D<any, any> {
    return Transform2D.row_major(this.m11, this.m12, this.m21, this.m22, this.m31, this.m32);
  }

  public static from_untyped<Src = any, Dst = any>(
    p: Transform2D<any, any>
  ): Transform2D<Src, Dst> {
    return Transform2D.row_major(p.m11, p.m12, p.m21, p.m22, p.m31, p.m32);
  }

  public is_identity(): boolean {
    return this.eq(Transform2D.identity());
  }

  public is_approx_identity(): boolean {
    return this.approx_eq(Transform2D.identity());
  }

  public is_approx_identity_eps(eps: Scalar): boolean {
    return this.approx_eq_eps(Transform2D.identity(), eps);
  }

  public post_transform<NewDst>(other: Transform2D<Dst, NewDst>): Transform2D<Src, NewDst> {
    return Transform2D.row_major(
      this.m11 * other.m11 + this.m12 * other.m21,
      this.m11 * other.m12 + this.m12 * other.m22,
      this.m21 * other.m11 + this.m22 * other.m21,
      this.m21 * other.m12 + this.m22 * other.m22,
      this.m31 * other.m11 + this.m32 * other.m21 + other.m31,
      this.m31 * other.m12 + this.m32 * other.m22 + other.m32
    );
  }

  public pre_transform<NewSrc>(other: Transform2D<NewSrc, Src>): Transform2D<NewSrc, Dst> {
    return other.post_transform(this);
  }

  public static create_translation<Src = any, Dst = any>(
    x: Scalar,
    y: Scalar
  ): Transform2D<Src, Dst> {
    return Transform2D.row_major(1, 0, 0, 1, x, y);
  }

  public post_translate(v: Vector2D<Dst>): this["Self"] {
    return this.post_transform(Transform2D.create_translation(v.x, v.y));
  }

  public pre_translate(v: Vector2D<Src>): this["Self"] {
    return this.pre_transform(Transform2D.create_translation(v.x, v.y));
  }

  public static create_scale<Src = any, Dst = any>(x: Scalar, y: Scalar): Transform2D<Src, Dst> {
    return Transform2D.row_major(x, 0, 0, y, 0, 0);
  }

  public post_scale(x: Scalar, y: Scalar): this["Self"] {
    return this.post_transform(Transform2D.create_scale(x, y));
  }

  public pre_scale(x: Scalar, y: Scalar): this["Self"] {
    return Transform2D.row_major(
      this.m11 * x,
      this.m12,
      this.m21,
      this.m22 * y,
      this.m31,
      this.m32
    );
  }

  public static create_rotation<Src = any, Dst = any>(theta: Angle): Transform2D<Src, Dst> {
    let cos = Math.cos(theta.get());
    let sin = Math.sin(theta.get());
    return Transform2D.row_major(cos, 0 - sin, sin, cos, 0, 0);
  }

  public post_rotate(theta: Angle): this["Self"] {
    return this.post_transform(Transform2D.create_rotation(theta));
  }

  public pre_rotate(theta: Angle): this["Self"] {
    return this.pre_transform(Transform2D.create_rotation(theta));
  }

  public transform_point(point: Point2D<Src>): Point2D<Dst> {
    return point2(
      point.x * this.m11 + point.y * this.m21 + this.m31,
      point.x * this.m12 + point.y * this.m22 + this.m32
    );
  }

  public transform_vector(vector: Vector2D<Src>): Vector2D<Dst> {
    return vec2(
      vector.x * this.m11 + vector.y * this.m21,
      vector.x * this.m12 + vector.y * this.m22
    );
  }

  public transform_rect(rect: Rect<Src>): Rect<Dst> {
    let min = rect.min();
    let max = rect.max();
    return Rect.from_points([
      this.transform_point(min),
      this.transform_point(max),
      this.transform_point(point2(max.x, min.y)),
      this.transform_point(point2(min.x, max.y))
    ]);
  }

  public determinant(): Scalar {
    return this.m11 * this.m22 - this.m12 * this.m21;
  }

  public inverse(): Option<this["Self"]> {
    let det = this.determinant();

    if (det === 0) {
      return None();
    }

    let inv_det = 1 / det;
    return Some(
      Transform2D.row_major(
        inv_det * this.m22,
        inv_det * (0 - this.m12),
        inv_det * (0 - this.m21),
        inv_det * this.m11,
        inv_det * (this.m21 * this.m32 - this.m22 * this.m31),
        inv_det * (this.m31 * this.m12 - this.m11 * this.m32)
      )
    );
  }

  public with_destination<NewDst>(): Transform2D<Src, NewDst> {
    return Transform2D.row_major(this.m11, this.m12, this.m21, this.m22, this.m31, this.m32);
  }

  public with_source<NewSrc>(): Transform2D<NewSrc, Dst> {
    return Transform2D.row_major(this.m11, this.m12, this.m21, this.m22, this.m31, this.m32);
  }

  public approx_eq(other: this["Self"]): boolean {
    return (
      approx_eq(this.m11, other.m11) &&
      approx_eq(this.m12, other.m12) &&
      approx_eq(this.m21, other.m21) &&
      approx_eq(this.m22, other.m22) &&
      approx_eq(this.m31, other.m31) &&
      approx_eq(this.m32, other.m32)
    );
  }

  public approx_eq_eps(other: this["Self"], eps: Scalar): boolean {
    return (
      approx_eq_eps(this.m11, other.m11, eps) &&
      approx_eq_eps(this.m12, other.m12, eps) &&
      approx_eq_eps(this.m21, other.m21, eps) &&
      approx_eq_eps(this.m22, other.m22, eps) &&
      approx_eq_eps(this.m31, other.m31, eps) &&
      approx_eq_eps(this.m32, other.m32, eps)
    );
  }
}
