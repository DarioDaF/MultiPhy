
import './esbuild_hotreload'

import './rtcChannel'

import * as PIXI from 'pixi.js'
import './dragPlugin'
import './keyInputPlugin'
// Options and alternatives https://bevyengine.org/
import RAPIER from '@dimforge/rapier2d'

import { SimWorldView, DrawnRect } from './designer'
import { HandleMultyplayerIO, IORemoteEvent } from './handleMultiplayerIO'
import { IOData, IWorldStepper, WorldHandler } from './wolrdHandler'
import { RBHandle, setContextWorld } from './worldHandleManager'
import { CreateRTC, CreateWS } from './rtcChannel'
import { CreateMap } from './testMap'
import { delay } from './helpers/func'
import { Car } from './testCar'
import { PMath as PM } from './helpers/math'

const search = new URLSearchParams(location.search)

// Needed if RAPIER is loaded as "-compat" module to register the wasm code
const COMPAT_RAPIER = RAPIER as { init?(): Promise<void> }
await COMPAT_RAPIER.init?.()

function* getRBColliders(rbs: RBHandle[]) {
  for (const _rb of rbs) {
    const rb = _rb.get()
    for (let i = 0; i < rb.numColliders(); ++i) {
      yield rb.collider(i)
    }  
  }
}

const w = new RAPIER.World({ x: 0, y: 9.81 }) // Positive gravity to match Y positive downward in graphics
setContextWorld(w) // Set context
window.world = w
const wview = new SimWorldView({ x: 0, y: 0 })
const wviewOld = new SimWorldView({ x: 0, y: 0 })

const gameMap = CreateMap()

//RAPIER.ColliderDesc.roundConvexPolyline()
//https://github.com/schteppe/poly-decomp.js/ Too many polys???
//https://mpen.ca/406/bayazit Is the same? Maybe the simpler version is better for physics
// Cause I like NON SMALL polys
//https://github.com/dimforge/nphysics ?
//https://github.com/jrouwe/JoltPhysics Look here !!!

const app = new PIXI.Application({
  view: document.getElementById('screen') as HTMLCanvasElement,
})
window.app = app // Setup global app

app.ticker.maxFPS = 30
w.integrationParameters.dt = 1 / app.ticker.maxFPS

const worldCamera = new PIXI.Container()

worldCamera.addChild(wviewOld.view)
worldCamera.addChild(wview.view)

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

const car = new Car()
car.getBody().get().setTranslation({ x: 4, y: 8 }, true)
car.zeroJoint()
for (const coll of getRBColliders(car.getRBs())) {
  coll.setCollisionGroups(0x00010001)
}

const car2 = new Car()
car2.getBody().get().setTranslation({ x: 4, y: 8 }, true)
car2.zeroJoint()
for (const coll of getRBColliders(car2.getRBs())) {
  coll.setCollisionGroups(0x00020002)
}

const playerMarker = new PIXI.Graphics()
{
  playerMarker.beginFill({ r: 0, g: 200, b: 150 })
  playerMarker.drawCircle(0, 0, 0.15)
  playerMarker.endFill()
}
wview.prepareDbgGraphics() // Make sure rendering order is correct
wview.view.addChild(playerMarker)

app.stage.addChild(worldCamera)

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

/*
const room = search.get('room') ?? ''
const isHost = search.get('isClient') === null

if (!isHost) {
  await delay(200)
}
*/

const $info = (document.getElementById('info') as HTMLSpanElement)

const { room, isHost } = await new Promise<{ room: string, isHost: boolean }>(resolve => {
  function returnData(isHost: boolean) {
    const room = (document.getElementById('room') as HTMLInputElement).value
    resolve({ room, isHost })
  }

  (document.getElementById('runHost') as HTMLButtonElement).onclick = e => { returnData(true) }
  (document.getElementById('runClient') as HTMLButtonElement).onclick = e => { returnData(false) }
})
$info.textContent = `Waiting in room ${room} as ${isHost ? 'HOST' : 'CLIENT'} for other user...`

//const rtc = await CreateRTC(room, isHost)
const rtc = { channel: await CreateWS(room, isHost) }

rtc.channel.onclose = (e) => {
  $info.textContent = 'Channel closed, reload the page to try again (make sure HOST connects before CLIENT and that the room is available)'
}

const hasNewClient = new Promise<void>(gotNewClient => {
  rtc.channel.onmessage = e => {
    const msg = JSON.parse(e.data)
    if (msg.Event === 'newClient') {
      if (isHost) {
        rtc.channel.send(JSON.stringify({
          Event: 'newClient',
          Data: ''
        }))
      }
      gotNewClient()
      return
    }

    const { frame, diff } = msg
    if (frame !== undefined)
      handler.gotRemoteDiff(frame, diff)
  }
})

await hasNewClient
$info.textContent = `Other client connected`

{
  const txt = new PIXI.Text('Race to the right ->', {
    fontSize: 32,
    fill: '#FF0000'
  })
  txt.scale.set(0.02, 0.02)
  txt.position.set(1, 5)
  wview.view.addChild(txt)
}

{
  const txt = new PIXI.Text(
    'If you touch here first you win\n' +
    'Or pretend you did cause\n' +
    'there is nothing',
    {
      fontSize: 32,
      fill: '#FF0000'
    }
  )
  txt.scale.set(0.02, 0.02)
  txt.position.set(gameMap.width + 1, 5)
  wview.view.addChild(txt)
}

let lastFrameSent = 0

app.ticker.add((dt) => {
  // dt is referred to the target speed, so it's not a time, but a normalized delta
  // Game loop

  let ioData = {}
  if (isHost) {
    ioData = {
      speed: app.keyInput.axis2d('a', 'd'),
      rocket: app.keyInput.axis2d('s', 'w')
    }
  } else {
    ioData = {
      remote_speed: app.keyInput.axis2d('a', 'd'),
      remote_rocket: app.keyInput.axis2d('s', 'w')
    }
  }

  const ev = handler.stepLocal(ioData)
  if (ev !== undefined) {
    // Send the event!
    rtc.channel.send(JSON.stringify(ev))
    lastFrameSent = ev.frame
  } else {
    const currFrame = handler.getCurrFrame()
    if (currFrame - lastFrameSent > 20) {
      const dummyEv: IORemoteEvent = { frame: currFrame }
      rtc.channel.send(JSON.stringify(dummyEv))
      lastFrameSent = dummyEv.frame
    }
  }

  /*
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
  */

  {
    setContextWorld(handler.getCurrWorld())
    const myCarBody = (isHost ? car : car2).getBody().get()

    worldCamera.position.copyFrom(
      PM.add(
        PM.mulS(PM.P(app.screen.width, app.screen.height), .5),
        PM.mulS(myCarBody.translation(), -wview.mToP)
      )
    )

    playerMarker.position.copyFrom(myCarBody.translation())
    playerMarker.rotation = myCarBody.rotation()
  }

  wview.debugRender(handler.getCurrWorld())
  wviewOld.debugRender(handler.getSureWorld(), { r: 0, g: 50, b: 0 })

  r.update(dt)

  t1.position.x += 0.5 * dt
})
