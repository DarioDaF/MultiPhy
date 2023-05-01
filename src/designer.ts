
import * as PIXI from 'pixi.js'
import RAPIER from '@dimforge/rapier2d'

import { bind } from './helpers/func'
import { DragZoneVisiblePoint } from './dragPlugin'

import { PMath as PM } from './helpers/math'

export class SimWorldView {
  mToP = 32
  canvasLineWidth = 3.0
  get simLineWidth() {
    return this.canvasLineWidth / this.mToP
  }
  view = new PIXI.Container()
  constructor(public topLeft: PIXI.IPointData) {
    this.propUpdated()
  }
  propUpdated() {
    this.view.position = this.topLeft
    this.view.scale = { x: this.mToP, y: this.mToP }
  }

  // If you are running this `g` MUST be a child of `view`
  private _dbgGraphics?: PIXI.Graphics
  prepareDbgGraphics() {
    if (this._dbgGraphics === undefined) {
      this._dbgGraphics = new PIXI.Graphics()
      this.view.addChild(this._dbgGraphics)
    }
  }
  removeDbgGraphics() {
    /*
    if (this._dbgGraphics !== undefined) {
      //this.view.removeChild(this._dbgGraphics)
      this._dbgGraphics.removeFromParent()
      this._dbgGraphics.destroy()
      this._dbgGraphics = undefined
    }
    */
    this._dbgGraphics?.removeFromParent() // PIXI will remove an object from its old parent so only one can own this!
    this._dbgGraphics?.destroy()
    this._dbgGraphics = undefined
  }
  debugRender(w: RAPIER.World, col?: PIXI.ColorSource, g?: PIXI.Graphics) {
    if (g === undefined) {
      if (this._dbgGraphics === undefined) {
        this._dbgGraphics = new PIXI.Graphics()
        this.view.addChild(this._dbgGraphics)
      }
      g = this._dbgGraphics
    }
    
    g.clear()

    const dbgBuffer = w.debugRender()
    const vtx = dbgBuffer.vertices
    const cls = dbgBuffer.colors
  
    for (let i = 0; i < vtx.length / 4; i += 1) {
      const color = (col !== undefined) ? col : new PIXI.Color([ cls[i * 8], cls[i * 8 + 1], cls[i * 8 + 2] ])
      g.lineStyle(this.simLineWidth, color, cls[i * 8 + 3], 0.5) // native true will make width not work
      g.moveTo(vtx[i * 4], vtx[i * 4 + 1])
      g.lineTo(vtx[i * 4 + 2], vtx[i * 4 + 3])
    }
  }
}

/*
function extendMethod<T extends { [name in keyof T as K]: Function }, K extends string | symbol>(
  obj: T, method: K,
  post: (t: T, ...args: any[]) => void
) {
  const oldMethod = obj[method]
  obj[method] = function(...args: any[]) {
    const res = oldMethod.bind(this)(...args);
    post(this, ...args);
    return res;
  }
}
*/
function extendMethod<T>(
  obj: T, method: string | symbol,
  post: (t: T, ...args: any[]) => void
) {
  const oldMethod = (obj as any)[method] as Function
  (obj as any)[method] = function(...args: any[]) {
    const res = oldMethod.bind(this)(...args);
    post(this, ...args);
    return res;
  }
}

export class DrawnRect {
  g = new PIXI.Graphics()
  pos = new RAPIER.Vector2(0, 0)
  size = new RAPIER.Vector2(0, 0)

  public propUpdated() {
    this.g.position = this.pos
    this.updateDraggers()
    this.g.clear()
    this.g.beginFill(new PIXI.Color([ 0.0, 1.0, 0.0 ]))
    this.g.drawRect(0, 0, this.size.x, this.size.y)
    this.g.endFill()
  }

  /*
  @bind
  public mouseEvent(e: PIXI.FederatedPointerEvent) {
    const local = this.g.toLocal(e.global)
    console.log(`${e.type} ${local} ${e.target}`)
  }
  */

  private draggerTL = new DragZoneVisiblePoint({ x: 0, y: 0 }, this.g, 5)
  private draggerBR = new DragZoneVisiblePoint(this.size, this.g, 5)
  private draggerCenter = new DragZoneVisiblePoint(PM.mulS(this.size, 0.5), this.g, 10)

  private updateDraggers() {
    this.draggerBR.rel = this.size
    this.draggerBR.updatePos()
    this.draggerCenter.rel = PM.mulS(this.size, 0.5)
    this.draggerCenter.updatePos()
  }

  constructor() {
    window.app.dragger.add(this.draggerTL)
    window.app.dragger.add(this.draggerBR)
    window.app.dragger.add(this.draggerCenter)

    //this.g.interactive = true
    //this.g.addEventListener('mousedown', this.mouseEvent)
    /*
    this.g.addEventListener('mousedown', this.mouseEvent)
    this.g.addEventListener('mousemove', this.mouseEvent)
    this.g.addEventListener('mouseup', this.mouseEvent)
    */
  }

  public update(dt: number) {
    if (this.draggerTL.dragging) {
      const tl = this.g.toLocal(this.draggerTL.mouse)
      this.pos = PM.add(this.pos, tl)
      this.size = PM.sub(this.size, tl)
      this.propUpdated()
    }
    if (this.draggerBR.dragging) {
      this.size = this.g.toLocal(this.draggerBR.mouse)
      this.propUpdated()
    }
    if (this.draggerCenter.dragging) {
      this.pos = PM.add(this.pos, PM.sub(this.g.toLocal(this.draggerCenter.mouse), PM.mulS(this.size, 0.5)))
      this.propUpdated()
    }
  }

}


