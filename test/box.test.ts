import { range } from '@rusts/std'
import { Box2D, box2, Point2D, point2, vec2, sideoff2, size2 } from '../src/euclid'
import { test_macros } from '@rusts/std'
const { assert, assert_eq } = test_macros

describe('Box2D', () => {
  test('size', () => {
    let b = box2(point2(-10, -10), point2(10, 10))
    assert_eq(b.size().width, 20)
    assert_eq(b.size().height, 20)
  })

  test('center', () => {
    let b = box2(point2(-10, -10), point2(10, 10))
    assert_eq(b.center(), Point2D.zero())
  })

  test('area', () => {
    let b = box2(point2(-10, -10), point2(10, 10))
    assert_eq(b.area(), 400)
  })

  test('from_points', () => {
    let b = Box2D.from_points([point2(50, 160), point2(100, 25)])
    assert_eq(b.min, point2(50, 25))
    assert_eq(b.max, point2(100, 160))
  })

  test('round_in', () => {
    let b = Box2D.from_points([point2(-25.5, -40.4), point2(60.3, 36.5)]).round_in()
    assert_eq(b.min.x, -25)
    assert_eq(b.min.y, -40)
    assert_eq(b.max.x, 60)
    assert_eq(b.max.y, 36)
  })

  test('round_out', () => {
    let b = Box2D.from_points([point2(-25.5, -40.4), point2(60.3, 36.5)]).round_out()
    assert_eq(b.min.x, -26)
    assert_eq(b.min.y, -41)
    assert_eq(b.max.x, 61)
    assert_eq(b.max.y, 37)
  })

  test('round', () => {
    let b = Box2D.from_points([point2(-25.5, -40.4), point2(60.3, 36.5)]).round()
    assert_eq(b.min.x, -25)
    assert_eq(b.min.y, -40)
    assert_eq(b.max.x, 60)
    assert_eq(b.max.y, 37)
  })

  test('from_size', () => {
    let b = Box2D.from_size(size2(30, 40))
    assert_eq(b.min, Point2D.zero())
    assert_eq(b.size().width, 30)
    assert_eq(b.size().height, 40)
  })

  test('inner_box', () => {
    let b = Box2D.from_points([point2(50, 25), point2(100, 160)])
    b = b.inner_box(sideoff2(10, 20, 5, 10))
    assert_eq(b.max.x, 80)
    assert_eq(b.max.y, 155)
    assert_eq(b.min.x, 60)
    assert_eq(b.min.y, 35)
  })

  test('outer_box', () => {
    let b = Box2D.from_points([point2(50, 25), point2(100, 160)])
    b = b.outer_box(sideoff2(10, 20, 5, 10))
    assert_eq(b.max.x, 120)
    assert_eq(b.max.y, 165)
    assert_eq(b.min.x, 40)
    assert_eq(b.min.y, 15)
  })

  test('translate', () => {
    let size = size2(15, 15)
    let center = size
      .div(2.0)
      .to_vector()
      .to_point()
    let b = Box2D.from_size(size)
    assert_eq(b.center(), center)
    let translation = vec2(10, 2.5)
    b = b.translate(translation)
    center.add_assign(translation)
    assert_eq(b.center(), center)
    assert_eq(b.max.x, 25)
    assert_eq(b.max.y, 17.5)
    assert_eq(b.min.x, 10)
    assert_eq(b.min.y, 2.5)
  })

  test('union', () => {
    let b1 = Box2D.from_points([point2(-20, -20), point2(0, 20)])
    let b2 = Box2D.from_points([point2(0, 20), point2(20, -20)])
    let b = b1.union(b2)
    assert_eq(b.max.x, 20)
    assert_eq(b.max.y, 20)
    assert_eq(b.min.x, -20)
    assert_eq(b.min.y, -20)
  })

  test('intersects', () => {
    let b1 = Box2D.from_points([point2(-15, -20), point2(10, 20)])
    let b2 = Box2D.from_points([point2(-10, 20), point2(15, -20)])
    assert(b1.intersects(b2))
  })

  test('intersection', () => {
    let b1 = Box2D.from_points([point2(-15, -20), point2(10, 20)])
    let b2 = Box2D.from_points([point2(-10, 20), point2(15, -20)])
    let b = b1.intersection(b2)
    assert_eq(b.max.x, 10)
    assert_eq(b.max.y, 20)
    assert_eq(b.min.x, -10)
    assert_eq(b.min.y, -20)
  })

  test('try_intersection', () => {
    let b1 = Box2D.from_points([point2(-15, -20), point2(10, 20)])
    let b2 = Box2D.from_points([point2(-10, 20), point2(15, -20)])
    assert(b1.try_intersection(b2).is_some())

    b1 = Box2D.from_points([point2(-15, -20), point2(-10, 20)])
    b2 = Box2D.from_points([point2(10, 20), point2(15, -20)])
    assert(b1.try_intersection(b2).is_none())
  })

  test('scale', () => {
    let b = Box2D.from_points([point2(-10, -10), point2(10, 10)])
    b = b.scale(0.5, 0.5)
    assert_eq(b.max.x, 5)
    assert_eq(b.max.y, 5)
    assert_eq(b.min.x, -5)
    assert_eq(b.min.y, -5)
  })

  test('lerp', () => {
    let b1 = Box2D.from_points([point2(-20, -20), point2(-10, -10)])
    let b2 = Box2D.from_points([point2(10, 10), point2(20, 20)])
    let b = b1.lerp(b2, 0.5)
    assert_eq(b.center().x, 0)
    assert_eq(b.center(), Point2D.origin())
    assert_eq(b.size().width, 10)
    assert_eq(b.size().height, 10)
  })

  test('contains', () => {
    let b = Box2D.from_points([point2(-20, -20), point2(20, 20)])
    assert(b.contains(point2(-15.3, 10.5)))
  })

  test('contains_box', () => {
    let b1 = Box2D.from_points([point2(-20, -20), point2(20, 20)])
    let b2 = Box2D.from_points([point2(-14.3, -16.5), point2(6.7, 17.6)])
    assert(b1.contains_box(b2))
  })

  test('inflate', () => {
    let b = Box2D.from_points([point2(-20, -20), point2(20, 20)])
    b = b.inflate(10, 5)
    assert_eq(b.size().width, 60)
    assert_eq(b.size().height, 50)
    assert_eq(b.center(), Point2D.origin())
  })

  test('is_empty', () => {
    for (let n of range(0, 2)) {
      let coord_neg = [-20, -20]
      let coord_pos = [20, 20]
      coord_neg[n] = 0
      coord_pos[n] = 0
      let b = Box2D.from_points([Point2D.from_array(coord_neg), Point2D.from_array(coord_pos)])
      assert(b.is_empty())
    }
  })
})
