import { Self } from "@rusts/std";
import { Transform2D } from "./transform";

export { Point2D as Point, point2 as point } from "./point";
export { Size2D as Size, size2 as size } from "./size";
export { Vector2D as Vector, vec2 as vector } from "./vector";

export interface Transform extends Self {
  transform(mat: Transform2D): this["Self"];
}

export * from "./point";
export * from "./box";
export * from "./rect";
export * from "./rotation";
export * from "./scalar";
export * from "./scale";
export * from "./side_offsets";
export * from "./size";
export * from "./transform";
export * from "./translation";
export * from "./triangle";
export * from "./trig";
export * from "./utils";
export * from "./vector";
export * from "./nonempty";
export * from "./segment";
export * from "./line";
export * from "./bezier";
export * from "./monotonic";
export * from "./arc";
export * from "./path";
export * from "./algorithms";
