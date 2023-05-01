
import { Renderer, ExtensionType, ExtensionMetadata, extensions } from 'pixi.js'

import { bind } from './helpers/func'

class DragPlugin // : ISystem
{
  static extension: ExtensionMetadata = {
    name: 'DragPlugin',
    type: ExtensionType.RendererPlugin //ExtensionType.RendererSystem
  };
  static version = '0.0.1';

  constructor(private r: Renderer) {
    this.r.on('prerender', this.onPrerender)
    //this.r.runners.prerender.add(this) // calls this.prerender.bind(this.r)

    this.r.events.rootBoundary.addEventMapping('pointerup', this.onPointerUp)
    this.r.events.rootBoundary.addEventMapping('pointerdown', this.onPointerDown)

    console.log('Initialized the drag plugin')
  }

  @bind
  private onPrerender(x: any) {
    console.log(this)
  }

  @bind
  private onPointerDown() {

  }
  @bind
  private onPointerUp() {

  }
  /*
  // Call on each render frame instead?
  @bind
  private onPointerMove() {}
  */

  destroy() {
    console.log('Destroy')
  }
}

extensions.add(DragPlugin)
