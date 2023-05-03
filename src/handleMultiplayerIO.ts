
import RAPIER from '@dimforge/rapier2d'
import { SortedArr } from './helpers/structures'
import { assert } from './helpers/func'

import type { IOData, WorldHandler } from './wolrdHandler'
import { getContextWorld, setContextWorld } from './worldHandleManager'

type IOEvent = {
  frame: number
  diff: IOData // This diff MUST be applied when `frame` is correct before the `step`!
  // so if you are at frame 0 and you get a frame 0 event it's all fine and correct
}

export type IORemoteEvent = {
  frame: number
  diff?: IOData
}

function applyDiff(data: IOData, diff: IOData) {
  for (const [ k, v ] of Object.entries(diff))
    data[k] = v
}

function diffData(oldData: IOData, newData: IOData) {
  // new and old data keys SHOULD match!
  // initial state is supposed ALL 0
  let hasDiff = false
  const res: IOData = {}
  for (const [ k, v ] of Object.entries(newData)) {
    if ((oldData[k] ?? 0) !== v) {
      res[k] = v
      hasDiff = true
    }
  }
  return hasDiff ? res : undefined
}

class FrameState {
  private events = new SortedArr<IOEvent, number>([], el => el.frame)

  constructor(public snapshot: WorldHandler, public state: IOData) {}

  clone() {
    const res = new FrameState(undefined!, {})
    res.makeCopyFrom(this)
    return res
  }

  makeCopyFrom(other: FrameState) {
    this.snapshot?.free()
    this.snapshot = other.snapshot.clone()
    this.state = { ...other.state }
    this.events.arr = [ ...other.events.arr ]
  }

  getFrame() { return this.snapshot.getFrame() }

  addEvent(ev: IOEvent) {
    assert(ev.frame >= this.getFrame())
    this.events.insert(ev)
  }

  applyEvent({ diff }: IOEvent) {
    applyDiff(this.state, diff)
  }

  step() {
    this.snapshot.step(this.state)
  }

  private noEventStepTo(targetFrame: number) {
    while (this.snapshot.getFrame() < targetFrame) {
      this.step()
    }
    assert(targetFrame === this.snapshot.getFrame())
  }

  forward(targetFrame: number) {
    let i: number
    for (i = 0; i < this.events.arr.length; ++i) {
      const ev = this.events.arr[i]
      if (ev.frame > targetFrame) {
        break
      }
      // Parse the event!
      this.noEventStepTo(ev.frame) // It's fine could move 0 steps in case of 2 events with same frame
      this.applyEvent(ev) // Must be applied when it's `ev.frame`
    }
    this.events.arr.splice(0, i) // Remove parsed events
    this.noEventStepTo(targetFrame) // Advance to target only when events are for sure not present
  }
}

export class HandleMultyplayerIO {
  private currState: FrameState
  private sureState: FrameState

  constructor(handler: WorldHandler) {
    this.currState = new FrameState(handler, {})
    this.sureState = this.currState.clone()
  }

  getCurrWorld() { return this.currState.snapshot.world }
  getSureWorld() { return this.sureState.snapshot.world }
  getCurrFrame() { return this.currState.getFrame() }
  getSureFrame() { return this.sureState.getFrame() }

  stepLocal(state: IOData) {
    let ev: IOEvent | undefined = undefined
    const localDiff = diffData(this.currState.state, state)
    if (localDiff !== undefined) {
      ev = { frame: this.currState.getFrame(), diff: localDiff }
      {
        // What if frame is not in sync?
        const sureFrame = this.sureState.getFrame()
        const currFrame = this.sureState.getFrame()
        if (sureFrame > currFrame) {
          // @TODO: Should never happen but does?
          this.currState.forward(sureFrame)
          ev.frame = sureFrame
        }
      }
      this.currState.applyEvent(ev) // currState doesn't need events in queue! (so directly apply them)
      this.sureState.addEvent(ev)
    }
    this.currState.step()
    return ev
  }

  gotRemoteDiff(frame: number, diff?: IOData) {
    // @TODO: Remote diffs MUST be in the past!

    if (diff !== undefined)
      this.sureState.addEvent({ frame, diff }) // This SHOULD also guarantee it's all OK up to frame!!!
    //console.log("Forwarding Sure State")
    //;(this.sureState.snapshot.world as any)._event = "forwardingSure"
    this.sureState.forward(frame) // So advance there
    //;(this.sureState.snapshot.world as any)._event = undefined
    //console.log("Done Forwarding Sure State")

    if (diff === undefined)
      return

    // If the diff was not empty the world needs rollback
    const currFrame = this.currState.getFrame()
    this.currState.makeCopyFrom(this.sureState)
    if (currFrame > this.currState.getFrame()) {
      // @TODO: Should also slow down client tho...
      this.currState.forward(currFrame)
    }
  }
}
