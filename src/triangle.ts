import { Self, Clone, Debug, Display, format, ImplPartialEq, maxnum, minnum } from "@rusts/std";
import { ArrayVec } from "@rusts/arrayvec";
import {
  // scalar.ts
  Scalar,
  // point.ts
  Point,
  point,
  // rect.ts
  Rect,
  // size.ts
  size,
  // transform.ts
  Transform2D,
  // line.ts
  LineSegment
} from "./internal";

export class Triangle<U = any> extends ImplPartialEq(Self) implements Clone, Debug, Display {
  public Self!: Triangle<U>;

  public a: Point<U>;
  public b: Point<U>;
  public c: Point<U>;
  public _unit!: U;

  public constructor(a: Point<U>, b: Point<U>, c: Point<U>) {
    super();
    this.a = a;
    this.b = b;
    this.c = c;
  }

  // Clone
  public clone(): this["Self"] {
    return new Triangle(this.a.clone(), this.b.clone(), this.c.clone());
  }

  public eq(other: this["Self"]): boolean {
    return this.a.eq(other.a) && this.b.eq(other.b) && this.c.eq(other.c);
  }

  public fmt_debug(): string {
    return format("Triangle({:?},{:?},{:?})", this.a, this.b, this.c);
  }

  public fmt_display(): string {
    return format("Triangle({},{},{})", this.a, this.b, this.c);
  }

  private get_barycentric_coords_for_point(p: Point<U>): [Scalar, Scalar, Scalar] {
    let v0 = this.b.sub(this.a);
    let v1 = this.c.sub(this.a);
    let v2 = p.sub(this.a);
    let inv = 1 / v0.cross(v1);
    let a = v0.cross(v2) * inv;
    let b = v2.cross(v1) * inv;
    let c = 1 - a - b;
    return [a, b, c];
  }

  public contains_point(p: Point<U>): boolean {
    let coords = this.get_barycentric_coords_for_point(p);
    return coords[0] > 0 && coords[1] > 0 && coords[2] > 0;
  }

  // Return the minimum bouding rectangle.
  public bounding_rect(): Rect<U> {
    let max_x = maxnum(maxnum(this.a.x, this.b.x), this.c.x);
    let min_x = minnum(minnum(this.a.x, this.b.x), this.c.x);
    let max_y = maxnum(maxnum(this.a.y, this.b.y), this.c.y);
    let min_y = minnum(minnum(this.a.y, this.b.y), this.c.y);

    let width = max_x - min_x;
    let height = max_y - min_y;

    return new Rect(point(min_x, min_y), size(width, height));
  }

  public ab(): LineSegment<U> {
    return new LineSegment(this.a, this.b);
  }

  public ba(): LineSegment<U> {
    return new LineSegment(this.b, this.a);
  }

  public bc(): LineSegment<U> {
    return new LineSegment(this.b, this.c);
  }

  public cb(): LineSegment<U> {
    return new LineSegment(this.c, this.b);
  }

  public ca(): LineSegment<U> {
    return new LineSegment(this.c, this.a);
  }

  public ac(): LineSegment<U> {
    return new LineSegment(this.a, this.c);
  }

  // Applies the transform to this triangle and returns the results.
  public transform<Dst>(transform: Transform2D<U, Dst>): Triangle<Dst> {
    return new Triangle(
      transform.transform_point(this.a),
      transform.transform_point(this.b),
      transform.transform_point(this.c)
    );
  }

  // Test for triangle-triangle intersection.
  public intersects(other: this["Self"]): boolean {
    if (!this.bounding_rect().intersects(other.bounding_rect())) {
      return false;
    }

    let ab1 = this.ab();
    let ab2 = other.ab();
    let bc1 = this.bc();
    let bc2 = other.bc();
    let ac1 = this.ac();
    let ac2 = other.ac();

    let min_max1 = new ArrayVec<[Scalar, Scalar]>(3);
    let min_max2 = new ArrayVec<[Scalar, Scalar]>(3);

    let checks = [
      [ab1, ab2],
      [ab1, bc2],
      [ab1, ac2],
      [bc1, ab2],
      [bc1, bc2],
      [bc1, ac2],
      [ac1, ab2],
      [ac1, bc2],
      [ac1, ac2]
    ];

    for (let i = 0; i < checks.length; ++i) {
      let l1 = checks[i][0];
      let l2 = checks[i][1];
      let j = i === 0 ? 0 : Math.floor(i / 3);
      let [min1, max1] = min_max1.get(j).map_or_else(
        () => {
          let range = l1.bounding_range_x();
          min_max1.push(range);
          return range;
        },
        (t: [Scalar, Scalar]) => t
      );
      let [min2, max2] = min_max2.get(j).map_or_else(
        () => {
          let range = l2.bounding_range_x();
          min_max2.push(range);
          return range;
        },
        (t: [Scalar, Scalar]) => t
      );
      if (min1 > max2 || max1 < min2) {
        continue;
      }

      if (
        l1.end.eq(l2.end) ||
        l1.start.eq(l2.start) ||
        l1.start.eq(l2.end) ||
        l1.end.eq(l2.start)
      ) {
        continue;
      }

      let v1 = l1.to_vector();
      let v2 = l2.to_vector();

      let v1_cross_v2 = v1.cross(v2);
      if (v1_cross_v2 === 0) {
        // The segments are parallel
        continue;
      }

      let sign_v1_cross_v2 = Math.sign(v1_cross_v2);
      let abs_v1_cross_v2 = Math.abs(v1_cross_v2);

      let v3 = l2.start.sub(l1.start);

      let t = v3.cross(v2) * sign_v1_cross_v2;
      let u = v3.cross(v1) * sign_v1_cross_v2;

      if (t < 0 || t > abs_v1_cross_v2 || u < 0 || u > abs_v1_cross_v2) {
        continue;
      }

      return true;
    }

    return this.contains_point(other.a) || other.contains_point(this.a) || this.eq(other);
  }

  public intersects_line_segment(segment: LineSegment<U>): boolean {
    return (
      this.ab().intersects(segment) ||
      this.bc().intersects(segment) ||
      this.ac().intersects(segment) ||
      this.contains_point(segment.start)
    );
  }
}

export function triangle<U = any>(a: Point<U>, b: Point<U>, c: Point<U>): Triangle<U> {
  return new Triangle(a, b, c);
}
