const baseUrl = (process.env.WEB_SMOKE_BASE_URL || 'http://localhost:3002').replace(/\/+$/, '')
const paths = (process.env.WEB_SMOKE_PATHS || '/,/users,/vehicles,/dashboard')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const contentType = response.headers.get('content-type') || ''
  const body = await response.text()
  return { response, contentType, body }
}

function collectStaticChunks(html) {
  const chunks = new Set()
  const patterns = [
    /src=["']([^"']*\/_next\/static\/chunks\/[^"']+\.js)["']/g,
    /href=["']([^"']*\/_next\/static\/chunks\/[^"']+\.js)["']/g,
  ]

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      chunks.add(match[1].replace(/&amp;/g, '&'))
    }
  }

  return [...chunks]
}

function isJavaScriptContentType(contentType) {
  return /(?:application|text)\/(?:javascript|x-javascript|ecmascript)/i.test(contentType)
}

async function main() {
  const failures = []
  const checkedChunks = new Set()

  for (const path of paths) {
    const pageUrl = resolveUrl(path)
    const { response, contentType, body } = await fetchText(pageUrl)
    if (!response.ok && response.status !== 307 && response.status !== 308) {
      failures.push(`${pageUrl} returned ${response.status} ${contentType}`)
      continue
    }

    const chunks = collectStaticChunks(body)
    for (const chunk of chunks) {
      const chunkUrl = chunk.startsWith('http') ? chunk : `${baseUrl}${chunk.startsWith('/') ? chunk : `/${chunk}`}`
      if (checkedChunks.has(chunkUrl)) continue
      checkedChunks.add(chunkUrl)

      const chunkResponse = await fetch(chunkUrl, { redirect: 'manual' })
      const chunkType = chunkResponse.headers.get('content-type') || ''
      if (!chunkResponse.ok || !isJavaScriptContentType(chunkType)) {
        failures.push(`${chunkUrl} returned ${chunkResponse.status} ${chunkType || 'no content-type'}`)
      }
    }
  }

  if (failures.length) {
    console.error('Static chunk smoke failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(`Static chunk smoke passed: ${paths.length} pages, ${checkedChunks.size} chunks`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
