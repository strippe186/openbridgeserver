// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

async function loadUseIconsWithSvg(svgContent: string) {
  vi.resetModules()
  vi.doMock('@/api/client', () => ({
    getJwt: () => null,
    getAllSessionTokens: () => [],
    icons: {
      list: vi.fn().mockResolvedValue({
        icons: [{ name: 'test-icon', content: svgContent }],
      }),
    },
  }))
  const mod = await import('./useIcons')
  return mod.useIcons()
}

describe('useIcons sanitizeSvg', () => {
  it('blocks javascript href with embedded control chars', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="java&#x0A;script:alert(1)"><rect width="12" height="8"/></a></svg>',
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).not.toContain('href=')
  })

  it('still removes root width/height attributes', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="12" height="8"/></svg>',
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).not.toContain(' width="100"')
    expect(sanitized).not.toContain(' height="50"')
  })

  it('removes SMIL animation elements that can mutate links', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="#"><animate attributeName="href" values="javascript:alert(1)"/></a></svg>',
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).not.toContain('<animate')
  })

  const PNG_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg=='

  it('keeps a base64 PNG embedded in an <image> element', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image width="1" height="1" href="${PNG_URI}"/></svg>`,
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).toContain(`href="${PNG_URI}"`)
  })

  it('keeps a namespaced, line-wrapped raster data URI as written by Inkscape', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
      + '<image xlink:href="data:image/jpeg;base64,/9j/4AAQ&#10;SkZJRg=="/></svg>',
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).toContain('xlink:href="data:image/jpeg;base64,/9j/4AAQ')
  })

  it.each([
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/png;base64,abc!def',
    'javascript:alert(1)',
  ])('strips %s on an <image> element', async (href) => {
    const { getSvg } = await loadUseIconsWithSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><image href="${href}"/></svg>`,
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).not.toContain('href=')
  })

  it('strips a raster data URI on elements other than <image>', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><use href="${PNG_URI}"/><a href="${PNG_URI}"><rect width="1" height="1"/></a></svg>`,
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).not.toContain('href=')
  })

  it('strips a raster data URI given as src on an <image> element', async () => {
    const { getSvg } = await loadUseIconsWithSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><image src="${PNG_URI}"/></svg>`,
    )

    const sanitized = await getSvg('test-icon')
    expect(sanitized).not.toContain('src=')
  })
})

describe('useIcons — reload when login or entered PINs change', () => {
  async function loadWith(state: { jwt: string | null; tokens: string[] }, list: ReturnType<typeof vi.fn>) {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      getJwt: () => state.jwt,
      getAllSessionTokens: () => state.tokens,
      icons: { list },
    }))
    const mod = await import('./useIcons')
    return mod.useIcons()
  }

  const svg = (name: string) => ({ name, content: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>' })

  it('loads once while nothing changes', async () => {
    const list = vi.fn().mockResolvedValue({ icons: [svg('public')] })
    const { getSvg, loadList } = await loadWith({ jwt: null, tokens: [] }, list)

    await loadList()
    await loadList()
    expect(await getSvg('missing')).toBe('')

    expect(list).toHaveBeenCalledTimes(1)
  })

  it('reloads after a PIN was entered and finds the newly allowed icon', async () => {
    const state = { jwt: null as string | null, tokens: [] as string[] }
    const list = vi.fn()
      .mockResolvedValueOnce({ icons: [svg('public')] })
      .mockResolvedValueOnce({ icons: [svg('public'), svg('pin-only')] })
    const { getSvg, iconNames } = await loadWith(state, list)

    expect(await getSvg('pin-only')).toBe('')
    state.tokens = ['pin-token']
    expect(await getSvg('pin-only')).toContain('<svg')

    expect(list).toHaveBeenCalledTimes(2)
    expect(iconNames.value).toEqual(['public', 'pin-only'])
  })

  it('reloads after login', async () => {
    const state = { jwt: null as string | null, tokens: [] as string[] }
    const list = vi.fn().mockResolvedValue({ icons: [svg('public')] })
    const { loadList } = await loadWith(state, list)

    await loadList()
    state.jwt = 'token'
    await loadList()

    expect(list).toHaveBeenCalledTimes(2)
  })

  it('retries after a failed load', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ icons: [svg('public')] })
    const { loadList, iconNames } = await loadWith({ jwt: null, tokens: [] }, list)

    await loadList()
    expect(iconNames.value).toEqual([])
    await loadList()

    expect(list).toHaveBeenCalledTimes(2)
    expect(iconNames.value).toEqual(['public'])
  })
})
