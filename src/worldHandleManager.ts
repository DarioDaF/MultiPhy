import RAPIER from "@dimforge/rapier2d"

let contextWorld: RAPIER.World = undefined!

export function getContextWorld() { return contextWorld }
export function setContextWorld(world: RAPIER.World) { contextWorld = world }

type ExtraInfo = Record<string, any>
type WithExtraInfo = {
  _extraInfo?: ExtraInfo
}

export function addExtraInfo(obj: WithExtraInfo, k: string, d: any) {
  if (obj._extraInfo === undefined) {
    obj._extraInfo = {}
  }
  obj._extraInfo[k] = d
}
export function getExtraInfo<T>(obj: WithExtraInfo, k: string) {
  if (obj._extraInfo === undefined) {
    return undefined
  }
  return obj._extraInfo[k] as T | undefined
}

export class RBHandle {
  private handle: RAPIER.RigidBodyHandle
  public _extraInfo?: ExtraInfo

  constructor(obj: RAPIER.RigidBody & WithExtraInfo) {
    this.handle = obj.handle
    this._extraInfo = obj._extraInfo
  }
  get(world?: RAPIER.World) {
    const res = (world ?? getContextWorld()).getRigidBody(this.handle) as RAPIER.RigidBody & WithExtraInfo
    res._extraInfo = this._extraInfo
    return res
  }
}

export class IJHandle<out T extends RAPIER.ImpulseJoint> {
  private handle: RAPIER.ImpulseJointHandle
  public _extraInfo?: ExtraInfo

  constructor(obj: RAPIER.ImpulseJoint & WithExtraInfo) {
    this.handle = obj.handle
    this._extraInfo = obj._extraInfo
  }
  get(world?: RAPIER.World) {
    const res = (world ?? getContextWorld()).getImpulseJoint(this.handle) as T & WithExtraInfo
    res._extraInfo = this._extraInfo
    return res
  }
}
