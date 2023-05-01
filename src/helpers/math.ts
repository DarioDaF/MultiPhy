
export namespace PMath {
  export type IPointData = import('pixi.js').IPointData

  export function P(x: number, y: number): IPointData {
    return { x, y }
  }
  export function add(p1: IPointData, p2: IPointData): IPointData {
    return { x: p1.x + p2.x, y: p1.y + p2.y }
  }
  export function sub(p1: IPointData, p2: IPointData): IPointData {
    return { x: p1.x - p2.x, y: p1.y - p2.y }
  }
  export function mul(p1: IPointData, p2: IPointData): IPointData {
    return { x: p1.x * p2.x, y: p1.y * p2.y }
  }
  export function mulS(p1: IPointData, s: number): IPointData {
    return { x: p1.x * s, y: p1.y * s }
  }
  export function dot(p1: IPointData, p2: IPointData): number {
    return p1.x * p2.x + p1.y * p2.y
  }
  export function len2(p: IPointData): number {
    return dot(p, p)
  }
  export function normalized(p: IPointData): IPointData {
    return mulS(p, 1.0 / len(p))
  }
  export function len(p: IPointData): number {
    return Math.sqrt(len2(p))
  }
  export function rot(p: IPointData, ang: number) {
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    return { x: c * p.x - s * p.y, y: s * p.x + c * p.y }
  }
}
