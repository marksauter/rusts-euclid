import { Some, None } from "@rusts/std";
import {
  FromPolyline,
  FlattenedEvent,
  Path,
  PathObjectBuilder,
  PathEvent,
  reverse_path,
  point,
  rect,
  QuadraticBezierSegment,
  CubicBezierSegment,
  LineSegment
} from "../src/internal";
import { test_macros } from "@rusts/std";
const { assert, assert_eq, should_panic } = test_macros;

describe("Path", () => {
  test("reverse_path", () => {
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
    builder = Path.builder();
    reverse_path(p1.as_slice(), builder);
    let p2 = builder.build();

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

  test("reverse_path_no_close", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    builder.line_to(point(1, 0));
    builder.line_to(point(1, 1));

    let p1 = builder.build();

    builder = Path.builder();
    reverse_path(p1.as_slice(), builder);
    let p2 = builder.build();

    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 1), point(1, 0)))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(1, 0), point(0, 0)))));
    assert_eq(it.next(), None());
  });

  test("reverse_empty_path", () => {
    let p1 = Path.builder().build();
    let builder = Path.builder();
    reverse_path(p1.as_slice(), builder);
    let p2 = builder.build();
    assert_eq(p2.iter().next(), None());
  });

  test("reverse_single_moveto", () => {
    let builder = Path.builder();
    builder.move_to(point(0, 0));
    let p1 = builder.build();
    builder = Path.builder();
    reverse_path(p1.as_slice(), builder);
    let p2 = builder.build();
    let it = p2.iter();

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(0, 0))));
    assert_eq(it.next(), None());
  });

  test("path_builder_1", () => {
    let p = new PathObjectBuilder();
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

    p.close();
    p.move_to(point(1, 1));
    p.move_to(point(2, 2));
    p.move_to(point(3, 3));
    p.line_to(point(4, 4));

    let path = p.build();

    let it = path.iter();
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

    // Not clear that this is the most useful behavior.
    // Closing when there is not path should probably be dropped.
    assert_eq(it.next(), Some(PathEvent.Close(new LineSegment(point(10, 0), point(10, 0)))));

    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 1))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(2, 2))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(3, 3))));
    assert_eq(it.next(), Some(PathEvent.Line(new LineSegment(point(3, 3), point(4, 4)))));
    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
    assert_eq(it.next(), None());
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
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(1, 2))));
    assert_eq(it.next(), Some(PathEvent.MoveTo(point(3, 4))));
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

  test("merge_paths", () => {
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

    let path = path1.merge(path2);

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
    let path = builder.build();

    assert_eq(start1.event(path), PathEvent.MoveTo(point(1, 1)));
    assert_eq(start2.event(path), PathEvent.MoveTo(point(11, 1)));

    assert_eq(
      c1.event(path),
      PathEvent.Cubic(new CubicBezierSegment(point(3, 2), point(4, 1), point(5, 2), point(6, 1)))
    );
    assert_eq(
      c2.event(path),
      PathEvent.Cubic(
        new CubicBezierSegment(point(13, 2), point(14, 1), point(15, 2), point(16, 1))
      )
    );

    assert(c1.previous(path));
    assert(c2.previous(path));
    assert_eq(c1.first_vertex, start1.vertex);
    assert_eq(c1.first_verb, start1.verb);

    assert_eq(
      c1.event(path),
      PathEvent.Quadratic(new QuadraticBezierSegment(point(2, 1), point(2, 2), point(3, 2)))
    );
    assert_eq(
      c2.event(path),
      PathEvent.Quadratic(new QuadraticBezierSegment(point(12, 1), point(12, 2), point(13, 2)))
    );

    assert(c1.previous(path));
    assert(c2.previous(path));
    assert_eq(c1.first_vertex, start1.vertex);
    assert_eq(c1.first_verb, start1.verb);

    assert_eq(c1.event(path), PathEvent.Line(new LineSegment(point(1, 1), point(2, 1))));
    assert_eq(c2.event(path), PathEvent.Line(new LineSegment(point(11, 1), point(12, 1))));

    assert(c1.previous(path));
    assert(c2.previous(path));
    assert_eq(c1.first_vertex, start1.vertex);
    assert_eq(c1.first_verb, start1.verb);
    assert_eq(c2, start2);

    assert_eq(c1.event(path), PathEvent.MoveTo(point(1, 1)));
    assert_eq(c2.event(path), PathEvent.MoveTo(point(11, 1)));

    assert(!c1.previous(path));
    assert(c2.previous(path));

    assert_eq(
      c2.event(path),
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
});
