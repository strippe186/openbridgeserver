// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VisuHeader } from '@/api/client'
import { FALLBACK_HEADER, useDeviceStore } from '@/stores/device'

const push = vi.fn()
const toggle = vi.fn()
const visu = reactive({
  isAdmin: false,
  isLoggedIn: false,
  nodes: [
    { id: 'page-1', name: 'Wohnzimmer' },
    { id: 'menu', name: 'Menü-Seite' },
  ],
  getNode(id: string) { return this.nodes.find(n => n.id === id) },
})
const values: Record<string, { v: unknown; u?: string } | null> = {}

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/api/client', () => ({ visuDevices: { list: vi.fn() }, visuHeader: { get: vi.fn() } }))
vi.mock('@/stores/visu', () => ({ useVisuStore: () => visu }))
vi.mock('@/stores/theme', () => ({ useThemeStore: () => ({ isDark: false, toggle }) }))
vi.mock('@/stores/datapoints', () => ({ useDatapointsStore: () => ({ getValue: (id: string) => values[id] ?? null }) }))
vi.mock('@/stores/format', () => ({
  useFormatStore: () => ({
    fmtNumber: (v: number, o: { decimals: number }) => v.toFixed(o.decimals).replace('.', ','),
    fmtTime: (d: Date) => `T${d.getSeconds()}`,
    fmtDate: () => 'D',
  }),
}))
vi.mock('@/components/VisuIcon.vue', () => ({ default: { props: ['icon'], template: '<span data-testid="icon">{{ icon }}</span>' } }))
vi.mock('@/components/Breadcrumb.vue', () => ({ default: { template: '<nav data-testid="breadcrumb" />' } }))
vi.mock('@/components/AuthButton.vue', () => ({ default: { template: '<span data-testid="auth" />' } }))

const { default: VisuHeaderBar } = await import('./VisuHeader.vue')

let wrapper: VueWrapper | null = null
function mountHeader(header: Partial<VisuHeader>, props: { id?: string; isPage?: boolean } = {}) {
  useDeviceStore().defaultHeader = { ...FALLBACK_HEADER, ...header }
  wrapper = mount(VisuHeaderBar, {
    props: { id: 'page-1', isPage: true, ...props },
    global: { mocks: { $t: (key: string) => key } },
  })
  return wrapper
}
const has = (testid: string) => wrapper!.find(`[data-testid="${testid}"]`).exists()

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  push.mockReset()
  toggle.mockReset()
  visu.isAdmin = false
  visu.isLoggedIn = false
  for (const key of Object.keys(values)) delete values[key]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('VisuHeader', () => {
  it('shows breadcrumb, day/night and sign-in like before by default', () => {
    mountHeader({})

    expect(has('visu-header')).toBe(true)
    expect(wrapper!.get('[data-testid="visu-header"]').classes()).not.toContain('sticky')
    expect(has('breadcrumb')).toBe(true)
    expect(has('visu-header-theme')).toBe(true)
    expect(has('auth')).toBe(true)
    expect(has('visu-header-title')).toBe(false)
    expect(has('visu-header-menu')).toBe(false)
    expect(has('visu-header-clock')).toBe(false)
    expect(has('visu-header-edit')).toBe(false)
  })

  it('disappears completely when switched off', () => {
    mountHeader({ visible: false })

    expect(has('visu-header')).toBe(false)
  })

  it('pins the bar to the top', () => {
    mountHeader({ sticky: true })

    expect(wrapper!.get('[data-testid="visu-header"]').classes()).toEqual(expect.arrayContaining(['sticky', 'top-0']))
  })

  it('shows only the selected elements', () => {
    mountHeader({ show_breadcrumb: false, show_theme_toggle: false, show_login: false, show_title: true })

    expect(has('breadcrumb')).toBe(false)
    expect(has('visu-header-theme')).toBe(false)
    expect(has('auth')).toBe(false)
    expect(wrapper!.get('[data-testid="visu-header-title"]').text()).toBe('Wohnzimmer')
  })

  it('keeps the sign-out button for a signed-in visitor even without sign-in', () => {
    visu.isLoggedIn = true
    mountHeader({ show_login: false })

    expect(has('auth')).toBe(true)
  })

  it('shows an empty title for an unknown node', () => {
    mountHeader({ show_title: true }, { id: 'unknown' })

    expect(wrapper!.get('[data-testid="visu-header-title"]').text()).toBe('')
  })

  it('opens the menu page with label and icon', async () => {
    mountHeader({ menu_page_id: 'menu', menu_label: 'Menü', menu_icon: '🏠' })

    const button = wrapper!.get('[data-testid="visu-header-menu"]')
    expect(button.text()).toContain('Menü')
    expect(button.get('[data-testid="icon"]').text()).toBe('🏠')
    await button.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'viewer', params: { id: 'menu' } })
  })

  it('labels the menu button with the page name, or with a menu symbol when the page is unknown', () => {
    mountHeader({ menu_page_id: 'menu' })
    expect(wrapper!.get('[data-testid="visu-header-menu"]').text()).toBe('Menü-Seite')
    expect(wrapper!.find('[data-testid="visu-header-menu"] [data-testid="icon"]').exists()).toBe(false)
    wrapper!.unmount()

    mountHeader({ menu_page_id: 'hidden' })
    expect(wrapper!.get('[data-testid="visu-header-menu"] [data-testid="icon"]').text()).toBe('☰')
  })

  it('leads to the start page of the device profile', async () => {
    const store = useDeviceStore()
    store.devices = [{ slug: 'panel', name: 'Panel', start_node_id: 'menu', return_after_s: 0 }]
    store.select('panel')
    mountHeader({ menu_to_start: true, menu_page_id: null })

    const button = wrapper!.get('[data-testid="visu-header-menu"]')
    expect(button.text()).toBe('Menü-Seite')
    await button.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'viewer', params: { id: 'menu' } })
    wrapper!.unmount()

    // On the start page itself the button is hidden.
    mountHeader({ menu_to_start: true }, { id: 'menu' })
    expect(has('visu-header-menu')).toBe(false)
  })

  it('leads to the overview for a device without a profile', async () => {
    mountHeader({ menu_to_start: true })

    const button = wrapper!.get('[data-testid="visu-header-menu"]')
    expect(button.get('[data-testid="icon"]').text()).toBe('☰')
    await button.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'tree' })
  })

  it('hides the menu button on the menu page itself', () => {
    mountHeader({ menu_page_id: 'page-1' })

    expect(has('visu-header-menu')).toBe(false)
  })

  it('shows datapoint values with label, icon, decimals and unit', () => {
    values['dp-a'] = { v: 7.256, u: '°C' }
    values['dp-b'] = { v: 'offen' }
    values['dp-c'] = { v: null }
    mountHeader({
      values: [
        { datapoint_id: 'dp-a', label: 'out', icon: '🌡', decimals: 1 },
        { datapoint_id: 'dp-b', label: '', icon: '', decimals: 0 },
        { datapoint_id: 'dp-c', label: '', icon: '', decimals: 0 },
        { datapoint_id: 'dp-missing', label: '', icon: '', decimals: 0 },
      ],
    })

    const items = wrapper!.findAll('[data-testid="visu-header-value"]')
    expect(items.map(i => i.text())).toEqual(['🌡out7,3 °C', 'offen', '—', '—'])
    expect(items[1].find('[data-testid="icon"]').exists()).toBe(false)
  })

  it('ticks the clock and shows the date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 5))
    mountHeader({ show_clock: true, show_date: true })

    expect(wrapper!.get('[data-testid="visu-header-clock"]').text()).toBe('T5D')
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(wrapper!.get('[data-testid="visu-header-clock"]').text()).toBe('T7D')
  })

  it('shows the date alone and stops the clock when it is switched off', async () => {
    vi.useFakeTimers()
    mountHeader({ show_date: true })
    expect(wrapper!.get('[data-testid="visu-header-clock"]').text()).toBe('D')

    const clear = vi.spyOn(globalThis, 'clearInterval')
    useDeviceStore().defaultHeader = { ...FALLBACK_HEADER, show_date: false }
    await nextTick()
    expect(has('visu-header-clock')).toBe(false)
    expect(clear).toHaveBeenCalled()
  })

  it('keeps the editor and manager buttons for administrators', async () => {
    visu.isAdmin = true
    mountHeader({})

    await wrapper!.get('[data-testid="visu-header-edit"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'editor', params: { id: 'page-1' } })
    await wrapper!.get('[data-testid="visu-header-manage"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'manage' })
    await wrapper!.get('[data-testid="visu-header-theme"]').trigger('click')
    expect(toggle).toHaveBeenCalled()
  })

  it('offers no editor on an overview node', () => {
    visu.isAdmin = true
    mountHeader({}, { isPage: false })

    expect(has('visu-header-edit')).toBe(false)
    expect(has('visu-header-manage')).toBe(true)
  })
})
