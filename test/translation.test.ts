import { Translation2D } from '../src/translation'
import { Rect, rect } from '../src/euclid'
import { test_macros } from '@rusts/std'
const { assert, assert_eq, assert_ne } = test_macros

describe('Translation2D', () => {
  test('simple', () => {
    enum A {}
    enum B {}

    let tx = new Translation2D<A, B>(10, -10)
    let r1: Rect<A> = rect(10, 20, 30, 40)
    let r2: Rect<B> = tx.transform_rect(r1)
    assert_eq(r2, rect(20, 10, 30, 40))

    let inv_tx = tx.inverse()
    assert_eq(inv_tx.transform_rect(r2), r1)

    assert(tx.add(inv_tx).is_identity())
  })
})
