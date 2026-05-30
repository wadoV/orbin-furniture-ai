import React, { useEffect, useState } from 'react'
import { MousePointer2 } from 'lucide-react'

// Simple hash to assign a distinct color based on username
function getColorFromName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 80%, 60%)`
}

export default function MultiplayerLayer({ socket }) {
  const [cursors, setCursors] = useState({})

  useEffect(() => {
    if (!socket) return

    // Throttle cursor emit to save bandwidth
    let lastEmit = 0
    const THROTTLE_MS = 50 // ~20fps

    const handleMouseMove = (e) => {
      const now = Date.now()
      if (now - lastEmit > THROTTLE_MS) {
        socket.emit('cursor-move', { x: e.clientX, y: e.clientY })
        lastEmit = now
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Listen for incoming cursors
    socket.on('cursor-update', (data) => {
      setCursors(prev => ({
        ...prev,
        [data.id]: {
          x: data.x,
          y: data.y,
          name: data.name || 'Anónimo',
          lastUpdate: Date.now()
        }
      }))
    })

    socket.on('user-left', (id) => {
      setCursors(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    })

    // Clean up stale cursors every second
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      setCursors(prev => {
        let changed = false
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          if (now - next[id].lastUpdate > 5000) { // stale after 5s
            delete next[id]
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, 1000)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      socket.off('cursor-update')
      socket.off('user-left')
      clearInterval(cleanupInterval)
    }
  }, [socket])

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {Object.entries(cursors).map(([id, cursor]) => {
        const color = getColorFromName(cursor.name)
        return (
          <div
            key={id}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            }}
          >
            <MousePointer2
              size={18}
              fill={color}
              color="white"
              className="drop-shadow-md"
              style={{ transform: 'rotate(-20deg) translate(-2px, -2px)' }}
            />
            <div
              className="mt-1 ml-3 px-2 py-0.5 text-[10px] font-bold text-white rounded shadow-md border border-white/20 whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {cursor.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
