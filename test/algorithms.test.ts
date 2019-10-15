import { Path, point, FillRule } from "../src/euclid";
import { hit_test_path } from "../src/algorithms";
const { assert, assert_eq, should_panic } = require("@rusts/std/dist/lib/macros.test");

describe("algorithms", () => {
  test("hit_test", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(1, 0));
    builder.line_to(point(1, 1));
    builder.line_to(point(0, 1));
    builder.close();
    builder.move_to(point(0.25, 0.25));
    builder.line_to(point(0.75, 0.75));
    builder.line_to(point(0.75, 0.75));
    builder.line_to(point(0.2, 0.75));
    builder.close();
    let path = builder.build();

    assert(!hit_test_path(point(-1, 0.5), path.iter(), FillRule.EvenOdd, 0.1));
    assert(!hit_test_path(point(2, 0.5), path.iter(), FillRule.EvenOdd, 0.1));
    assert(!hit_test_path(point(2, 0), path.iter(), FillRule.EvenOdd, 0.1));
    assert(!hit_test_path(point(0.5, -1), path.iter(), FillRule.EvenOdd, 0.1));
    assert(!hit_test_path(point(0.5, 2), path.iter(), FillRule.EvenOdd, 0.1));

    assert(!hit_test_path(point(0.5, 0.5), path.iter(), FillRule.EvenOdd, 0.1));
    assert(hit_test_path(point(0.5, 0.5), path.iter(), FillRule.NonZero, 0.1));
    assert(hit_test_path(point(0.2, 0.5), path.iter(), FillRule.EvenOdd, 0.1));
    assert(hit_test_path(point(0.8, 0.5), path.iter(), FillRule.EvenOdd, 0.1));
  });
});
