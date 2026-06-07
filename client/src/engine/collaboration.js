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

  // ★ SEG: el server rechaza salas inválidas o llenas — no fallar en silencio
  socket.on('join-error', (info) => {
    console.warn('[Collaboration] join-error:', info)
    const msg = info && info.reason === 'room_full'
      ? 'La sala está llena (máximo 12 participantes).'
      : 'El enlace de la sala no es válido o expiró.'
    try { alert(msg) } catch {}
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
