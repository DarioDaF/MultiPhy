
declare namespace GlobalMixins {
  interface Application {
    dragger: import('./dragPlugin').DragPlugin
    keyInput: import('./keyInputPlugin').KeyInputPlugin
  }
}

interface Window {
  app: import('pixi.js').Application
  world: import('@dimforge/rapier2d').World
}
