package main

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var myRand = rand.New(rand.NewSource(time.Now().UnixNano()))

const maxPrefixLen = 30
const roomLen = 10

var validChars = []rune("abcdefghijklmnopqrstuvwxyz" +
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
	"0123456789")

func randomRoom() string {
	var b strings.Builder
	for i := 0; i < roomLen; i++ {
		b.WriteRune(validChars[myRand.Intn(len(validChars))])
	}
	return b.String()
}

type roomData struct {
	host   *websocket.Conn
	client *websocket.Conn
}

var myRooms = make(map[string]*roomData)

func roomKey(prefix string, room string) string {
	return prefix + "_" + room
}

func hostRoom(prefix string, wantedRoom string, conn *websocket.Conn) string {
	const tries = 10

	room := wantedRoom
	invalidRoom := true
	if room != "" {
		_, invalidRoom = myRooms[roomKey(prefix, room)]
	} else {
		i := 0
		for invalidRoom && i < tries {
			room = randomRoom()
			_, invalidRoom = myRooms[roomKey(prefix, room)]
			i++
		}
		fmt.Printf("Searched for a free room %d times\n", i)
	}
	if invalidRoom {
		fmt.Printf("Cannot assign room %s\n", room)
		return ""
	}

	fmt.Printf("Adding room %s\n", room)
	myRooms[roomKey(prefix, room)] = &roomData{
		host:   conn,
		client: nil,
	}

	return room
}

func validRune(r rune) bool {
	for _, ok_r := range validChars {
		if r == ok_r {
			return true
		}
	}
	return false
}

func validatePrefix(prefix string) bool {
	if len(prefix) > maxPrefixLen {
		return false
	}
	for _, r := range prefix {
		if !validRune(r) {
			return false
		}
	}
	return true
}

func joinRoom(prefix string, room string, conn *websocket.Conn) string {
	data, validRoom := myRooms[roomKey(prefix, room)]
	if !validRoom {
		fmt.Printf("Room %s missing\n", room)
		return ""
	}
	if data.client != nil {
		fmt.Printf("Room %s full\n", room)
		return ""
	}

	data.client = conn
	return room
}
