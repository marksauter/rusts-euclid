import { Self, Clone, clone, Debug, format, ImplEq, ImplPartialEq, eq } from "@rusts/std";
import {
  Scalar,
  Point2D,
  point2,
  Rect,
  Size2D,
  size2,
  Transform2D,
  Vector2D,
  vec2
} from "./internal";

export class Translation2D<Src = any, Dst = any> extends ImplEq(ImplPartialEq(Self))
  implements Clone, Debug {
  public Self!: Translation2D<Src, Dst>;

  public x: Scalar;
  public y: Scalar;
  public _src_unit!: Src;
  public _dst_unit!: Dst;

  public constructor(x: Scalar, y: Scalar) {
    super();
    this.x = x;
    this.y = y;
  }

  public static identity<Src = any, Dst = any>(): Translation2D<Src, Dst> {
    return translate2(0, 0);
  }

  public static default<Src = any, Dst = any>(): Translation2D<Src, Dst> {
    return this.identity();
  }

  public static from_vector<Src = any, Dst = any>(v: Vector2D<Src>): Translation2D<Src, Dst> {
    return new Translation2D(v.x, v.y);
  }

  // Clone
  public clone(): this["Self"] {
    return translate2(this.x, this.y);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return this.x === other.x && this.y === other.y;
  }

  // Debug
  public fmt_debug(): string {
    return format("{}", this.to_array());
  }

  public add<Dst1, Dst2>(other: Translation2D<Dst1, Dst2>): Translation2D<Src, Dst2> {
    return translate2(this.x + other.x, this.y + other.y);
  }

  public sub<Dst1, Dst2>(other: Translation2D<Dst1, Dst2>): Translation2D<Src, Dst1> {
    return translate2(this.x - other.x, this.y - other.y);
  }

  public to_array(): number[] {
    return [this.x, this.y];
  }

  public to_tuple(): [number, number] {
    return [this.x, this.y];
  }

  public to_vector(): Vector2D<Src> {
    return vec2(this.x, this.y);
  }

  public to_transform(): Transform2D<Src, Dst> {
    return Transform2D.create_translation(this.x, this.y);
  }

  public transform_point(point: Point2D<Src>): Point2D<Dst> {
    return point2(point.x + this.x, point.y + this.y);
  }

  public transform_rect(r: Rect<Src>): Rect<Dst> {
    return new Rect(this.transform_point(r.origin), this.transform_size(r.size));
  }

  public transform_size(size: Size2D<Src>): Size2D<Dst> {
    return size2(size.width, size.height);
  }

  public inverse(): Translation2D<Dst, Src> {
    return translate2(-this.x, -this.y);
  }

  public is_identity(): boolean {
    return this.x === 0 && this.y === 0;
  }
}

export function translate2<Src = any, Dst = any>(x: Scalar, y: Scalar): Translation2D<Src, Dst> {
  return new Translation2D(x, y);
}
