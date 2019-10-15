import { Rotation2D } from "../src/rotation";
import { point2 } from "../src/euclid";
import { FRAC_PI_2, PI } from "@rusts/std";
import { test_macros } from "@rusts/std";
const { assert, assert_eq } = test_macros;

describe("Rotation2D", () => {
  test("simple", () => {
    let ri = Rotation2D.identity();
    let r90 = Rotation2D.radians(FRAC_PI_2);
    let rm90 = Rotation2D.radians(-FRAC_PI_2);
    let r180 = Rotation2D.radians(PI);

    assert(ri.transform_point(point2(1, 2)).approx_eq(point2(1, 2)));
    assert(r90.transform_point(point2(1, 2)).approx_eq(point2(-2, 1)));
    assert(rm90.transform_point(point2(1, 2)).approx_eq(point2(2, -1)));
    assert(r180.transform_point(point2(1, 2)).approx_eq(point2(-1, -2)));

    assert(
      r90
        .inverse()
        .inverse()
        .transform_point(point2(1, 2))
        .approx_eq(r90.transform_point(point2(1, 2)))
    );
  });
});
