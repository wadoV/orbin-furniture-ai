import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003'

let socket = null

export function initCollaboration(roomId, userName) {
  if (socket) return socket

  socket = io(SOCKET_URL, {
    reconnectionAttempts: 5,
    timeout: 10000,
  })

  socket.on('connect', () => {
    console.log('[Collaboration] Connected to server')
    socket.emit('join-room', roomId, { name: userName })
  })

  socket.on('disconnect', () => {
    console.log('[Collaboration] Disconnected from server')
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectCollaboration() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
