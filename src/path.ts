// import { Box, Curve, Point } from "./internal"
//
// export type Curves = Curve[]
//
// type LineSegment = Curve
//
// export class Path {
//   private _curves: Curves
//   private _closing_seg: LineSegment
//   private _closed: boolean
//
//   constructor(p: Point) {
//     this._curves = []
//     this._closing_seg = new LineSegment([p.x, p.y, p.x, p.y])
//     this._closed = false
//     this._curves.push(this._closing_seg)
//   }
//
//   // A Path is empty if it contains only the closing segment
//   is_empty(): boolean {
//     return this._curves.length === 1
//   }
//
//   initial_point(): Curve {
//     return this._curves[0]
//   }
//
//   final_point(): Curve {
//     return this._includes_closing_segment()
//       ? this.final_point_closed()
//       : this.final_point_open()
//   }
//
//   final_point_open(): Curve {
//     if (this.is_empty()) {
//       return this._curves[this._curves.length - 1]
//     }
//     return this._curves[this._curves.length - 2]
//   }
//
//   final_point_closed(): Curve {
//     return this._closing_seg.isZeroLength()
//       ? this._curves[this._curves.length - 2]
//       : this._curves[this._curves.length - 1]
//   }
//
//   // Length without the closing segment, even if the path is closed
//   length_open(): number {
//     return this._curves.length - 1
//   }
//
//   // If the closing segment is of zero length, then don't include it in this
//   // length
//   length_closed(): number {
//     return this._closing_seg.isZeroLength() ? this._curves.length - 1 : this._curves.length
//   }
//
//   length(): number {
//     return this._includes_closing_segment() ? this.length_closed() : this.length_open()
//   }
//
//   is_closed(): boolean {
//     return this._closed
//   }
//
//   close(closed: boolean = true) {
//     this._closed = closed
//   }
//
//   clear() {
//     this._curves = []
//   }
//
//   bbox(): Box {
//     let boxes: Box[] = []
//
//     for (let curve of this._curves) {
//       let bbox = curve.bbox()
//       boxes.push(new Box(bbox.x.min, bbox.y.min, bbox.x.max, bbox.y.max))
//     }
//
//     if (this._includes_closing_segment) {
//       boxes.push(this._closing_seg.box())
//     }
//
//     let bbox = new Box()
//     boxes.reduce((bbox, b) => {
//       return bbox.merge(b)
//     }, bbox)
//
//     return bbox
//   }
//
//   private _includes_closing_segment(): boolean {
//     return this._closed && !this._closing_seg.isZeroLength()
//   }
// }
