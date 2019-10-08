import { range } from '@rusts/std'
import {
  NonEmptyRect,
  NonEmptyBox2D,
  Box2D,
  box2 as box,
  point2,
  Rect,
  size2,
  vec2
} from '../src/euclid'
import { test_macros } from '@rusts/std'
const { assert, assert_eq } = test_macros

describe('NonEmpty', () => {
  test('empty_nonempty', () => {
    // zero-width
    let box1 = box(point2(-10, 2), point2(-10, 12))
    // zero-height
    let box2 = box(point2(0, 11), point2(2, 11))
    // negative width
    let box3 = box(point2(1, 11), point2(0, 12))
    // negative height
    let box4 = box(point2(0, 11), point2(5, 10))

    assert(box1.to_non_empty().is_none())
    assert(box2.to_non_empty().is_none())
    assert(box3.to_non_empty().is_none())
    assert(box4.to_non_empty().is_none())
  })

  test('nonempty_union', () => {
    let box1 = box(point2(-10, 2), point2(15, 12))
    let box2 = box(point2(-2, -5), point2(10, 5))

    assert_eq(
      box1.union(box2),
      box1
        .to_non_empty()
        .unwrap()
        .union(box2.to_non_empty().unwrap())
        .get()
    )

    let rect1 = new Rect(point2(1, 2), size2(3, 4))
    let rect2 = new Rect(point2(-1, 5), size2(1, 10))

    assert_eq(
      rect1.union(rect2),
      rect1
        .to_non_empty()
        .unwrap()
        .union(rect2.to_non_empty().unwrap())
        .get()
    )
  })

  test('nonempty_contains', () => {
    let r = new Rect(point2(-20, 15), size2(100, 200)).to_non_empty().unwrap()

    assert(r.contains_rect(r))
    assert(!r.contains_rect(r.translate(vec2(1, 0))))
    assert(!r.contains_rect(r.translate(vec2(-1, 0))))
    assert(!r.contains_rect(r.translate(vec2(0, 1))))
    assert(!r.contains_rect(r.translate(vec2(0, -1))))

    let b = new Box2D(point2(-10, 5), point2(30, 100)).to_non_empty().unwrap()

    assert(b.contains_box(b))
    assert(!b.contains_box(b.translate(vec2(1, 0))))
    assert(!b.contains_box(b.translate(vec2(-1, 0))))
    assert(!b.contains_box(b.translate(vec2(0, 1))))
    assert(!b.contains_box(b.translate(vec2(0, -1))))
  })
})
