
function cyrb128(s: string): [ number, number, number, number ] {
  let h1 = 1779033703, h2 = 3144134277,
      h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < s.length; i++) {
    k = s.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [ (h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0 ];
}

// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
export class PRNG {
  static fromHash(s: string) {
    return new PRNG(...cyrb128(s))
  }
  constructor(private a: number, private b: number, private c: number, private d: number) {}
  random() {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0; 
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ this.b >>> 9;
    this.b = this.c + (this.c << 3) | 0;
    this.c = (this.c << 21 | this.c >>> 11);
    this.d = this.d + 1 | 0;
    t = t + this.d | 0;
    this.c = this.c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

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
