import { PathEventType, FillRule, PathIterator, Point, LineSegment } from "../internal";

/**
 * Returns whether the point is inside the path.
 */
export function hit_test_path<I extends PathIterator>(
  point: Point,
  path: I,
  fill_rule: FillRule,
  tolerance: number
): boolean {
  let winding = path_winding_number_at_position(point, path, tolerance);

  switch (fill_rule) {
    case FillRule.EvenOdd:
      return winding % 2 !== 0;
    case FillRule.NonZero:
      return winding !== 0;
  }
}

/**
 * Compute the winding number of a given position with respect to the path.
 */
export function path_winding_number_at_position<I extends PathIterator>(
  point: Point,
  path: I,
  tolerance: number
): number {
  // Loop over the edges and compute the winding number at the point by
  // accumulating the winding of all edges intersecting the horizontal line
  // passing through our point which are left of it.
  let winding = 0;

  for (let evt of path) {
    let match = evt.match();
    switch (match.type) {
      case PathEventType.MoveTo:
        break;
      case PathEventType.Line:
      case PathEventType.Close: {
        winding = test_segment(point, match.value, winding);
      }
      case PathEventType.Quadratic: {
        let segment = match.value;
        let [min, max] = segment.fast_bounding_range_y();
        if (min > point.y || max < point.y) {
          continue;
        }
        let prev = segment.start;
        segment.for_each_flattened(tolerance, (p: Point) => {
          winding = test_segment(point, new LineSegment(prev, p), winding);
          prev = p;
        });
      }
      case PathEventType.Cubic: {
        let segment = match.value;
        let [min, max] = segment.fast_bounding_range_y();
        if (min > point.y || max < point.y) {
          continue;
        }
        let prev = segment.start;
        segment.for_each_flattened(tolerance, (p: Point) => {
          winding = test_segment(point, new LineSegment(prev, p), winding);
          prev = p;
        });
      }
    }
  }

  return winding;
}

function test_segment(point: Point, segment: LineSegment, winding: number) {
  let intersection = segment.horizontal_line_intersection(point.y);
  if (intersection.is_some()) {
    let pos = intersection.unwrap();
    if (pos.x < point.x) {
      if (segment.end.y > segment.start.y) {
        return winding + 1;
      } else if (segment.end.y < segment.start.y) {
        return winding - 1;
      }
    }
  }
  return winding;
}
