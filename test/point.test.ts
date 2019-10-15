import { range } from "@rusts/std";
import { Point2D, point2, vec2 } from "../src/euclid";
import { test_macros } from "@rusts/std";
const { assert, assert_eq } = test_macros;

describe("Point2D", () => {
  test("scalar_mul", () => {
    let p = point2(3, 5);

    let result = p.mul(5);

    assert_eq(result, point2(15, 25));
  });

  test("min", () => {
    let p1 = point2(1, 3);
    let p2 = point2(2, 2);

    let result = p1.min(p2);

    assert_eq(result, point2(1, 2));
  });

  test("max", () => {
    let p1 = point2(1, 3);
    let p2 = point2(2, 2);

    let result = p1.max(p2);

    assert_eq(result, point2(2, 3));
  });

  test("add", () => {
    let p = point2(1, 2);

    let result = p.add(vec2(3, 4));

    assert_eq(p, point2(1, 2));
    assert_eq(result, point2(4, 6));
  });

  test("add_assign", () => {
    let p = point2(1, 2);
    p.add_assign(vec2(3, 4));

    assert_eq(p, point2(4, 6));
  });

  test("sub", () => {
    let p = point2(3, 4);

    let r1 = p.sub(point2(1, 2));
    let r2 = p.sub(vec2(1, 2));

    assert_eq(p, point2(3, 4));
    assert_eq(r1, vec2(2, 2));
    assert_eq(r2, point2(2, 2));
  });

  test("sub_assign", () => {
    let p = point2(3, 4);
    p.sub_assign(vec2(1, 2));

    assert_eq(p, point2(2, 2));
  });

  test("mul", () => {
    let p = point2(2, 2);

    let result = p.mul(2);

    assert_eq(p, point2(2, 2));
    assert_eq(result, point2(4, 4));
  });

  test("mul_assign", () => {
    let p = point2(2, 2);
    p.mul_assign(2);

    assert_eq(p, point2(4, 4));
  });

  test("div", () => {
    let p = point2(4, 4);

    let result = p.div(2);

    assert_eq(p, point2(4, 4));
    assert_eq(result, point2(2, 2));
  });

  test("div_assign", () => {
    let p = point2(4, 4);
    p.div_assign(2);

    assert_eq(p, point2(2, 2));
  });

  test("floating_point_arithmetic", () => {
    let p1 = point2(1, 1);
    let p2 = point2(5, 5);
    let p3 = point2(10, 2);

    let t = 0.1;
    let t2 = t * t;
    let one_t = 1 - t;
    let one_t2 = one_t * one_t;

    let result = p1
      .mul(one_t2)
      .add(p2.to_vector().mul(2 * one_t * t))
      .add(p3.to_vector().mul(t2));

    assert(result.approx_eq(point2(1.81, 1.73)));
  });

  test("lerp", () => {
    let p1 = point2(-10, -10);
    let p2 = point2(10, 10);
    let p = p1.lerp(p2, 0.5);
    assert_eq(p, Point2D.origin());
  });

  test("conv_vector", () => {
    for (let n of range(0, 100)) {
      let x = n * 0.012345;
      let y = n * 0.987654;
      let p = point2(x, y);
      assert_eq(p.to_vector().to_point(), p);
    }
  });

  test("swizzling", () => {
    let p = point2(1, 2);
    assert_eq(p.yx(), point2(2, 1));
  });
});
