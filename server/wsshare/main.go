package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // Accept all origings
}

// define a reader which will listen for
// new messages being sent to our WebSocket
// endpoint
func reader(conn *websocket.Conn, roomK string, isHost bool) {

	getOther := func() *websocket.Conn {
		if isHost {
			return myRooms[roomK].client
		} else {
			return myRooms[roomK].host
		}
	}

	for {
		// read in a message
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		// print out that message for clarity
		log.Println(string(p))

		err = getOther().WriteMessage(messageType, p)
		if err != nil {
			log.Println(err)
			return
		}
	}
}

type msg struct {
	// NEED TO BE UPPERCASE FIRST LETTER! otherwise they are private
	Event string
	//data interface{}
	Data string
}

func newMsg_room(room string) msg {
	return msg{
		Event: "newRoom",
		Data:  room,
	}
}
func newMsg_client() msg {
	return msg{
		Event: "newClient",
	}
}

func wsEndpoint(w http.ResponseWriter, r *http.Request) {
	prefix := r.URL.Query().Get("prefix")
	if !validatePrefix(prefix) {
		log.Printf("Invalid prefix: %s\n", prefix)
		return
	}
	wantedRoom := r.URL.Query().Get("room")
	forceHost := r.URL.Query().Has("forceHost")

	// Upgrade connection to a WebSocket
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	isHost := forceHost || (wantedRoom == "")

	var room string
	if isHost {
		room = hostRoom(prefix, wantedRoom, ws)
	} else {
		room = joinRoom(prefix, wantedRoom, ws)
	}

	if room == "" {
		log.Printf("Invalid room %s\n", wantedRoom)
		return
	}

	roomK := roomKey(prefix, room)

	if isHost {
		defer func() {
			fmt.Printf("Deleting room %s\n", room)
			delete(myRooms, roomK)
		}()

		err = ws.WriteJSON(newMsg_room(room))
		if err != nil {
			log.Println(err)
			return
		}
	} else {
		defer func() {
			fmt.Printf("Deleting client for room %s\n", room)
			myRooms[roomK].client = nil
		}()

		err = myRooms[roomK].host.WriteJSON(newMsg_client())
		if err != nil {
			log.Println(err)
			return
		}
	}

	log.Printf("Client connected to %s\n", room)

	reader(ws, roomK, isHost)
}

func main() {
	const port = 8123
	fmt.Printf("Starting server on port: %d\n", port)
	http.HandleFunc("/ws", wsEndpoint)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}
