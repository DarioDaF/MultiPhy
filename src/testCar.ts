
import RAPIER, { ImpulseJoint, RigidBody } from "@dimforge/rapier2d";
import { PMath as PM } from "./helpers/math";
import { IJHandle, RBHandle, addExtraInfo, getContextWorld } from "./worldHandleManager";
const P = PM.P

interface IIsometry {
  translation(): RAPIER.Vector2,
  rotation(): number
}

function loc2glob(iso: IIsometry, local: PM.IPointData, isDir = false) {
  if (isDir) {
    return PM.rot(local, iso.rotation())
  } else {
    return PM.add(PM.rot(local, iso.rotation()), iso.translation())
  }
}
function glob2loc(iso: IIsometry, glob: PM.IPointData, isDir = false) {
  if (isDir) {
    return PM.rot(glob, -iso.rotation())
  } else {
    return PM.rot(PM.sub(glob, iso.translation()), -iso.rotation())
  }
}

function createJRev(o1: RAPIER.RigidBody, p1: PM.IPointData, o2: RAPIER.RigidBody, p2: PM.IPointData) {
  const j = getContextWorld().createImpulseJoint(
    RAPIER.JointData.revolute(new RAPIER.Vector2(p1.x, p1.y), new RAPIER.Vector2(p2.x, p2.y)),
    o1, o2, true
  ) as RAPIER.RevoluteImpulseJoint
  j.setContactsEnabled(false)
  return j
}

type PrismaticImpulseJointWithAxis = RAPIER.PrismaticImpulseJoint & {
  _extraInfo: {
    axis: PM.IPointData
  }
}

function createJPrism(o1: RAPIER.RigidBody, p1: PM.IPointData, o2: RAPIER.RigidBody, p2: PM.IPointData, ax: PM.IPointData) {
  const _axis = new RAPIER.Vector2(ax.x, ax.y)
  const j = getContextWorld().createImpulseJoint(
    RAPIER.JointData.prismatic(
      new RAPIER.Vector2(p1.x, p1.y), new RAPIER.Vector2(p2.x, p2.y),
      _axis
    ),
    o1, o2, true
  ) as PrismaticImpulseJointWithAxis
  addExtraInfo(j, 'axis', _axis)
  j.setContactsEnabled(false)
  return j
}

function createRB(shape: RAPIER.Shape, pos: PM.IPointData, rot: number = 0) {
  const body = getContextWorld().createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y)
      .setRotation(rot)
  )
  getContextWorld().createCollider(
    new RAPIER.ColliderDesc(shape),
    body
  )
  return body
}

class Rocket {
  private power = 0

  constructor(private parent: RBHandle, private relPos: PM.IPointData, private thrustVector: PM.IPointData) { }

  setPower(power: number) {
    /*
    // @TODO: Fix data dependency! This should not store data without the ability to clone it in the stepper then
    if (power === this.power)
      return
    */
    this.power = power
    /*
    const applyPoint = loc2glob(this.parent, this.relPos)
    const applyVector = PM.mulS(loc2glob(this.parent, this.thrustVector, true), power)
    this.parent.addForceAtPoint(applyVector, applyPoint, true)
    */
  }

  step() {
    const _parent = this.parent.get()
    const imp = getContextWorld().integrationParameters.dt * this.power
    const applyPoint = loc2glob(_parent, this.relPos)
    const applyVector = PM.mulS(loc2glob(_parent, this.thrustVector, true), imp)
    if (imp !== 0)
      _parent.applyImpulseAtPoint(applyVector, applyPoint, true)
  }
}

type ExtraJointInfo = {
  localOffset?: PM.IPointData
  axis?: PM.IPointData
}

type UnitImpulseJointWithOffset = RAPIER.UnitImpulseJoint & {
  _extraInfo: {
    localOffset: PM.IPointData
  }
}
type UJHandle = IJHandle<RAPIER.UnitImpulseJoint | UnitImpulseJointWithOffset>
type CustomZeroJoint = { zeroJoint: () => void }

function zeroJoint(j: CustomZeroJoint | UJHandle) {
  if ('zeroJoint' in j) {
    j.zeroJoint()
    return
  }

  const _j = j.get()

  const b1 = _j.body1()
  const b2 = _j.body2()
  let movedP2 = PM.add(
    PM.sub(loc2glob(b1, _j.anchor1()), loc2glob(b2, _j.anchor2(), true)),
    j?._extraInfo?.localOffset ?? PM.P(0, 0)
  )
  b2.setTranslation(movedP2, true)
}

function setSpring(_j: PrismaticImpulseJointWithAxis, len: number, stiffness = 1000, damping = 0.5) {
  const j = _j as PrismaticImpulseJointWithAxis & UnitImpulseJointWithOffset
  j._extraInfo.localOffset = PM.mulS(PM.normalized(j._extraInfo.axis), len)
  j.configureMotorPosition(len, stiffness, damping)
  //return j // For chaining and type improvement?
}

class WheelAssembly {
  private sbody: RBHandle
  private ball: RBHandle
  private rj: IJHandle<RAPIER.RevoluteImpulseJoint>
  private pj: IJHandle<PrismaticImpulseJointWithAxis>

  constructor(body: RAPIER.RigidBody, pos: PM.IPointData, radius: number, susp_len: number, susp_stiff = 1000, susp_damping = 0.5, ax: PM.IPointData = { x: 0, y: 1 }) {
    const _sbody = createRB(new RAPIER.Cuboid(radius / 2, radius / 2), P(0, 0))
    const _ball = createRB(new RAPIER.Ball(radius), P(0, 0))
    const _rj = createJRev(_sbody, P(0, 0), _ball, P(0, 0))
    const _pj = createJPrism(body, pos, _sbody, P(0, 0), ax)
    setSpring(_pj, susp_len, susp_stiff, susp_damping)

    this.sbody = new RBHandle(_sbody)
    this.ball = new RBHandle(_ball)
    this.rj = new IJHandle<RAPIER.RevoluteImpulseJoint>(_rj)
    this.pj = new IJHandle<PrismaticImpulseJointWithAxis>(_pj)
  }

  wheel() { return this.ball }

  getRBs() { return [ this.sbody, this.ball ] }

  setVelocity(vel: number, factor: number) {
    this.rj.get().configureMotorVelocity(vel, factor)
    this.ball.get().wakeUp()
  }

  zeroJoint() {
    // Order is important (need pj first then rj)
    for (let j of [ this.pj, this.rj ]) {
      zeroJoint(j)
    }
  }
}

export class Car {
  private body: RBHandle
  private cap: RBHandle
  private pj1: IJHandle<PrismaticImpulseJointWithAxis>

  // 3rd wheel with suspension
  private w1: WheelAssembly
  private w2: WheelAssembly

  //private rocket = new Rocket(this.cap, P(-0.5, 0), P(3, 0))
  private rocket: Rocket

  public maxSpeed = 10
  private _speed = 0

  constructor() {
    const _body = createRB(new RAPIER.Cuboid(1, 0.3), P(0, 0))
    const _cap = createRB(new RAPIER.Cuboid(0.5, 0.3), P(0, 0))
    const _pj1 = createJPrism(_body, P(0, 0), _cap, P(0, 0), P(0, -1))
  
    // 3rd wheel with suspension
    this.w1 = new WheelAssembly(_body, P(-0.8, 0.2), 0.4, 0.8)
    this.w2 = new WheelAssembly(_body, P(+0.8, 0.2), 0.4, 0.8)

    this.body = new RBHandle(_body)
    this.cap = new RBHandle(_cap)
    this.pj1 = new IJHandle<PrismaticImpulseJointWithAxis>(_pj1)

    this.rocket = new Rocket(this.cap, P(0, 0), P(0, -25))

    setSpring(_pj1, 1, 100, 1)

    this.zeroJoint()

    this.w1.wheel().get().collider(0).setFriction(10)
    this.w2.wheel().get().collider(0).setFriction(10)
  }

  step() {
    // Physics stuff
    this.rocket.step()
  }

  setRocket(pow: number) {
    this.rocket.setPower(pow)
  }

  setSpeed(speed: number) {
    /*
    // @TODO: Fix data dependency! This should not store data without the ability to clone it in the stepper then
    if (speed === this._speed)
      return
    */
    this._speed = speed
    this.w1.setVelocity(this.maxSpeed * this._speed, 300)
    this.w2.setVelocity(this.maxSpeed * this._speed, 300)
    /*
    this.rj1.configureMotorVelocity(this.maxSpeed * this._speed, 5)
    this.r1.wakeUp()
    */
  }

  getBody() { return this.body }

  getRBs() {
    return [ this.body, this.cap, ...this.w1.getRBs(), ...this.w2.getRBs() ]
  }

  zeroJoint() {
    for (let j of [ this.pj1, this.w1, this.w2 ]) {
      zeroJoint(j)
    }
  }
}
