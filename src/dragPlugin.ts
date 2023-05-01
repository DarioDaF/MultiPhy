
import * as PIXI from 'pixi.js'
import { Renderer, ExtensionType, ExtensionMetadata, extensions, Application, Graphics, FederatedPointerEvent, Runner } from 'pixi.js'

import { min, registerEvent, registerEvents } from './helpers/func'

import { PMath as PM } from './helpers/math'

export interface IDragZone {
  dist2(e: FederatedPointerEvent): number
  onNear(e: FederatedPointerEvent): void
  onFar(e?: FederatedPointerEvent): void
  onDown(e: FederatedPointerEvent): void
  onUp(e?: FederatedPointerEvent): void
  onMove(e: FederatedPointerEvent): void
}

export class DragZonePoint implements IDragZone {
  constructor(public rel: PIXI.IPointData, public obj?: PIXI.DisplayObject, public maxDist: number = Infinity) {}

  dist2(e: FederatedPointerEvent): number {
    const localPos = (this.obj === undefined) ? e.global : this.obj.worldTransform.applyInverse(e.global)
    const len2 = PM.len2(PM.sub(this.rel, localPos))
    if (len2 > this.maxDist) {
      return Infinity
    } else {
      return len2
    }
  }

  public near = false
  public dragging = false
  public needUpdate = false

  public mouse: PIXI.IPointData = { x: 0, y: 0 }

  onNear(e: FederatedPointerEvent): void {
    this.near = true
    this.needUpdate = true
  }
  onFar(e?: FederatedPointerEvent): void {
    this.near = false
    this.needUpdate = true
  }
  onDown(e: FederatedPointerEvent): void {
    this.mouse = e.global
    this.dragging = true
    this.needUpdate = true
  }
  onUp(e?: FederatedPointerEvent): void {
    if (e !== undefined)
      this.mouse = e.global
    this.dragging = false
    this.needUpdate = true
  }
  onMove(e: FederatedPointerEvent): void {
    if (this.dragging) {
      this.mouse = e.global
      this.needUpdate = true
    }
  }
}

const circleGeom = (() => {
  const g = new PIXI.Graphics()
  g.beginFill({ r: 255, g: 255, b: 255 })
  g.drawCircle(0, 0, 1.0)
  g.endFill()
  const geom = g.geometry
  ++geom.refCount // Make sure doesn't get destroyed
  g.destroy()
  return geom
})()

export class DragZoneVisiblePoint extends DragZonePoint {

  public g: PIXI.Graphics // To be added to the obj or scene

  constructor(rel: PIXI.IPointData, obj?: PIXI.Container, maxDist: number = Infinity) {
    super(rel, obj, maxDist)
    this.g = new PIXI.Graphics(circleGeom)
    this.g.tint = { r: 0, g: 0, b: 255 }
    this.g.visible = false
    this.g.scale.set(0.4)
    obj?.addChild(this.g)
  }

  remove() {
    this.g.removeFromParent()
  }

  updatePos() {
    this.g.position = this.rel
  }

  updateState() {
    this.g.visible = this.near
    this.g.alpha = this.dragging ? 1.0 : 0.4
  }

  onFar(e?: PIXI.FederatedPointerEvent): void {
    super.onFar(e)
    this.updateState()
  }
  onNear(e: PIXI.FederatedPointerEvent): void {
    super.onNear(e)
    this.updateState()
  }
  onUp(e?: PIXI.FederatedPointerEvent): void {
    super.onUp(e)
    this.updateState()
  }
  onDown(e: PIXI.FederatedPointerEvent): void {
    super.onDown(e)
    this.updateState()
  }
}

type DragZoneData = {
  zone: IDragZone
  dragging: boolean // If extract nearest use multiple `pointerId`s
}

export class DragPlugin // : ISystem
{
  static extension: ExtensionMetadata = {
    name: 'DragPlugin',
    type: ExtensionType.Application
  };
  static version = '0.0.1';

  static destroy(this: Application) {
    this.dragger.destroy()
  }

  static init(this: Application) {
    this.dragger = new DragPlugin(this)
  }

  // Actual implementation

  private zones: DragZoneData[] = []
  private nearest: DragZoneData | undefined = undefined

  public add(zone: IDragZone) {
    this.zones.push({ dragging: false, zone })
  }
  public remove(zone: IDragZone) {
    if (zone === undefined)
      return false
    const idx = this.zones.findIndex(z => z.zone === zone)
    if (idx < 0)
      return false
    const data = this.zones.splice(idx, 1)[0]
    if (data.dragging) {
      data.dragging = false
      data.zone.onUp(undefined)
    }
    if (this.nearest?.zone === zone) {
      this.nearest = undefined
      zone.onFar(undefined)
    }
    return true
  }

  private nearestZone(e: FederatedPointerEvent): DragZoneData | undefined {
    let minLen2 = Infinity
    let minZone = undefined
    for (let zone of this.zones) {
      const len2 = zone.zone.dist2(e)
      if (len2 < minLen2) {
        minLen2 = len2
        minZone = zone
      }
    }
    return minZone
    //return (minLen2 === Infinity) ? undefined : minZone // No need, cause `Infinity !< Infinity`
  }

  @registerEvent()
  private pointerdown(e: FederatedPointerEvent) {
    this.pointermove(e) // To make sure nearest is correct

    if (this.nearest === undefined)
      return

    this.nearest.dragging = true
    this.nearest.zone.onDown(e)
  }
  @registerEvent()
  private pointerup(e: FederatedPointerEvent) {
    for (let zone of this.zones) {
      if (zone.dragging) {
        zone.dragging = false
        zone.zone.onUp(e)
      }
    }
  }
  @registerEvent()
  private pointermove(e: FederatedPointerEvent) {
    if ((this.nearest !== undefined) && (this.nearest.dragging ?? false)) {
      this.nearest.zone.onMove(e)
      return // Don't update if there is a nearest that's dragging
    }

    const oldNearest = this.nearest
    this.nearest = this.nearestZone(e)

    if (oldNearest != this.nearest) {
      oldNearest?.zone?.onFar(e)
      this.nearest?.zone?.onNear(e)
    }
  }

  g = new Graphics()
  constructor(private app: Application) {
    this.app.stage.addChild(this.g)
    //this.app.renderer.events.rootBoundary.addEventMapping('pointerdown', this.onPointerDown)
    const eventDispatcher = this.app.renderer.events.rootBoundary.dispatch
    registerEvents(this, eventDispatcher)
  }

  destroy() {
    // @TODO: Should deregister events

    this.g.removeFromParent()
    this.g.destroy()
    this.g = null! // Make sure no stale stuff around
  }

}

extensions.add(DragPlugin)
