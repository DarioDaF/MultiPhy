
// Typescript 5.0+ decorator syntax

export function bind<T extends Function>(original: T, context: ClassMethodDecoratorContext) {
  const name = context.name
  context.addInitializer(function(this: any) {
    this[context.name] = this[context.name].bind(this)
  })
}

const symEventList = Symbol("EventList")
interface EventOfList {
  name: string
  f(...args: any[]): void
}
interface Dispatcher {
  on(s: string|Symbol, f: (...args: any[]) => void): void
}
export function registerEvent(eventName?: string) {
  return function<T extends Function>(original: T, context: ClassMethodDecoratorContext) {
    const _eventName = eventName ?? context.name
    context.addInitializer(function(this: any) {
      if (!(symEventList in this)) {
        this[symEventList] = [];
      }
      this[symEventList].push({ name: _eventName, f: original.bind(this) });
    })
  }
}
export function registerEvents(obj: any, dispatcher: Dispatcher) {
  const _obj = obj as { [symEventList]: EventOfList[] }
  for (const { name, f } of _obj[symEventList]) {
    dispatcher.on(name, f)
  }
}

export function min<T>(key: (x: T) => number, ...vals: T[]): T | undefined {
  let minValue = Infinity
  let res = undefined
  for (let val of vals) {
    const localValue = key(val)
    if (localValue < minValue) {
      minValue = localValue
      res = val
    }
  }
  return res
}

class AssertError extends Error {
  constructor(msg: string) {
    super(msg)
  }
}

export function assert(cond: boolean, msg?: string) {
  if (!cond) {
    const extraMsg = (msg !== undefined) ? ': ' + msg : ''
    throw new AssertError("Assertion failed" + extraMsg)
  }
}
