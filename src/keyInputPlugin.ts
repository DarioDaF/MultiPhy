
import * as PIXI from 'pixi.js'
import { Renderer, ExtensionType, ExtensionMetadata, extensions, Application, Graphics, FederatedPointerEvent, Runner } from 'pixi.js'

import { min, registerEvent, registerEvents } from './helpers/func'

import { PMath as PM } from './helpers/math'

export class KeyInputPlugin // : ISystem
{
  static extension: ExtensionMetadata = {
    name: 'KeyInputPlugin',
    type: ExtensionType.Application
  };
  static version = '0.0.1';

  static destroy(this: Application) {
    this.keyInput.destroy()
  }

  static init(this: Application) {
    this.keyInput = new KeyInputPlugin(this)
  }

  // Actual implementation

  public keyPressed = new Set<string>()

  @registerEvent()
  private keydown(e: KeyboardEvent) {
    this.keyPressed.add(e.key)
  }
  @registerEvent()
  private keyup(e: KeyboardEvent) {
    this.keyPressed.delete(e.key)
  }

  axis2d(keyBw: string, keyFw: string) {
    return (
      + (this.keyPressed.has(keyFw) ? 1 : 0)
      - (this.keyPressed.has(keyBw) ? 1 : 0)
    )
  }

  constructor(private app: Application) {
    (this.app.view as HTMLCanvasElement).tabIndex = 0
    const eventDispatcher = {
      on: (name: string, cb: EventListenerOrEventListenerObject) => this.app.view.addEventListener?.(name, cb)
    }
    registerEvents(this, eventDispatcher)
  }

  destroy() {
    // @TODO: Should deregister events
  }

}

extensions.add(KeyInputPlugin)
