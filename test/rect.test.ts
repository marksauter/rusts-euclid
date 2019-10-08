import { Rect, rect, Point2D, point2, vec2, sideoff2, Size2D, size2 } from '../src/euclid'
import { test_macros } from '@rusts/std'
const { assert, assert_eq } = test_macros

describe('Rect', () => {
  test('translate', () => {
    let p = new Rect(point2(0, 0), size2(50, 40))
    let pp = p.translate(vec2(10, 15))

    assert_eq(pp.size.width, 50)
    assert_eq(pp.size.height, 40)
    assert_eq(pp.origin.x, 10)
    assert_eq(pp.origin.y, 15)

    let r = new Rect(point2(-10, -5), size2(50, 40))
    let rr = r.translate(vec2(0, -10))

    assert_eq(rr.size.width, 50)
    assert_eq(rr.size.height, 40)
    assert_eq(rr.origin.x, -10)
    assert_eq(rr.origin.y, -15)
  })

  test('union', () => {
    let p = new Rect(point2(0, 0), size2(50, 40))
    let q = new Rect(point2(20, 20), size2(5, 5))
    let r = new Rect(point2(-15, -30), size2(200, 15))
    let s = new Rect(point2(20, -15), size2(250, 200))

    let pq = p.union(q)
    assert_eq(pq.origin, point2(0, 0))
    assert_eq(pq.size, size2(50, 40))

    let pr = p.union(r)
    assert_eq(pr.origin, point2(-15, -30))
    assert_eq(pr.size, size2(200, 70))

    let ps = p.union(s)
    assert_eq(ps.origin, point2(0, -15))
    assert_eq(ps.size, size2(270, 200))
  })
  test('intersects', () => {
    let p = new Rect(point2(0, 0), size2(10, 20))
    let q = new Rect(point2(5, 15), size2(10, 10))
    let r = new Rect(point2(-5, -5), size2(8, 8))

    assert(p.intersects(q))
    assert(!q.intersects(r))
  })

  test('intersection', () => {
    let p = new Rect(point2(0, 0), size2(10, 20))
    let q = new Rect(point2(5, 15), size2(10, 10))
    let r = new Rect(point2(-5, -5), size2(8, 8))

    let pq_opt = p.intersection(q)
    assert(pq_opt.is_some())
    let pq = pq_opt.unwrap()
    expect(pq.origin.eq(point2(5, 15)))
    expect(pq.size.eq(size2(5, 5)))

    let pr_opt = p.intersection(r)
    assert(pr_opt.is_some())
    let pr = pr_opt.unwrap()
    expect(pr.origin.eq(point2(0, 0)))
    expect(pr.size.eq(size2(3, 3)))

    let qr_opt = q.intersection(r)
    assert(qr_opt.is_none())
  })

  test('contains', () => {
    let r = new Rect(point2(-20, 15), size2(100, 200))

    assert(r.contains(point2(0, 50)))
    assert(r.contains(point2(-10, 200)))

    // The `contains` method is inclusive of the top/left edges, but not the
    // bottom/right edges
    assert(r.contains(point2(-20, 15)))
    assert(!r.contains(point2(80, 15)))
    assert(!r.contains(point2(80, 215)))
    assert(!r.contains(point2(-20, 215)))

    // Points beyond the top-left corner
    assert(!r.contains(point2(-25, 15)))
    assert(!r.contains(point2(-15, 10)))

    // Points beyond the top-right corner
    assert(!r.contains(point2(85, 20)))
    assert(!r.contains(point2(75, 10)))

    // Points beyond the bottom-right corner
    assert(!r.contains(point2(85, 210)))
    assert(!r.contains(point2(75, 220)))

    // Points beyond the bottom-left corner
    assert(!r.contains(point2(-25, 210)))
    assert(!r.contains(point2(-15, 220)))

    r = new Rect(point2(-20, 15), size2(100, 200))
    assert(r.contains_rect(r))
    assert(!r.contains_rect(r.translate(vec2(0.1, 0))))
    assert(!r.contains_rect(r.translate(vec2(-0.1, 0))))
    assert(!r.contains_rect(r.translate(vec2(0, 0.1))))
    assert(!r.contains_rect(r.translate(vec2(0, -0.1))))
    // Empty rectangles are always considered as contained in other rectanges,
    // even if their origin is not.
    let p = point2(1, 1)
    assert(!r.contains(p))
    assert(r.contains_rect(new Rect(p, Size2D.zero())))
  })

  test('scale', () => {
    let p = new Rect(point2(0, 0), size2(50, 40))
    let pp = p.scale(10, 15)

    assert_eq(pp.size.width, 500)
    assert_eq(pp.size.height, 600)
    assert_eq(pp.origin.x, 0)
    assert_eq(pp.origin.y, 0)

    let r = new Rect(point2(-10, -5), size2(50, 40))
    let rr = r.scale(1, 20)

    assert_eq(rr.size.width, 50)
    assert_eq(rr.size.height, 800)
    assert_eq(rr.origin.x, -10)
    assert_eq(rr.origin.y, -100)
  })

  test('inflate', () => {
    let p = new Rect(point2(0, 0), size2(10, 10))
    let pp = p.inflate(10, 20)

    assert_eq(pp.size.width, 30)
    assert_eq(pp.size.height, 50)
    assert_eq(pp.origin.x, -10)
    assert_eq(pp.origin.y, -20)

    let r = new Rect(point2(0, 0), size2(10, 20))
    let rr = r.inflate(-2, -5)

    assert_eq(rr.size.width, 6)
    assert_eq(rr.size.height, 10)
    assert_eq(rr.origin.x, 2)
    assert_eq(rr.origin.y, 5)
  })

  test('inner_outer_rect', () => {
    let inner_rect = new Rect(point2(20, 40), size2(80, 100))
    let offsets = sideoff2(20, 10, 10, 10)
    let outer_rect = inner_rect.outer_rect(offsets)
    assert_eq(outer_rect.origin.x, 10)
    assert_eq(outer_rect.origin.y, 20)
    assert_eq(outer_rect.size.width, 100)
    assert_eq(outer_rect.size.height, 130)
    assert_eq(outer_rect.inner_rect(offsets), inner_rect)
  })

  test('min_max_x_y', () => {
    let p = new Rect(point2(0, 0), size2(50, 40))
    assert_eq(p.max_y(), 40)
    assert_eq(p.min_y(), 0)
    assert_eq(p.max_x(), 50)
    assert_eq(p.min_x(), 0)

    let r = new Rect(point2(-10, -5), size2(50, 40))
    assert_eq(r.max_y(), 35)
    assert_eq(r.min_y(), -5)
    assert_eq(r.max_x(), 40)
    assert_eq(r.min_x(), -10)
  })

  test('is_empty', () => {
    assert(new Rect(point2(0, 0), size2(0, 0)).is_empty())
    assert(new Rect(point2(0, 0), size2(10, 0)).is_empty())
    assert(new Rect(point2(0, 0), size2(0, 10)).is_empty())
    assert(!new Rect(point2(0, 0), size2(1, 1)).is_empty())
    assert(new Rect(point2(10, 10), size2(0, 0)).is_empty())
    assert(new Rect(point2(10, 10), size2(10, 0)).is_empty())
    assert(new Rect(point2(10, 10), size2(0, 10)).is_empty())
    assert(!new Rect(point2(10, 10), size2(1, 1)).is_empty())
  })

  test('round', () => {
    let x = -2
    let y = -2
    let w = -2
    let h = -2
    while (x < 2) {
      while (y < 2) {
        while (w < 2) {
          while (h < 2) {
            let r = new Rect(point2(x, y), size2(w, h))

            assert(r.contains_rect(r.round_in()))
            assert(
              r
                .round_in()
                .inflate(1, 1)
                .contains_rect(r)
            )

            assert(r.round_out().contains_rect(r))
            assert(r.inflate(1, 1).contains_rect(r.round_out()))

            assert(r.inflate(1, 1).contains_rect(r.round()))
            assert(
              r
                .round()
                .inflate(1, 1)
                .contains_rect(r)
            )

            h += 0.1
          }
          w += 0.1
        }
        y += 0.1
      }
      x += 0.1
    }
  })

  test('center', () => {
    let r = rect(-2, 5, 4, 10)
    assert_eq(r.center(), point2(0, 10))

    r = rect(1, 2, 3, 4)
    assert_eq(r.center(), point2(2.5, 4))
  })
})
