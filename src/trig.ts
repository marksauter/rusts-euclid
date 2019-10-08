import { PI } from '@rusts/std'

export function degrees_to_radians(deg: number) {
  return (deg * PI) / 180
}

export function radians_to_degrees(radians: number) {
  return (radians * 180) / PI
}
