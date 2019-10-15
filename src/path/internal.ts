import { Self, ImplPartialEq, ImplEq, Clone, Debug, assert } from "@rusts/std";
export * from "./event";
export * from "./builder";
export * from "./state";
export * from "./iterator";
export * from "./path";

export type Index = number;

/**
 * The fill rule defines how to determine what is inside and what is outside of
 * the shape.
 *
 * See the SVG specification
 */
export enum FillRule {
  EvenOdd,
  NonZero
}

/**
 * A virtual vertex offset in a geometry.
 *
 * The `VertexId`s are only valid between `GeometryBuilder.begin_geometry` and
 * `GeometryBuilder.end_geometry`. `GeometryBuilder` implementations typically
 * translate the ids internally so that the first `VertexId` after
 * `begin_geometry` is zero.
 */
export type VertexId = number;
