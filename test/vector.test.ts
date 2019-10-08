import { BoolVector2D, bvec2, Vector2D, vec2 } from '../src/vector'
import {
  // scale.ts
  Scale,
  // scalar.ts
  approx_eq,
  // point.ts
  point2
} from '../src/euclid'
import { FRAC_PI_2 } from '@rusts/std'
import { test_macros } from '@rusts/std'
const { assert, assert_eq, assert_ne } = test_macros

describe('Vector2D', () => {
  test('scalar_mul', () => {
    let v = vec2(3, 5)

    let result = v.mul(5)

    assert_eq(result, vec2(15, 25))
  })

  test('dot', () => {
    let v1 = vec2(2, 7)
    let v2 = vec2(13, 11)
    assert_eq(v1.dot(v2), 103)
  })

  test('cross', () => {
    let v1 = vec2(4, 7)
    let v2 = vec2(13, 8)
    assert_eq(v1.cross(v2), -59)
  })

  test('normalize', () => {
    let v0 = Vector2D.zero()
    let v1 = vec2(4, 0)
    let v2 = vec2(3, -4)
    let v0_norm = v0.normalize()
    assert(isNaN(v0_norm.x) && isNaN(v0_norm.y))
    assert_eq(v1.normalize(), vec2(1, 0))
    assert_eq(v2.normalize(), vec2(0.6, -0.8))

    let v3 = vec2(Number.MAX_VALUE, Number.MAX_VALUE)
    assert_ne(v3.normalize(), vec2(1 / Math.sqrt(2), 1 / Math.sqrt(2)))
    assert_eq(v3.robust_normalize(), vec2(1 / Math.sqrt(2), 1 / Math.sqrt(2)))
  })

  test('min', () => {
    let v1 = vec2(1, 3)
    let v2 = vec2(2, 2)

    let result = v1.min(v2)

    assert_eq(result, vec2(1, 2))
  })

  test('max', () => {
    let v1 = vec2(1, 3)
    let v2 = vec2(2, 2)

    let result = v1.max(v2)

    assert_eq(result, vec2(2, 3))
  })

  test('angle_from_x_axis', () => {
    let right = vec2(10, 0)
    let down = vec2(0, 4)
    let up = vec2(0, -1)

    assert(approx_eq(right.angle_from_x_axis().get(), 0))
    assert(approx_eq(down.angle_from_x_axis().get(), FRAC_PI_2))
    assert(approx_eq(up.angle_from_x_axis().get(), -FRAC_PI_2))
  })

  enum Mm {}
  enum Cm {}

  type Vec2Mm = Vector2D<Mm>
  type Vec2Cm = Vector2D<Cm>

  test('add', () => {
    let v1: Vec2Mm = vec2(1, 2)
    let v2: Vec2Mm = vec2(3, 4)

    let result = v1.add(v2)

    assert_eq(v1, vec2(1, 2))
    assert_eq(result, vec2(4, 6))
  })

  test('add_assign', () => {
    let v: Vec2Mm = vec2(1, 2)
    v.add_assign(vec2(3, 4))

    assert_eq(v, vec2(4, 6))
  })

  test('sub', () => {
    let v1: Vec2Mm = vec2(3, 4)
    let v2: Vec2Mm = vec2(1, 2)

    let result = v1.sub(v2)

    assert_eq(v1, vec2(3, 4))
    assert_eq(result, vec2(2, 2))
  })

  test('sub_assign', () => {
    let v = vec2(3, 4)
    v.sub_assign(vec2(1, 2))

    assert_eq(v, vec2(2, 2))
  })

  test('mul', () => {
    let v = vec2(2, 2)

    let result = v.mul(2)

    assert_eq(v, vec2(2, 2))
    assert_eq(result, vec2(4, 4))
  })

  test('mul_assign', () => {
    let v = vec2(2, 2)
    v.mul_assign(2)

    assert_eq(v, vec2(4, 4))
  })

  test('div', () => {
    let v = vec2(4, 4)

    let result = v.div(2)

    assert_eq(v, vec2(4, 4))
    assert_eq(result, vec2(2, 2))
  })

  test('div_assign', () => {
    let v = vec2(4, 4)
    v.div_assign(2)

    assert_eq(v, vec2(2, 2))
  })

  test('typed_scalar_mul', () => {
    let v1: Vec2Mm = vec2(1, 2)
    let cm_per_mm = new Scale<Mm, Cm>(0.1)

    let result: Vec2Cm = v1.mul(cm_per_mm)

    assert_eq(result, vec2(0.1, 0.2))
  })

  test('lerp', () => {
    let v1 = vec2(-10, -10)
    let v2 = vec2(10, 10)
    let v = v1.lerp(v2, 0.5)
    assert_eq(v, Vector2D.zero())
  })

  test('swizzling', () => {
    let v = vec2(1, 2)
    assert_eq(v.yx(), vec2(2, 1))
  })
})

describe('BoolVector2D', () => {
  test('bvec2', () => {
    assert_eq(vec2(1, 2).greater_than(vec2(2, 1)), bvec2(false, true))

    assert_eq(vec2(1, 2).lower_than(vec2(2, 1)), bvec2(true, false))

    assert_eq(vec2(1, 2).equal(vec2(1, 3)), bvec2(true, false))

    assert_eq(vec2(1, 2).not_equal(vec2(1, 3)), bvec2(false, true))

    assert(bvec2(true, true).any())
    assert(bvec2(false, true).any())
    assert(bvec2(true, false).any())
    assert(!bvec2(false, false).any())
    assert(bvec2(false, false).none())
    assert(bvec2(true, true).all())
    assert(!bvec2(false, true).all())
    assert(!bvec2(true, false).all())
    assert(!bvec2(false, false).all())

    assert_eq(bvec2(true, false).not(), bvec2(false, true))
    assert_eq(bvec2(true, false).and(bvec2(true, true)), bvec2(true, false))
    assert_eq(bvec2(true, false).or(bvec2(true, true)), bvec2(true, true))

    assert_eq(bvec2(true, false).select_point(point2(1, 2), point2(3, 4)), point2(1, 4))

    assert_eq(bvec2(true, false).select_vector(vec2(1, 2), vec2(3, 4)), vec2(1, 4))
  })
})
