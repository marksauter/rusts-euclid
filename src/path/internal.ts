import { Self, ImplPartialEq, ImplEq, Clone, Debug, assert } from "@rusts/std";
export * from "./event";
export * from "./builder";
export * from "./state";
export * from "./iterator";
export * from "./path";

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
