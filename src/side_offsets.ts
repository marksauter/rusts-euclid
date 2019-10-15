import {
  Self,
  Clone,
  clone,
  Debug,
  Display,
  format,
  Option,
  None,
  Some,
  ImplEq,
  ImplPartialEq,
  eq
} from "@rusts/std";
import { Scalar } from "./internal";

export class SideOffsets2D<U = any> extends ImplEq(ImplPartialEq(Self))
  implements Clone, Debug, Display {
  public Self!: SideOffsets2D<U>;

  public top: Scalar;
  public right: Scalar;
  public bottom: Scalar;
  public left: Scalar;
  public _unit!: U;

  public constructor(top: Scalar, right: Scalar, bottom: Scalar, left: Scalar) {
    super();
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }

  // Clone
  public clone(): this["Self"] {
    return new SideOffsets2D(this.top, this.right, this.bottom, this.left);
  }

  // PartialEq
  public eq(other: this["Self"]): boolean {
    return (
      this.top === other.top &&
      this.right === other.right &&
      this.bottom === other.bottom &&
      this.left === other.left
    );
  }

  // Debug
  public fmt_debug(): string {
    return format(
      "SideOffsets2D({:?},{:?},{:?},{:?})",
      this.top,
      this.right,
      this.bottom,
      this.left
    );
  }

  // Display
  public fmt_display(): string {
    return format("SideOffsets2D({},{},{},{})", this.top, this.right, this.bottom, this.left);
  }

  // Zero
  public static zero<U>(): SideOffsets2D<U> {
    return new SideOffsets2D(0, 0, 0, 0);
  }

  // Default
  public static default<U>(): SideOffsets2D<U> {
    return new SideOffsets2D(0, 0, 0, 0);
  }

  public static new_all_same<U>(all: Scalar): SideOffsets2D<U> {
    return new SideOffsets2D(all, all, all, all);
  }

  public horizontal(): Scalar {
    return this.left + this.right;
  }

  public vertical(): Scalar {
    return this.top + this.bottom;
  }

  public add(other: this["Self"]): this["Self"] {
    return new SideOffsets2D(
      this.top + other.top,
      this.right + other.right,
      this.bottom + other.bottom,
      this.left + other.left
    );
  }
}

export function sideoff2<U>(
  top: Scalar,
  right: Scalar,
  bottom: Scalar,
  left: Scalar
): SideOffsets2D<U> {
  return new SideOffsets2D(top, right, bottom, left);
}
