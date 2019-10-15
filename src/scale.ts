import { Self, Clone, clone, Debug, Display, format, ImplEq, ImplPartialEq, eq } from "@rusts/std";
import { Scalar, Point2D, point2, Rect, Size2D, size2, Vector2D, vec2 } from "./internal";

export class Scale<Src = any, Dst = any> extends ImplEq(ImplPartialEq(Self))
  implements Clone, Debug, Display {
  public Self!: Scale<Src, Dst>;

  public value: Scalar;

  public constructor(value: Scalar) {
    super();
    this.value = value;
  }

  public get(): Scalar {
    return this.value;
  }

  // Identity scaling, could be used to safely transit from one space to another.
  public ONE(): this["Self"] {
    return new Scale(1);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return this.value === other.value;
  }

  // Clone
  public clone(): this["Self"] {
    return new Scale(this.value);
  }

  // Debug
  public fmt_debug(): string {
    return format("Scale({:?})", this.value);
  }

  // Display
  public fmt_display(): string {
    return format("Scale({})", this.value);
  }

  public inv(): this["Self"] {
    return new Scale(1 / this.value);
  }

  public add(other: this["Self"]): this["Self"] {
    return new Scale(this.value + other.value);
  }

  public sub(other: this["Self"]): this["Self"] {
    return new Scale(this.value - other.value);
  }

  public mul(other: this["Self"]): this["Self"] {
    return new Scale(this.value * other.value);
  }

  public div(other: this["Self"]): this["Self"] {
    return new Scale(this.value / other.value);
  }

  public transform_point(point: Point2D): Point2D {
    return point2(point.x * this.value, point.y * this.value);
  }

  public transform_size(size: Size2D): Size2D {
    return size2(size.width * this.value, size.height * this.value);
  }

  public transform_vector(vector: Vector2D): Vector2D {
    return vec2(vector.x * this.value, vector.y * this.value);
  }

  public transform_rect(r: Rect): Rect {
    return new Rect(this.transform_point(r.origin), this.transform_size(r.size));
  }

  public inverse(): this["Self"] {
    return new Scale(-this.value);
  }

  public is_identity(): boolean {
    return this.value === 1;
  }
}

export function scale<Src = any, Dst = any>(value: Scalar): Scale<Src, Dst> {
  return new Scale(value);
}
