import { assert } from "./helpers/func"

type Future<T> = {
  resolve: (data: T) => void
  reject: () => void
}

async function getConnInfo() {
  const res = await fetch('dist/conninfo.json')
  return await res.json() as {
    WSUrl: string
    ICEUrl: string
  }
}
const connInfo = await getConnInfo()

export class PromiseMessageQueue<T> {
  private queue: T[] = []
  private promises: Future<T>[] = []
  private closed = false

  waitData() {
    if (this.closed) {
      return Promise.reject()
    }
    return new Promise<T>((resolve, reject) => {
      if(this.queue.length > 0) {
        resolve(this.queue.slice(0, 1)[0])
      } else {
        this.promises.push({
          resolve, reject
        })
      }
    })
  }
  addData(data: T) {
    if(this.promises.length > 0) {
      this.promises.splice(0, 1)[0].resolve(data)
    } else {
      this.queue.push(data)
    }
  }
  close() {
    this.closed = true
    for (const p of this.promises) {
      p.reject()
    }
  }
}

const WS_PREFIX = 'multiphy'

export function CreateWS(room?: string) {
  const wsurl = new URL(connInfo.WSUrl)
  wsurl.searchParams.append('prefix', WS_PREFIX)
  wsurl.searchParams.append('room', room ?? '')
  const ws = new WebSocket(wsurl)

  const pmq = new PromiseMessageQueue<any>()
  ws.onmessage = (e) => {
    pmq.addData(JSON.parse(e.data))
  }
  ws.onerror = (e) => {
    console.error(e)
  }
  ws.onclose = (e) => {
    pmq.close()
  }
  return { ws, pmq }
}

let _iceServers: RTCIceServer[] | undefined = undefined;
async function getIce(): Promise<RTCIceServer[]> {
  if (_iceServers === undefined) {
    const response = await fetch(connInfo.ICEUrl)
    _iceServers = await response.json()
  }
  return _iceServers!
}

export async function CreateRTC(room?: string) {

  const RTCSettings: RTCConfiguration = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun4.l.google.com:19302"] },
      // If you need TURN use something like https://www.metered.ca/tools/openrelay/
      // DO NOT USE MY SERVER (otherwise it's simpler to just chat via WebSocket then...)
    ]
  }
  try {
    RTCSettings.iceServers = await getIce()
  } catch {}

  const cws = CreateWS(room)

  function sendJSON(obj: any) {
    cws.ws.send(JSON.stringify(obj))
  }

  const isHost = room === undefined

  let ev
  if (isHost) {
    console.log("Starting host")

    ev = await cws.pmq.waitData()
    assert(ev.Event === 'newRoom')
    room = ev.Data
    console.log(`Waiting for connection on room ${room}`)

    // Got new client
    ev = await cws.pmq.waitData()
    assert(ev.Event === 'newClient')
    console.log("Got new client")

    const myConn = new RTCPeerConnection(RTCSettings)
    const connPromise = new Promise<void>(resolve => {
      myConn.onconnectionstatechange = (e) => {
        console.log(`Changed state: ${myConn.connectionState}`)
        if (myConn.connectionState === 'connected')
          resolve()
      }
    })

    const channel = myConn.createDataChannel('channel')
    console.log("Created channel (needed before offer, or nothing will be offered?)")

    myConn.onicecandidate = (e) => {
      // Send ICE!
      sendJSON({ Event: 'ice', Data: e.candidate })
      console.log("Sent ICE")
    }
    const offer = await myConn.createOffer()
    await myConn.setLocalDescription(offer)
    sendJSON({ Event: 'offer', Data: offer })
    console.log("Sent offer")

    ev = await cws.pmq.waitData()
    assert(ev.Event === 'answer')
    myConn.setRemoteDescription(ev.Data)
    console.log("Received answer")

    while (true) {
      ev = await Promise.any([ connPromise, cws.pmq.waitData() ])
      if (ev === undefined) {
        break // Connected
      }

      // Reveived ICEs
      assert(ev.Event === 'ice')
      await myConn.addIceCandidate(ev.Data)
      console.log("Received ICE")
    }

    cws.ws.close()

    return { myConn, channel }
  } else {    
    console.log("Starting client")

    ev = await cws.pmq.waitData()
    assert(ev.Event === 'offer')
    console.log("Received offer")

    const myConn = new RTCPeerConnection(RTCSettings)    
    const connPromise = new Promise<void>(resolve => {
      myConn.onconnectionstatechange = (e) => {
        console.log(`Changed state: ${myConn.connectionState}`)
        if (myConn.connectionState === 'connected')
          resolve()
      }
    })

    const channelPromise = new Promise<RTCDataChannel>(resolve => {
      myConn.ondatachannel = (e) => {
        console.log(`Got a channel`)
        resolve(e.channel)
      }
    })

    myConn.onicecandidate = (e) => {
      // Send ICE!
      sendJSON({ Event: 'ice', Data: e.candidate })
      console.log("Sent ICE")
    }

    await myConn.setRemoteDescription(ev.Data)
    const answer = await myConn.createAnswer()
    myConn.setLocalDescription(answer)
    sendJSON({ Event: 'answer', Data: answer })
    console.log("Sent answer")

    while (true) {
      ev = await Promise.any([ connPromise, cws.pmq.waitData() ])
      if (ev === undefined) {
        break // Connected
      }

      // Reveived ICEs
      assert(ev.Event === 'ice')
      await myConn.addIceCandidate(ev.Data)
      console.log("Received ICE")
    }

    cws.ws.close()

    return { myConn, channel: await channelPromise }
  }
}
