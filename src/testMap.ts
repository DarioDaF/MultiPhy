import RAPIER from "@dimforge/rapier2d";
import { getContextWorld } from "./worldHandleManager";
import { PRNG } from "./helpers/math";

const prng = PRNG.fromHash('2c6de981-6fa2-4b0f-bc46-cc01e32f1526')

export function CreateMap() {
  const w = getContextWorld()

  const width = 150

  const hs = new Float32Array(150)
  for (let i = 0; i < hs.length; ++i) {
    hs[i] = prng.random()
  }

  // Apply IIR
  let alpha = 0.5
  let t = hs[0]
  for (let i = 0; i < hs.length; ++i) {
    alpha -= 0.8 / hs.length
    if (alpha < 0) alpha = 0
    t *= alpha
    t += hs[i] * (1 - alpha)
    hs[i] = t
  }

  w.createCollider(
    RAPIER.ColliderDesc.heightfield(hs, new RAPIER.Vector2(width, 1))
      .setTranslation(width / 2, 10.0)
  ).setCollisionGroups(0x00030003)
  w.createCollider(
    RAPIER.ColliderDesc.halfspace(new RAPIER.Vector2(1, 0))
      .setTranslation(0, 0)
  ).setCollisionGroups(0x00030003)
  w.createCollider(
    RAPIER.ColliderDesc.halfspace(new RAPIER.Vector2(-1, 0))
      .setTranslation(width, 0)
  ).setCollisionGroups(0x00030003)

  // Add a bunch of objects here and there
  for (let i = 0; i < 100; ++i) {
    const body = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const coll = w.createCollider(
      RAPIER.ColliderDesc.capsule(0.2, 0.2)
        .setRotation(Math.PI / 2)
        .setTranslation(prng.random() * (width - 30) + 30, 8),
      body
    )
    coll.setDensity(5)
    coll.setCollisionGroups(0x00030003)
    body.addTorque((prng.random() - 0.5) * 10, true)
    
    //body.setEnabled()
  }

  return { width }
}
