import { cubic_polynomial_roots } from "../src/utils";
import { ArrayVec } from "@rusts/arrayvec";
import { test_macros } from "@rusts/std";
const { assert, assert_eq } = test_macros;

test("cubic_polynomial", () => {
  const assert_approx_eq = (a: ArrayVec<number>, b: number[], epsilon: number) => {
    for (let i = 0; i < a.len(); ++i) {
      assert(Math.abs(a.get(i).unwrap() - b[i]) <= epsilon);
    }
    assert_eq(a.len(), b.length);
  };

  assert_approx_eq(cubic_polynomial_roots(2, -4, 2, 0), [0, 1], 0.0000001);
  assert_approx_eq(cubic_polynomial_roots(-1, 1, -1, 1), [1], 0.000001);
  assert_approx_eq(cubic_polynomial_roots(-2, 2, -1, 10), [2], 0.00005);
  // (x - 1)^3, with a triple root, should only return one root
  assert_approx_eq(cubic_polynomial_roots(1, -3, 3, -1), [1], 0.00005);

  // Quadratics
  assert_approx_eq(cubic_polynomial_roots(0, 1, -5, -14), [-2, 7], 0.00005);
  // (x - 3)^2, with a double root, should only return one root
  assert_approx_eq(cubic_polynomial_roots(0, 1, -6, 9), [3], 0.00005);

  // Linear
  assert_approx_eq(cubic_polynomial_roots(0, 0, 2, 1), [-0.5], 0.00005);

  // Constant
  assert_approx_eq(cubic_polynomial_roots(0, 0, 0, 0), [], 0.00005);
});
