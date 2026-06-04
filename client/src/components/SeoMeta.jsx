/**
 * Orbin AI - SeoMeta
 * Inyecta noindex en rutas privadas via useEffect sobre <meta name="robots">.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const NOINDEX_PATHS = ['/app', '/login', '/register']

export default function SeoMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const tag = document.querySelector('meta[name="robots"]')
    if (!tag) return
    const isPrivate = NOINDEX_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    tag.setAttribute('content', isPrivate
      ? 'noindex, nofollow'
      : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
    )
  }, [pathname])

  return null
}
