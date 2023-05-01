
import RAPIER from "@dimforge/rapier2d";

export type IOData = Record<string, number>

export interface IWorldStepper {
  step(frame: number, world: RAPIER.World, data: IOData): void
  clone(): IWorldStepper
  free(): void
}

export class WorldHandler {
  // Given all the IO data needs to produce all the computations and step a frame
  constructor(public world: RAPIER.World, private stepper: IWorldStepper, private frame: number = 0) {}

  clone() {
    // @TODO: Should also copy all the info about the actions to apply??? internal stuff etc... (if any)
    return new WorldHandler(
      RAPIER.World.restoreSnapshot(this.world.takeSnapshot()),
      this.stepper.clone(),
      this.frame
    )
  }

  free() {
    this.world.free()
    this.stepper.free()
  }

  getFrame() { return this.frame }

  step(data: IOData) {
    // Do the stuff here
    this.stepper.step(this.frame, this.world, data)

    this.world.step()
    this.frame += 1
  }
}
