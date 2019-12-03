import { Some, None, range } from "@rusts/std";
import {
  FromPolyline,
  FlattenedEvent,
  Path,
  Subpath,
  PathEvent,
  point,
  rect,
  BezierSegment,
  QuadraticBezierSegment,
  CubicBezierSegment,
  LineSegment
} from "../src/internal";
const { assert, assert_eq, should_panic } = require("@rusts/std/dist/lib/macros.test");

describe("Subpath", () => {
  test("flip", () => {
    let builder = Subpath.builder();
    builder.move_to(point(10, 0));
    builder.line_to(point(11, 0));
    builder.line_to(point(11, 1));
    builder.line_to(point(10, 1));
    builder.close();

    let p1 = builder.build_and_reset();
    let p2 = p1.flip();

    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(10, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(10, 1), point(11, 1)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(11, 1), point(11, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(11, 0), point(10, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(10, 0), point(10, 1)))));

    assert_eq(it.next(), None());

    builder.move_to(point(20, 0));
    builder.quadratic_bezier_to(point(21, 0), point(21, 1));
    builder.close();

    p1 = builder.build_and_reset();
    p2 = p1.flip();

    it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(21, 1))));
    assert_eq(
      it.next(),
      Some(
        PathEvent.Quadratic(new QuadraticBezierSegment(point(21, 1), point(21, 0), point(20, 0)))
      )
    );
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(20, 0), point(21, 1)))));

    assert_eq(it.next(), None());
  });

  test("flip_no_close", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(1, 0));
    builder.line_to(point(1, 1));

    let p1 = builder.build();
    let p2 = p1.flip();

    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(0, 0)))));
    assert_eq(it.next(), None());
  });

  test("flip_empty_path", () => {
    let p1 = Subpath.builder().build();
    let p2 = p1.flip();
    assert_eq(p2.iter().next(), None());
  });

  test("flip_single_moveto", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    let p1 = builder.build();
    let p2 = p1.flip();
    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());
  });

  test("iterator", () => {
    let p = Subpath.builder();
    p.line_to(point(1, 0));
    p.line_to(point(2, 0));
    p.line_to(point(3, 0));
    p.quadratic_bezier_to(point(4, 0), point(4, 1));
    p.cubic_bezier_to(point(5, 0), point(5, 1), point(5, 2));
    p.close();

    let path = p.build();

    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next_back(), Some(PathEvent.Close(new LineSegment(point(5, 2), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(2, 0)))));
    assert_eq(
      it.next_back(),
      Some(
        PathEvent.Cubic(new CubicBezierSegment(point(4, 1), point(5, 0), point(5, 1), point(5, 2)))
      )
    );
    assert_eq(
      it.next_back(),
      Some(PathEvent.Quadratic(new QuadraticBezierSegment(point(3, 0), point(4, 0), point(4, 1))))
    );
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 0), point(3, 0)))));

    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
    assert_eq(it.next_back(), None());
    assert_eq(it.next_back(), None());
  });

  test("builder_empty", () => {
    let path = Subpath.builder().build();
    let it = path.iter();
    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
  });

  test("builder_empty_move_to", () => {
    let p = Subpath.builder();
    p.move_to(point(1, 2));
    p.move_to(point(3, 4));
    p.move_to(point(5, 6));

    let path = p.build();
    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 6))));
    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
  });

  test("nth_segment", () => {
    let builder = Subpath.builder();

    builder.move_to(point(0, 0));
    builder.line_to(point(1, 1));
    builder.quadratic_bezier_to(point(2, 2), point(4, 2));
    builder.cubic_bezier_to(point(5, 3), point(6, 4), point(8, 3));
    builder.close();

    let path = builder.build();
    assert_eq(
      path.nth_segment(0).unwrap(),
      BezierSegment.Linear(new LineSegment(point(0, 0), point(1, 1)))
    );
    assert_eq(
      path.nth_segment(1).unwrap(),
      BezierSegment.Quadratic(new QuadraticBezierSegment(point(1, 1), point(2, 2), point(4, 2)))
    );
    assert_eq(
      path.nth_segment(2).unwrap(),
      BezierSegment.Cubic(
        new CubicBezierSegment(point(4, 2), point(5, 3), point(6, 4), point(8, 3))
      )
    );
  });

  test("segment_count", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 0));
    builder.line_to(point(5, 5));
    builder.close();

    let path = builder.build_and_reset();
    assert_eq(path.segment_count(), 3);

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.line_to(point(1, 1));
    builder.close();

    path = builder.build_and_reset();
    assert_eq(path.segment_count(), 3);

    builder.move_to(point(0, 0));
    builder.line_to(point(1, 1));
    builder.quadratic_bezier_to(point(2, 2), point(4, 2));
    builder.cubic_bezier_to(point(5, 3), point(6, 4), point(8, 3));

    path = builder.build_and_reset();
    assert_eq(path.segment_count(), 3);
  });

  test("append_paths", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 0));
    builder.line_to(point(5, 5));
    builder.close();

    let path1 = builder.build_and_reset();

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.close();

    let path2 = builder.build();

    let path = path1.append(path2);

    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(1, 1)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(0, 0)))));
    assert_eq(it.next(), None());
  });

  test("prev_cursor", () => {
    let builder = Subpath.builder();
    let start = builder.cursor();
    builder.move_to(point(1, 1));
    builder.line_to(point(2, 1));
    builder.quadratic_bezier_to(point(2, 2), point(3, 2));
    builder.cubic_bezier_to(point(4, 1), point(5, 2), point(6, 1));
    let c = builder.cursor();

    assert_eq(start.event(), PathEvent.MoveTo(point(1, 1)));

    assert_eq(
      c.event(),
      PathEvent.Cubic(new CubicBezierSegment(point(3, 2), point(4, 1), point(5, 2), point(6, 1)))
    );

    assert(c.previous());

    assert_eq(
      c.event(),
      PathEvent.Quadratic(new QuadraticBezierSegment(point(2, 1), point(2, 2), point(3, 2)))
    );

    assert(c.previous());

    assert_eq(c.event(), PathEvent.Line(new LineSegment(point(1, 1), point(2, 1))));

    assert(c.previous());

    assert_eq(c, start);
    assert_eq(c.event(), PathEvent.MoveTo(point(1, 1)));

    assert(!c.previous());
  });

  test("simple_bounding_rect", () => {
    let builder = Subpath.builder();
    builder.move_to(point(-10, -3));
    builder.line_to(point(0, -12));
    builder.quadratic_bezier_to(point(3, 4), point(5, 3));
    builder.close();
    let path = builder.build_and_reset();

    assert_eq(path.fast_bounding_rect(), rect(-10, -12, 15, 16));

    builder.move_to(point(0, 0));
    builder.cubic_bezier_to(point(-1, 2), point(3, -4), point(1, -1));
    path = builder.build();

    assert_eq(path.fast_bounding_rect(), rect(-1, -4, 4, 6));
  });

  test("split_empty", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));

    let path = builder.build();
    let it = path.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
  });

  test("split_out_of_range", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    let path = builder.build();

    should_panic(() => path.split(4));
  });

  test("split", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    let path = builder.build_and_reset();

    let [path1, path2] = path.split(0);

    let it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), None());

    let it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(1);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(1.5);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(3);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it2.next(), None());
  });

  test("split_no_close", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.line_to(point(0, 0));

    let path = builder.build_and_reset();

    let [path1, path2] = path.split(0);

    let it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), None());

    let it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(3);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it2.next(), None());
  });

  test("before_split", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.before_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.before_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), None());

    p = path.before_split(1.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.before_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());
  });

  test("before_split_no_close", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.line_to(point(0, 0));

    let path = builder.build_and_reset();

    let p = path.before_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.before_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());
  });

  test("after_split", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.after_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.after_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.after_split(1.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.after_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());
  });

  test("after_split_no_close", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.line_to(point(0, 0));

    let path = builder.build_and_reset();

    let p = path.after_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.after_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());
  });

  test("split_range", () => {
    let builder = Subpath.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.split_range(range(0, 0));

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 1));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1, 2));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1.5, 2.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(2.5, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(3, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());
  });
});

describe("Path", () => {
  test("flip", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(1, 0));
    builder.line_to(point(1, 1));
    builder.line_to(point(0, 1));

    builder.move_to(point(10, 0));
    builder.line_to(point(11, 0));
    builder.line_to(point(11, 1));
    builder.line_to(point(10, 1));
    builder.close();

    builder.move_to(point(20, 0));
    builder.quadratic_bezier_to(point(21, 0), point(21, 1));

    let p1 = builder.build();
    let p2 = p1.flip();

    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(21, 1))));
    assert_eq(
      it.next(),
      Some(
        PathEvent.Quadratic(new QuadraticBezierSegment(point(21, 1), point(21, 0), point(20, 0)))
      )
    );

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(10, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(10, 1), point(11, 1)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(11, 1), point(11, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(11, 0), point(10, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(10, 0), point(10, 1)))));

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 1), point(1, 1)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(0, 0)))));

    assert_eq(it.next(), None());
  });

  test("flip_no_close", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(1, 0));
    builder.line_to(point(1, 1));

    let p1 = builder.build();
    let p2 = p1.flip();

    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(0, 0)))));
    assert_eq(it.next(), None());
  });

  test("flip_empty_path", () => {
    let p1 = Path.builder().build();
    let p2 = p1.flip();
    assert_eq(p2.iter().next(), None());
  });

  test("flip_single_moveto", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    let p1 = builder.build();
    let p2 = p1.flip();
    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());
  });

  test("iterator", () => {
    let p = Path.builder();
    p.line_to(point(1, 0));
    p.line_to(point(2, 0));
    p.line_to(point(3, 0));
    p.quadratic_bezier_to(point(4, 0), point(4, 1));
    p.cubic_bezier_to(point(5, 0), point(5, 1), point(5, 2));
    p.close();

    p.move_to(point(10, 0));
    p.line_to(point(11, 0));
    p.line_to(point(12, 0));
    p.line_to(point(13, 0));
    p.quadratic_bezier_to(point(14, 0), point(14, 1));
    p.cubic_bezier_to(point(15, 0), point(15, 1), point(15, 2));
    p.close();

    p.move_to(point(1, 1));
    p.move_to(point(2, 2));
    p.move_to(point(3, 3));
    p.line_to(point(4, 4));

    let path = p.build();

    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(1, 0)))));

    assert_eq(it.next_back(), Some(PathEvent.Line(new LineSegment(point(3, 3), point(4, 4)))));
    assert_eq(it.next_back(), Some(PathEvent.MoveTo(point(3, 3))));

    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(2, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 0), point(3, 0)))));
    assert_eq(
      it.next(),
      Some(PathEvent.Quadratic(new QuadraticBezierSegment(point(3, 0), point(4, 0), point(4, 1))))
    );
    assert_eq(
      it.next(),
      Some(
        PathEvent.Cubic(new CubicBezierSegment(point(4, 1), point(5, 0), point(5, 1), point(5, 2)))
      )
    );

    assert_eq(it.next_back(), Some(PathEvent.Close(new LineSegment(point(15, 2), point(10, 0)))));

    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 2), point(0, 0)))));

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(10, 0))));
    assert_eq(
      it.next_back(),
      Some(
        PathEvent.Cubic(
          new CubicBezierSegment(point(14, 1), point(15, 0), point(15, 1), point(15, 2))
        )
      )
    );
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(10, 0), point(11, 0)))));
    assert_eq(
      it.next_back(),
      Some(
        PathEvent.Quadratic(new QuadraticBezierSegment(point(13, 0), point(14, 0), point(14, 1)))
      )
    );
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(11, 0), point(12, 0)))));
    assert_eq(it.next_back(), Some(PathEvent.Line(new LineSegment(point(12, 0), point(13, 0)))));

    assert_eq(it.next(), None());
    assert_eq(it.next_back(), None());
    assert_eq(it.next(), None());
    assert_eq(it.next_back(), None());
  });

  test("subpaths", () => {
    let p = Path.builder();
    p.line_to(point(1, 0));
    p.line_to(point(2, 0));
    p.line_to(point(3, 0));
    p.quadratic_bezier_to(point(4, 0), point(4, 1));
    p.cubic_bezier_to(point(5, 0), point(5, 1), point(5, 2));
    p.close();

    p.move_to(point(1, 1));
    p.move_to(point(2, 2));
    p.move_to(point(10, 0));
    p.line_to(point(11, 0));
    p.line_to(point(12, 0));
    p.line_to(point(13, 0));
    p.quadratic_bezier_to(point(14, 0), point(14, 1));
    p.cubic_bezier_to(point(15, 0), point(15, 1), point(15, 2));
    p.close();

    p.move_to(point(3, 3));
    p.line_to(point(4, 4));

    let path = p.build();
    let subpaths = path.subpaths();

    let it = subpaths
      .next()
      .unwrap()
      .iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(2, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 0), point(3, 0)))));
    assert_eq(
      it.next(),
      Some(PathEvent.Quadratic(new QuadraticBezierSegment(point(3, 0), point(4, 0), point(4, 1))))
    );
    assert_eq(
      it.next(),
      Some(
        PathEvent.Cubic(new CubicBezierSegment(point(4, 1), point(5, 0), point(5, 1), point(5, 2)))
      )
    );
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 2), point(0, 0)))));
    assert_eq(it.next(), None());

    it = subpaths
      .next_back()
      .unwrap()
      .iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(3, 3))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(3, 3), point(4, 4)))));
    assert_eq(it.next(), None());

    it = subpaths
      .next()
      .unwrap()
      .iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(10, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(10, 0), point(11, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(11, 0), point(12, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(12, 0), point(13, 0)))));
    assert_eq(
      it.next(),
      Some(
        PathEvent.Quadratic(new QuadraticBezierSegment(point(13, 0), point(14, 0), point(14, 1)))
      )
    );
    assert_eq(
      it.next(),
      Some(
        PathEvent.Cubic(
          new CubicBezierSegment(point(14, 1), point(15, 0), point(15, 1), point(15, 2))
        )
      )
    );
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(15, 2), point(10, 0)))));
    assert_eq(it.next(), None());

    assert_eq(subpaths.next(), None());
    assert_eq(subpaths.next_back(), None());
  });

  test("path_builder_empty", () => {
    let path = Path.builder().build();
    let it = path.iter();
    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
  });

  test("path_builder_empty_move_to", () => {
    let p = Path.builder();
    p.move_to(point(1, 2));
    p.move_to(point(3, 4));
    p.move_to(point(5, 6));

    let path = p.build();
    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 6))));
    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
  });

  test("path_builder_line_to_after_close", () => {
    let p = Path.builder();
    p.line_to(point(1, 0));
    p.close();
    p.line_to(point(2, 0));

    let path = p.build();
    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(1, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(2, 0)))));
    assert_eq(it.next(), None());
  });

  test("append_paths", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 0));
    builder.line_to(point(5, 5));
    builder.close();

    let path1 = builder.build();

    builder = Path.builder();
    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.close();

    let path2 = builder.build();

    let path = path1.append(path2);

    let it = path.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 5), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());
  });

  test("prev_cursor", () => {
    let builder = Path.builder();
    let start1 = builder.cursor();
    builder.move_to(point(1, 1));
    builder.line_to(point(2, 1));
    builder.quadratic_bezier_to(point(2, 2), point(3, 2));
    builder.cubic_bezier_to(point(4, 1), point(5, 2), point(6, 1));
    let c1 = builder.cursor();
    builder.move_to(point(11, 1));
    let start2 = builder.cursor();
    builder.line_to(point(12, 1));
    builder.quadratic_bezier_to(point(12, 2), point(13, 2));
    builder.cubic_bezier_to(point(14, 1), point(15, 2), point(16, 1));
    let c2 = builder.cursor();

    assert_eq(start1.event(), PathEvent.MoveTo(point(1, 1)));
    assert_eq(start2.event(), PathEvent.MoveTo(point(11, 1)));

    assert_eq(
      c1.event(),
      PathEvent.Cubic(new CubicBezierSegment(point(3, 2), point(4, 1), point(5, 2), point(6, 1)))
    );
    assert_eq(
      c2.event(),
      PathEvent.Cubic(
        new CubicBezierSegment(point(13, 2), point(14, 1), point(15, 2), point(16, 1))
      )
    );

    assert(c1.previous());
    assert(c2.previous());
    assert_eq(c1.first_vertex, start1.vertex);
    assert_eq(c1.first_verb, start1.verb);

    assert_eq(
      c1.event(),
      PathEvent.Quadratic(new QuadraticBezierSegment(point(2, 1), point(2, 2), point(3, 2)))
    );
    assert_eq(
      c2.event(),
      PathEvent.Quadratic(new QuadraticBezierSegment(point(12, 1), point(12, 2), point(13, 2)))
    );

    assert(c1.previous());
    assert(c2.previous());
    assert_eq(c1.first_vertex, start1.vertex);
    assert_eq(c1.first_verb, start1.verb);

    assert_eq(c1.event(), PathEvent.Line(new LineSegment(point(1, 1), point(2, 1))));
    assert_eq(c2.event(), PathEvent.Line(new LineSegment(point(11, 1), point(12, 1))));

    assert(c1.previous());
    assert(c2.previous());
    assert_eq(c1.first_vertex, start1.vertex);
    assert_eq(c1.first_verb, start1.verb);
    assert_eq(c2, start2);

    assert_eq(c1.event(), PathEvent.MoveTo(point(1, 1)));
    assert_eq(c2.event(), PathEvent.MoveTo(point(11, 1)));

    assert(!c1.previous());
    assert(c2.previous());

    assert_eq(
      c2.event(),
      PathEvent.Cubic(new CubicBezierSegment(point(3, 2), point(4, 1), point(5, 2), point(6, 1)))
    );

    assert_eq(c2.first_verb, start1.verb);
  });

  test("from_polyline_open", () => {
    let points = [point(1, 1), point(3, 1), point(4, 5), point(5, 2)];

    let evts = FromPolyline.open(points.iter().cloned());

    assert_eq(evts.next(), Some(FlattenedEvent.MoveTo(point(1, 1))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(1, 1), point(3, 1)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(3, 1), point(4, 5)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(4, 5), point(5, 2)))));
    assert_eq(evts.next(), None());
  });

  test("from_polyline_closed", () => {
    let points = [point(1, 1), point(3, 1), point(4, 5), point(5, 2)];

    let evts = FromPolyline.closed(points.iter().cloned());

    assert_eq(evts.next(), Some(FlattenedEvent.MoveTo(point(1, 1))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(1, 1), point(3, 1)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(3, 1), point(4, 5)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(4, 5), point(5, 2)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Close(new LineSegment(point(5, 2), point(1, 1)))));
    assert_eq(evts.next(), None());
  });

  test("simple_bounding_rect", () => {
    let builder = Path.builder();
    builder.move_to(point(-10, -3));
    builder.line_to(point(0, -12));
    builder.quadratic_bezier_to(point(3, 4), point(5, 3));
    builder.close();
    let path = builder.build();

    assert_eq(path.iter().fast_bounding_rect(), rect(-10, -12, 15, 16));

    builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.cubic_bezier_to(point(-1, 2), point(3, -4), point(1, -1));
    path = builder.build();

    assert_eq(path.iter().fast_bounding_rect(), rect(-1, -4, 4, 6));
  });

  test("split_empty", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));

    let path = builder.build();
    let it = path.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
  });

  test("split_out_of_range", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    let path = builder.build();

    should_panic(() => path.split(4));
  });

  test("split", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.close();

    let path = builder.build_and_reset();

    let [path1, path2] = path.split(0);

    let it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), None());

    let it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(1);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(1.5);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(3);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(3.5);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(2.5, 0.5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0.5), point(4, 0)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(5.5);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(2.5, 2.5)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(2.5, 2.5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 2.5), point(1, 1)))));
    assert_eq(it2.next(), None());

    [path1, path2] = path.split(6);

    it1 = path1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it1.next(), None());

    it2 = path2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it2.next(), None());
  });

  test("split_move_to", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.move_to(point(1, 1));
    builder.move_to(point(2, 2));
    builder.line_to(point(3, 3));
    builder.move_to(point(4, 4));
    builder.move_to(point(5, 5));
    builder.line_to(point(6, 6));
    builder.move_to(point(7, 7));
    builder.move_to(point(8, 8));
    builder.line_to(point(9, 9));
    builder.close();

    let path = builder.build_and_reset();

    let [p1, p2] = path.split(0);

    let it1 = p1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it1.next(), None());

    let it2 = p2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it2.next(), None());

    [p1, p2] = path.split(1);

    it1 = p1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it1.next(), None());

    it2 = p2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it2.next(), None());

    [p1, p2] = path.split(2);

    it1 = p1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it1.next(), None());

    it2 = p2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it2.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it2.next(), None());

    [p1, p2] = path.split(3);

    it1 = p1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it1.next(), None());

    it2 = p2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(9, 9))));
    assert_eq(it2.next(), Some(PathEvent.Line(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it2.next(), None());

    [p1, p2] = path.split(4);

    it1 = p1.iter();
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it1.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it1.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it1.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it1.next(), None());

    it2 = p2.iter();
    assert_eq(it2.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it2.next(), None());
  });

  test("before_split", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.before_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.before_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), None());

    p = path.before_split(1.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.before_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.before_split(3.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it.next(), None());

    p = path.before_split(5.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(2.5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.before_split(6);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());
  });

  test("before_split_no_close", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));

    let path = builder.build_and_reset();

    let p = path.before_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.before_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), None());

    p = path.before_split(1.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.before_split(2);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), None());

    p = path.before_split(2.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it.next(), None());

    p = path.before_split(3.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 2)))));
    assert_eq(it.next(), None());

    p = path.before_split(4);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());
  });

  test("before_split_move_to", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.move_to(point(1, 1));
    builder.move_to(point(2, 2));
    builder.line_to(point(3, 3));
    builder.move_to(point(4, 4));
    builder.move_to(point(5, 5));
    builder.line_to(point(6, 6));
    builder.move_to(point(7, 7));
    builder.move_to(point(8, 8));
    builder.line_to(point(9, 9));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.before_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), None());

    p = path.before_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), None());

    p = path.before_split(2);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), None());

    p = path.before_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), None());

    p = path.before_split(4);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it.next(), None());
  });

  test("after_split", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.after_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.after_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.after_split(1.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.after_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.after_split(3.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 0.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0.5), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.after_split(5.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 2.5), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.after_split(6);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), None());
  });

  test("after_split_no_close", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));

    let path = builder.build_and_reset();

    let p = path.after_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.after_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.after_split(1.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.after_split(2);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.after_split(2.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 0.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0.5), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.after_split(3.5);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(4, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 2), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.after_split(4);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(4, 4))));
    assert_eq(it.next(), None());
  });

  test("after_split_move_to", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.move_to(point(1, 1));
    builder.move_to(point(2, 2));
    builder.line_to(point(3, 3));
    builder.move_to(point(4, 4));
    builder.move_to(point(5, 5));
    builder.line_to(point(6, 6));
    builder.move_to(point(7, 7));
    builder.move_to(point(8, 8));
    builder.line_to(point(9, 9));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.after_split(0);

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it.next(), None());

    p = path.after_split(1);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it.next(), None());

    p = path.after_split(2);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it.next(), None());

    p = path.after_split(3);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(9, 9))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it.next(), None());

    p = path.after_split(4);

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), None());
  });

  test("split_range", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));
    builder.close();

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.split_range(range(0, 0));

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 1));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1, 1.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1.5, 2));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2.5, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2.5, 3.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(3, 3.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(3.5, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 0.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0.5), point(4, 0)))));

    p = path.split_range(range(4, 6));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(4, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(5, 5.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(4, 4))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(2.5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(6, 6));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 6));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(3, 6));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(4, 4), point(1, 1)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0.5, 5.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 2.5), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 0), point(0, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 4), point(2.5, 2.5)))));
    assert_eq(it.next(), None());
  });

  test("split_range_no_close", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(5, 5));
    builder.line_to(point(5, 0));

    builder.move_to(point(1, 1));
    builder.line_to(point(4, 0));
    builder.line_to(point(4, 4));

    let path = builder.build_and_reset();

    let p = path.split_range(range(0, 0));

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 1));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1, 1.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 2.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1.5, 2));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1.5, 2.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 2.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 2.5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2, 2.5));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(2.5, 0.5)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2.5, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2.5, 0.5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2.5, 0.5), point(4, 0)))));

    p = path.split_range(range(3, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(4, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(4, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(4, 4))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 2));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(0, 0), point(5, 5)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(5, 0)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(4, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(4, 0), point(4, 4)))));
    assert_eq(it.next(), None());
  });

  test("split_range_move_to", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.move_to(point(1, 1));
    builder.move_to(point(2, 2));
    builder.line_to(point(3, 3));
    builder.move_to(point(4, 4));
    builder.move_to(point(5, 5));
    builder.line_to(point(6, 6));
    builder.move_to(point(7, 7));
    builder.move_to(point(8, 8));
    builder.line_to(point(9, 9));
    builder.close();

    let path = builder.build_and_reset();

    let p = path.split_range(range(0, 0));

    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 1));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 2));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(0, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(2, 2), point(3, 3)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(5, 5), point(6, 6)))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(9, 9), point(8, 8)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(2, 3));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(8, 8), point(9, 9)))));
    assert_eq(it.next(), None());

    p = path.split_range(range(1, 1));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(5, 5))));
    assert_eq(it.next(), None());

    p = path.split_range(range(4, 4));

    it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(8, 8))));
    assert_eq(it.next(), None());
  });

  test("split_range_empty_move_to", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.move_to(point(1, 1));
    builder.move_to(point(2, 2));

    let path = builder.build_and_reset();

    let p = path.split_range(range(0, 0));
    let it = p.iter();
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), None());

    should_panic(() => path.split_range(range(0, 1)));
    should_panic(() => path.split_range(range(1, 1.5)));
    should_panic(() => path.split_range(range(2, 2)));
  });
});

describe("FromPolyline", () => {
  test("from_polyline_open", () => {
    let points = [point(1, 1), point(3, 1), point(4, 5), point(5, 2)];

    let evts = FromPolyline.open(points.iter().cloned());

    assert_eq(evts.next(), Some(FlattenedEvent.MoveTo(point(1, 1))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(1, 1), point(3, 1)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(3, 1), point(4, 5)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(4, 5), point(5, 2)))));
    assert_eq(evts.next(), None());
  });

  test("from_polyline_closed", () => {
    let points = [point(1, 1), point(3, 1), point(4, 5), point(5, 2)];

    let evts = FromPolyline.closed(points.iter().cloned());

    assert_eq(evts.next(), Some(FlattenedEvent.MoveTo(point(1, 1))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(1, 1), point(3, 1)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(3, 1), point(4, 5)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Line(new LineSegment(point(4, 5), point(5, 2)))));
    assert_eq(evts.next(), Some(FlattenedEvent.Close(new LineSegment(point(5, 2), point(1, 1)))));
    assert_eq(evts.next(), None());
  });
});
