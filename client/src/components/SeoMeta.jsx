/**
 * Orbin AI - SeoMeta
 * Inyecta noindex en rutas privadas y actualiza dinámicamente todas las
 * meta-tags (title, description, og, canonical, lang) y JSON-LD Article
 * para rutas de blog. Actúa en SSR-light via useEffect por ruta.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const NOINDEX_PATHS = ['/app', '/login', '/register', '/verify']

// ─── Mapa de metadatos por ruta ────────────────────────────────────────────
const ROUTE_META = {
  '/': {
    title: 'Orbin AI — Projete e Orce Armários em 30 Segundos',
    description: 'Software web para marceneiros. Projete, gere listas de corte e orçamentos em 30 segundos.',
    lang: 'pt-BR',
    ogImage: 'https://orbin.app/og-image.png',
    canonical: 'https://orbin.app/',
  },
  '/blog/como-fazer-lista-de-corte-mdf': {
    title: 'Como Fazer Lista de Corte MDF: Guia Completo | Orbin AI',
    description: 'Aprenda a gerar listas de corte MDF precisas, evitar desperdício e usar software automático para calcular todas as peças em segundos.',
    lang: 'pt-BR',
    ogImage: 'https://orbin.app/og-image.png',
    canonical: 'https://orbin.app/blog/como-fazer-lista-de-corte-mdf',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Como Fazer Lista de Corte MDF: Guia Completo para Marceneiros',
      description: 'Aprenda a gerar listas de corte MDF precisas, evitar desperdício e usar software automático para calcular todas as peças em segundos.',
      author: { '@type': 'Organization', name: 'Orbin Technologies', url: 'https://orbin.app' },
      publisher: { '@type': 'Organization', name: 'Orbin Technologies', logo: { '@type': 'ImageObject', url: 'https://orbin.app/favicon-32.png' } },
      datePublished: '2026-05-31',
      dateModified: '2026-07-19',
      image: 'https://orbin.app/og-image.png',
      url: 'https://orbin.app/blog/como-fazer-lista-de-corte-mdf',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://orbin.app/blog/como-fazer-lista-de-corte-mdf' },
    },
  },
  '/blog/corredicas-telescopicas-caixa-tecnica-13mm': {
    title: 'Caixa Técnica 13mm para Corrediças Telescópicas | Orbin AI',
    description: 'Entenda o recuo de 13mm obrigatório em módulos com corrediças telescópicas e como o Orbin AI calcula automaticamente.',
    lang: 'pt-BR',
    ogImage: 'https://orbin.app/og-image.png',
    canonical: 'https://orbin.app/blog/corredicas-telescopicas-caixa-tecnica-13mm',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Caixa Técnica 13mm: O que é e Como Aplicar em Móveis com Corrediças',
      description: 'Entenda o recuo de 13mm obrigatório em módulos com corrediças telescópicas e como o Orbin AI calcula automaticamente.',
      author: { '@type': 'Organization', name: 'Orbin Technologies', url: 'https://orbin.app' },
      publisher: { '@type': 'Organization', name: 'Orbin Technologies', logo: { '@type': 'ImageObject', url: 'https://orbin.app/favicon-32.png' } },
      datePublished: '2026-05-31',
      dateModified: '2026-07-19',
      image: 'https://orbin.app/og-image.png',
      url: 'https://orbin.app/blog/corredicas-telescopicas-caixa-tecnica-13mm',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://orbin.app/blog/corredicas-telescopicas-caixa-tecnica-13mm' },
    },
  },
  '/blog/diseno-parametrico-muebles-cocina': {
    title: 'Diseño Paramétrico de Muebles: Guía para Carpinteros | Orbin AI',
    description: 'El diseño paramétrico transforma la carpintería. Define las reglas y el software genera todo automáticamente.',
    lang: 'es',
    ogImage: 'https://orbin.app/og-image.png',
    canonical: 'https://orbin.app/blog/diseno-parametrico-muebles-cocina',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Diseño Paramétrico de Muebles: Qué es y Por qué los Mejores Carpinteros lo Usan',
      description: 'El diseño paramétrico transforma la carpintería. Define las reglas y el software genera todo automáticamente.',
      author: { '@type': 'Organization', name: 'Orbin Technologies', url: 'https://orbin.app' },
      publisher: { '@type': 'Organization', name: 'Orbin Technologies', logo: { '@type': 'ImageObject', url: 'https://orbin.app/favicon-32.png' } },
      datePublished: '2026-05-31',
      dateModified: '2026-07-19',
      image: 'https://orbin.app/og-image.png',
      url: 'https://orbin.app/blog/diseno-parametrico-muebles-cocina',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://orbin.app/blog/diseno-parametrico-muebles-cocina' },
    },
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)
}
function getOg(prop) {
  return document.querySelector(`meta[property="${prop}"]`)
}
function setOrCreate(selector, attr, value, tag = 'meta') {
  let el = document.querySelector(selector)
  if (!el) {
    el = document.createElement(tag)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
  return el
}

// ─── Componente ─────────────────────────────────────────────────────────────
export default function SeoMeta() {
  const { pathname } = useLocation()

  // — robots (noindex en rutas privadas) —
  useEffect(() => {
    const tag = getMeta('robots')
    if (!tag) return
    const isPrivate = NOINDEX_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    tag.setAttribute(
      'content',
      isPrivate
        ? 'noindex, nofollow'
        : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    )
  }, [pathname])

  // — title / description / og / canonical / lang / JSON-LD —
  useEffect(() => {
    const meta = ROUTE_META[pathname]
    if (!meta) return

    // title
    document.title = meta.title

    // lang en <html>
    document.documentElement.setAttribute('lang', meta.lang)

    // description
    const desc = getMeta('description')
    if (desc) desc.setAttribute('content', meta.description)

    // og:title
    const ogTitle = getOg('og:title')
    if (ogTitle) ogTitle.setAttribute('content', meta.title)

    // og:description
    const ogDesc = getOg('og:description')
    if (ogDesc) ogDesc.setAttribute('content', meta.description)

    // og:image
    const ogImg = getOg('og:image')
    if (ogImg) ogImg.setAttribute('content', meta.ogImage)

    // og:url
    const ogUrl = getOg('og:url')
    if (ogUrl) ogUrl.setAttribute('content', meta.canonical)

    // twitter:title
    const twTitle = getOg('twitter:title')
    if (twTitle) twTitle.setAttribute('content', meta.title)

    // twitter:description
    const twDesc = getOg('twitter:description')
    if (twDesc) twDesc.setAttribute('content', meta.description)

    // twitter:url
    const twUrl = getOg('twitter:url')
    if (twUrl) twUrl.setAttribute('content', meta.canonical)

    // canonical
    let canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.setAttribute('href', meta.canonical)

    // JSON-LD Article (solo en rutas de blog)
    const JSONLD_ID = 'orbin-jsonld-article'
    const existing = document.getElementById(JSONLD_ID)
    if (existing) existing.remove()

    if (meta.jsonld) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = JSONLD_ID
      script.textContent = JSON.stringify(meta.jsonld)
      document.head.appendChild(script)
    }

    // cleanup al desmontar o cambiar ruta
    return () => {
      const el = document.getElementById(JSONLD_ID)
      if (el) el.remove()
    }
  }, [pathname])

  return null
}
