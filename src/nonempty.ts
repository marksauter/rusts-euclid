import { Self, min, max } from '@rusts/std'
import { Box2D, box2, point2, Rect, size2, Vector2D } from './internal'

export class NonEmptyRect<U = any> extends Self {
  public Self!: NonEmptyRect<U>

  public target: Rect<U>

  public constructor(target: Rect<U>) {
    super()
    this.target = target
  }

  public get(): Rect<U> {
    return this.target
  }

  public union(other: this['Self']): this['Self'] {
    let origin = point2(
      min(this.target.min_x(), other.target.min_x()),
      min(this.target.min_y(), other.target.min_y())
    )

    let lower_right_x = max(this.target.max_x(), other.target.max_x())
    let lower_right_y = max(this.target.max_y(), other.target.max_y())

    return new NonEmptyRect(
      new Rect(origin, size2(lower_right_x - origin.x, lower_right_y - origin.y))
    )
  }

  public contains_rect(other: this['Self']): boolean {
    return (
      this.target.min_x() <= other.target.min_x() &&
      other.target.max_x() <= this.target.max_x() &&
      this.target.min_y() <= other.target.min_y() &&
      other.target.max_y() <= this.target.max_y()
    )
  }

  public translate(by: Vector2D<U>): this['Self'] {
    return new NonEmptyRect(this.target.translate(by))
  }
}

export class NonEmptyBox2D<U> extends Self {
  public Self!: NonEmptyBox2D<U>

  public target: Box2D<U>

  public constructor(target: Box2D<U>) {
    super()
    this.target = target
  }

  public get(): Box2D<U> {
    return this.target
  }

  public union(other: this['Self']): this['Self'] {
    return new NonEmptyBox2D(
      box2(
        point2(
          min(this.target.min.x, other.target.min.x),
          min(this.target.min.y, other.target.min.y)
        ),
        point2(
          max(this.target.max.x, other.target.max.x),
          max(this.target.max.y, other.target.max.y)
        )
      )
    )
  }

  public contains_box(other: this['Self']): boolean {
    return (
      this.target.min.x <= other.target.min.x &&
      other.target.max.x <= this.target.max.x &&
      this.target.min.y <= other.target.min.y &&
      other.target.max.y <= this.target.max.y
    )
  }

  public translate(by: Vector2D<U>): this['Self'] {
    return new NonEmptyBox2D(this.target.translate(by))
  }
}
