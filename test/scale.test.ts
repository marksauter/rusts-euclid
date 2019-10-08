import { Scale, scale } from '../src/scale'
import { test_macros } from '@rusts/std'
const { assert, assert_eq } = test_macros

enum Inch {}
enum Cm {}
enum Mm {}

describe('Scale', () => {
  test('simple', () => {
    let mm_per_inch: Scale<Inch, Mm> = new Scale(25.4)
    let cm_per_mm: Scale<Mm, Cm> = new Scale(0.1)

    let mm_per_cm: Scale<Cm, Mm> = cm_per_mm.inv()
    assert_eq(mm_per_cm.get(), 10)

    let cm_per_inch: Scale<Inch, Cm> = mm_per_inch.mul(cm_per_mm)
    assert_eq(cm_per_inch, new Scale(2.54))

    let a: Scale<Inch, Inch> = new Scale(2)
    let b: Scale<Inch, Inch> = new Scale(3)
    assert(!a.eq(b))
    assert_eq(a, a.clone())
    assert_eq(a.clone().add(b.clone()), new Scale(5))
    assert_eq(a.sub(b), new Scale(-1))
  })
})
