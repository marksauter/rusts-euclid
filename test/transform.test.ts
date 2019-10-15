import { Transform2D } from "../src/transform";
import {
  // point.ts
  point2,
  // rotation.ts
  rad,
  // rect.ts
  rect,
  // vector.ts
  vec2
} from "../src/euclid";
import { FRAC_PI_2 } from "@rusts/std";
const { assert, assert_eq } = require("@rusts/std/dist/lib/macros.test");

describe("Transform2D", () => {
  test("translation", () => {
    let t1 = Transform2D.create_translation(1, 2);
    let t2 = Transform2D.identity().pre_translate(vec2(1, 2));
    let t3 = Transform2D.identity().post_translate(vec2(1, 2));
    assert_eq(t1, t2);
    assert_eq(t1, t3);

    assert_eq(t1.transform_point(point2(1, 1)), point2(2, 3));

    assert_eq(t1.post_transform(t1), Transform2D.create_translation(2, 4));
  });

  test("rotation", () => {
    let r1 = Transform2D.create_rotation(rad(FRAC_PI_2));
    let r2 = Transform2D.identity().pre_rotate(rad(FRAC_PI_2));
    let r3 = Transform2D.identity().post_rotate(rad(FRAC_PI_2));
    assert_eq(r1, r2);
    assert_eq(r1, r3);

    assert(r1.transform_point(point2(1, 2)).approx_eq(point2(2, -1)));

    assert(r1.post_transform(r1).approx_eq(Transform2D.create_rotation(rad(FRAC_PI_2 * 2))));
  });

  test("scale", () => {
    let s1 = Transform2D.create_scale(2, 3);
    let s2 = Transform2D.identity().pre_scale(2, 3);
    let s3 = Transform2D.identity().post_scale(2, 3);
    assert_eq(s1, s2);
    assert_eq(s1, s3);

    assert(s1.transform_point(point2(2, 2)).approx_eq(point2(4, 6)));
  });

  test("column_major", () => {
    assert_eq(Transform2D.row_major(1, 2, 3, 4, 5, 6), Transform2D.column_major(1, 3, 5, 2, 4, 6));
  });

  test("inverse_simple", () => {
    let m1 = Transform2D.identity();
    let m2 = m1.inverse().unwrap();
    assert(m1.approx_eq(m2));
  });

  test("inverse_scale", () => {
    let m1 = Transform2D.create_scale(1.5, 0.3);
    let m2 = m1.inverse().unwrap();
    assert(m1.pre_transform(m2).approx_eq(Transform2D.identity()));
  });

  test("inverse_translate", () => {
    let m1 = Transform2D.create_translation(-132, 0.3);
    let m2 = m1.inverse().unwrap();
    assert(m1.pre_transform(m2).approx_eq(Transform2D.identity()));
  });

  test("inverse_none", () => {
    assert(
      Transform2D.create_scale(2, 0)
        .inverse()
        .is_none()
    );
    assert(
      Transform2D.create_scale(2, 2)
        .inverse()
        .is_some()
    );
  });

  test("pre_post", () => {
    let m1 = Transform2D.identity()
      .post_scale(1, 2)
      .post_translate(vec2(1, 2));
    let m2 = Transform2D.identity()
      .pre_translate(vec2(1, 2))
      .pre_scale(1, 2);
    assert(m1.approx_eq(m2));

    let r = Transform2D.create_rotation(rad(FRAC_PI_2));
    let t = Transform2D.create_translation(2, 3);

    let a = point2(1, 1);

    assert(
      r
        .post_transform(t)
        .transform_point(a)
        .approx_eq(point2(3, 2))
    );
    assert(
      t
        .post_transform(r)
        .transform_point(a)
        .approx_eq(point2(4, -3))
    );
    assert(
      t
        .post_transform(r)
        .transform_point(a)
        .approx_eq(r.transform_point(t.transform_point(a)))
    );

    assert(
      r
        .pre_transform(t)
        .transform_point(a)
        .approx_eq(point2(4, -3))
    );
    assert(
      t
        .pre_transform(r)
        .transform_point(a)
        .approx_eq(point2(3, 2))
    );
    assert(
      t
        .pre_transform(r)
        .transform_point(a)
        .approx_eq(t.transform_point(r.transform_point(a)))
    );
  });

  test("is_identity", () => {
    let m1 = Transform2D.identity();
    assert(m1.is_identity());
    let m2 = m1.post_translate(vec2(0.1, 0));
    assert(!m2.is_identity());
  });

  test("transform_point", () => {
    let m = Transform2D.create_translation(1, 1);
    let p = point2(10, -10);
    assert_eq(m.transform_point(p), point2(11, -9));
  });

  test("transform_vector", () => {
    // Translation does not apply to vectors.
    let m = Transform2D.create_translation(1, 1);
    let v = vec2(10, -10);
    assert_eq(v, m.transform_vector(v));
  });

  test("transform_rect", () => {
    let m = Transform2D.create_translation(1, 1);
    let r = rect(0, 0, 10, 10);
    assert_eq(m.transform_rect(r), rect(1, 1, 10, 10));
  });
});
