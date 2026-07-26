// prerender.mjs — Genera HTML estático para rutas públicas del blog
// Estrategia: clonar dist/index.html y reemplazar meta-tags por ruta.
// Sin dependencias extra — solo Node.js stdlib (fs, path, url).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir   = path.resolve(__dirname, '../dist')
const templatePath = path.join(distDir, 'index.html')

if (!fs.existsSync(templatePath)) {
  console.error('❌ dist/index.html no encontrado. Ejecuta npm run build primero.')
  process.exit(1)
}

const template = fs.readFileSync(templatePath, 'utf-8')

const ROUTES = [
  {
    path: '/blog/como-fazer-lista-de-corte-mdf',
    title: 'Como Fazer Lista de Corte MDF: Guia Completo | Orbin AI',
    description: 'Aprenda a gerar listas de corte MDF precisas, evitar desperdício e usar software automático para calcular todas as peças em segundos.',
    canonical: 'https://orbin.app/blog/como-fazer-lista-de-corte-mdf',
    lang: 'pt-BR',
    ogImage: 'https://orbin.app/og-image.png',
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
  {
    path: '/blog/corredicas-telescopicas-caixa-tecnica-13mm',
    title: 'Caixa Técnica 13mm para Corrediças Telescópicas | Orbin AI',
    description: 'Entenda o recuo de 13mm obrigatório em módulos com corrediças telescópicas e como o Orbin AI calcula automaticamente.',
    canonical: 'https://orbin.app/blog/corredicas-telescopicas-caixa-tecnica-13mm',
    lang: 'pt-BR',
    ogImage: 'https://orbin.app/og-image.png',
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
  {
    path: '/blog/diseno-parametrico-muebles-cocina',
    title: 'Diseño Paramétrico de Muebles: Guía para Carpinteros | Orbin AI',
    description: 'El diseño paramétrico transforma la carpintería. Define las reglas y el software genera todo automáticamente.',
    canonical: 'https://orbin.app/blog/diseno-parametrico-muebles-cocina',
    lang: 'es',
    ogImage: 'https://orbin.app/og-image.png',
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
]

for (const route of ROUTES) {
  let html = template

  // lang en <html>
  html = html.replace(/(<html[^>]*\slang=")[^"]*(")/i, `$1${route.lang}$2`)

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)

  // meta description
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${route.description}$2`,
  )

  // canonical
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    `$1${route.canonical}$2`,
  )

  // og:url
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    `$1${route.canonical}$2`,
  )

  // og:title
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${route.title}$2`,
  )

  // og:description
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${route.description}$2`,
  )

  // og:image
  html = html.replace(
    /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
    `$1${route.ogImage}$2`,
  )

  // twitter:title
  html = html.replace(
    /(<meta\s+property="twitter:title"\s+content=")[^"]*(")/,
    `$1${route.title}$2`,
  )

  // twitter:description
  html = html.replace(
    /(<meta\s+property="twitter:description"\s+content=")[^"]*(")/,
    `$1${route.description}$2`,
  )

  // twitter:url
  html = html.replace(
    /(<meta\s+property="twitter:url"\s+content=")[^"]*(")/,
    `$1${route.canonical}$2`,
  )

  // Inyectar JSON-LD Article antes de </head>
  const articleJsonLd = `  <script type="application/ld+json">${JSON.stringify(route.jsonld, null, 2)}<\/script>\n`
  html = html.replace('</head>', `${articleJsonLd}</head>`)

  // Escribir archivo
  const outDir = path.join(distDir, route.path)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8')
  console.log(`✅ Prerenderizado: ${route.path}`)
}

console.log('\n🎯 Prerender completo. Archivos generados en dist/')
