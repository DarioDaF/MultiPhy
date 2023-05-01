
import './esbuild_hotreload'

import './rtcChannel'

import * as PIXI from 'pixi.js'
import './dragPlugin'
import './keyInputPlugin'
// Options and alternatives https://bevyengine.org/
import RAPIER from '@dimforge/rapier2d'

import { SimWorldView, DrawnRect } from './designer'
import { HandleMultyplayerIO } from './handleMultiplayerIO'
import { IOData, IWorldStepper, WorldHandler } from './wolrdHandler'
import { setContextWorld } from './worldHandleManager'

// Needed if RAPIER is loaded as "-compat" module to register the wasm code
const COMPAT_RAPIER = RAPIER as { init?(): Promise<void> }
await COMPAT_RAPIER.init?.()

const w = new RAPIER.World({ x: 0, y: 9.81 }) // Positive gravity to match Y positive downward in graphics
setContextWorld(w) // Set context
window.world = w
const wview = new SimWorldView({ x: 0, y: 0 })
const wviewOld = new SimWorldView({ x: 0, y: 0 })

const groundColliderDesc = RAPIER.ColliderDesc.cuboid(5.0, 0.1)
groundColliderDesc.setTranslation(6.0, 5.0)
w.createCollider(groundColliderDesc)

w.createCollider(
  RAPIER.ColliderDesc.cuboid(5.0, 0.1)
    .setTranslation(6.0, 10.0)
)

//RAPIER.ColliderDesc.roundConvexPolyline()
//https://github.com/schteppe/poly-decomp.js/ Too many polys???
//https://mpen.ca/406/bayazit Is the same? Maybe the simpler version is better for physics
// Cause I like NON SMALL polys
//https://github.com/dimforge/nphysics ?
//https://github.com/jrouwe/JoltPhysics Look here !!!

// Create a dynamic rigidBody.
const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
rigidBodyDesc.setTranslation(6.0, 1.0)
const rigidBody = w.createRigidBody(rigidBodyDesc)
rigidBody.addTorque(-0.5, true)

// Create and attach collider to rigidBody.
//const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5)
const colliderDesc = RAPIER.ColliderDesc.capsule(0.2, 0.2)
w.createCollider(colliderDesc, rigidBody)

const app = new PIXI.Application({
  view: document.getElementById('screen') as HTMLCanvasElement,
})
window.app = app // Setup global app

app.stage.addChild(wviewOld.view)
app.stage.addChild(wview.view)

const r = new DrawnRect()
r.g.calculateBounds()
r.pos = { x: 10, y: 10 }
r.size = { x: 10, y: 10 }
r.propUpdated()
wview.view.addChild(r.g)

const tire = await PIXI.Assets.load<PIXI.Texture>("assets/tire.svg")
const t1 = new PIXI.Sprite(tire)

t1.position = { x: 10, y: 10 }
app.stage.addChild(t1)

let car = new (await import('./testCar.js')).Car()
car.getBody().get().setTranslation({ x: 4, y: 0 }, true)
car.zeroJoint()

let car2 = new (await import('./testCar.js')).Car()
car2.getBody().get().setTranslation({ x: 4, y: 8 }, true)
car2.zeroJoint()

class MyWorldStepper implements IWorldStepper {
  step(frame: number, world: RAPIER.World, data: IOData): void {
    // Make everything pass from here setting world context
    setContextWorld(world)

    // REMEMBER: All state could be undefined and should be treated as 0 if that's the case!

    car.setSpeed(data.speed ?? 0)
    car.setRocket(data.rocket ?? 0)
    car.step()

    car2.setSpeed(data.remote_speed ?? 0)
    car2.setRocket(data.remote_rocket ?? 0)
    car2.step()
  }
  // No internal data!
  clone(): IWorldStepper { return this /* return new MyWorldStepper() */ }
  free() {}
}

const handler = new HandleMultyplayerIO(new WorldHandler(w, new MyWorldStepper()))
;(window as any).handler = handler

// @TODO: Should introduce some delay input latency to make rollback not as bad

app.ticker.add((dt) => {
  // dt is referred to the target speed, so it's not a time, but a normalized delta
  // Game loop

  const ioData = {
    speed: app.keyInput.axis2d('a', 'd'),
    rocket: app.keyInput.axis2d('s', 'w')
  }

  handler.stepLocal(ioData)

  {
    const sureFrame = handler.getSureFrame()
    const currFrame = handler.getCurrFrame()
    const deltaFrame = currFrame - sureFrame
    if (deltaFrame > 10) {
      if (Math.random() > 0.99) {
        const evFrame = currFrame - Math.trunc(Math.min(deltaFrame, 10) * Math.random())
        //if (Math.random() > 0.5) {
          handler.gotRemoteDiff(evFrame, { remote_speed: Math.random() - 0.5 })
        //} else {
        //  handler.gotRemoteDiff(evFrame, undefined)
        //}
      }
    }
  }

  wview.debugRender(handler.getCurrWorld())
  wviewOld.debugRender(handler.getSureWorld(), { r: 0, g: 255, b: 0 })

  r.update(dt)

  t1.position.x += 0.5 * dt
})
