import { PI } from '@rusts/std'
import { ArrayVec } from '@rusts/arrayvec'
import {
  // scalar.ts
  Scalar,
  EPSILON,
  // point2s
  Point,
  // vector.ts
  Vector,
  vector
} from './internal'

export function min_max(a: Scalar, b: Scalar): [Scalar, Scalar] {
  return a < b ? [a, b] : [b, a]
}

export function sin_cos(x: Scalar): [Scalar, Scalar] {
  return [Math.sin(x), Math.cos(x)]
}

export function tangent(v: Vector): Vector {
  return vector(-v.y, v.x)
}

export function normalized_tangent(v: Vector): Vector {
  return tangent(v).normalize()
}

// Angle between vectors v1 and v2 (oriented clockwise assyming y points downwards).
// The result is a number between `0` and `2 * PI`.
//
// ex: `directed_angle([0,1], [1,0]) = 3/2 Pi rad`
//
// ```text
//     x       __
//   0-->     /  \
//  y|       |  x--> v2
//   v        \ |v1
//              v
// ```
//
// Or, assuming y points upwards:
// `directed_angle([0,-1], [1,0]) = 1/2 Pi rad`
//
// ```text
//   ^           v2
//  y|          x-->
//   0-->    v1 | /
//     x        v-
// ```
//
export function directed_angle(v1: Vector, v2: Vector): Scalar {
  let angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)
  return angle < 0 ? angle + 2 * PI : angle
}

export function directed_angle2(center: Point, a: Point, b: Point): Scalar {
  return directed_angle(a.sub(center), b.sub(center))
}

// Returns an ArrayVec<[Scalar; 3]>
export function cubic_polynomial_roots(
  a: Scalar,
  b: Scalar,
  c: Scalar,
  d: Scalar
): ArrayVec<Scalar> {
  let result = new ArrayVec<Scalar>(3)

  if (Math.abs(a) < EPSILON) {
    if (Math.abs(b) < EPSILON) {
      if (Math.abs(c) < EPSILON) {
        return result
      }
      // linear equation
      result.push(-d / c)
      return result
    }
    // quadratic equation
    let delta = c * c - 4 * b * d
    if (delta > 0) {
      let sqrt_delta = Math.sqrt(delta)
      result.push((-c - sqrt_delta) / (2 * b))
      result.push((-c + sqrt_delta) / (2 * b))
    } else {
      result.push(-c / (2 * b))
    }
    return result
  }

  let frac_1_3 = 1 / 3

  let bn = b / a
  let cn = c / a
  let dn = d / a

  let delta0 = (3 * cn - bn * bn) / 9
  let delta1 = (9 * bn * cn - 27 * dn - 2 * bn * bn * bn) / 54
  let delta_01 = delta0 * delta0 * delta0 + delta1 * delta1

  if (delta_01 >= 0) {
    let delta_p_sqrt = delta1 + Math.sqrt(delta_01)
    let delta_m_sqrt = delta1 - Math.sqrt(delta_01)

    let s = Math.sign(delta_p_sqrt) * Math.pow(Math.abs(delta_p_sqrt), frac_1_3)
    let t = Math.sign(delta_m_sqrt) * Math.pow(Math.abs(delta_m_sqrt), frac_1_3)

    result.push(-bn * frac_1_3 + (s + t))

    // Don't add the repeated root when s + t === 0
    if (Math.abs(s - t) < EPSILON && Math.abs(s + t) >= EPSILON) {
      result.push(-bn * frac_1_3 - (s + t) / 2)
    }
  } else {
    let theta = Math.acos(delta1 / Math.sqrt(-delta0 * delta0 * delta0))
    let two_sqrt_delta0 = 2 * Math.sqrt(-delta0)
    result.push(two_sqrt_delta0 * Math.cos(theta * frac_1_3) - bn * frac_1_3)
    result.push(two_sqrt_delta0 * Math.cos((theta + 2 * PI) * frac_1_3) - bn * frac_1_3)
    result.push(two_sqrt_delta0 * Math.cos((theta + 4 * PI) * frac_1_3) - bn * frac_1_3)
  }

  return result
}
