// Type used to store coordinates
export type Scalar = number

// Default acceptably small value for f64
export const EPSILON: Scalar = 0.00000001

// Get value representing infinity
export function infinity(): Scalar {
  return Infinity
}

// Linear interpolation
export function lerp(a: Scalar, b: Scalar, t: Scalar): Scalar {
  return (1 - t) * a + t * b
}

export function approx_epsilon(): Scalar {
  return EPSILON
}

// Test for nearness between coordinates
export function approx_eq(a: Scalar, b: Scalar): boolean {
  return approx_eq_eps(a, b, approx_epsilon())
}

export function approx_eq_eps(a: Scalar, b: Scalar, eps: Scalar): boolean {
  return Math.abs(a - b) <= eps
}
