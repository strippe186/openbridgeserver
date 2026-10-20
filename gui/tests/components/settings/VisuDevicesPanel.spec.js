import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

let visuDevicesApi
let visuHeaderApi
let dpApi

const DP = '11111111-1111-1111-1111-111111111111'
const DP2 = '22222222-2222-2222-2222-222222222222'

function header(overrides = {}) {
  return {
    visible: true, sticky: false, show_breadcrumb: true, show_title: false, menu_page_id: null, menu_label: '', menu_icon: '',
    show_clock: false, show_date: false, values: [], show_theme_toggle: true, show_login: true, ...overrides,
  }
}

const PAGES = [
  { id: 'home', parent_id: null, name: 'Haus', type: 'LOCATION' },
  { id: 'eg', parent_id: 'home', name: 'EG', type: 'LOCATION' },
  { id: 'kitchen', parent_id: 'eg', name: 'Küche', type: 'PAGE' },
  { id: 'garden', parent_id: null, name: 'Garten', type: 'PAGE' },
]

const DEVICES = [
  { slug: 'panel', name: 'Wandpanel', start_node_id: 'kitchen', return_after_s: 120 },
  { slug: 'handy', name: 'Handy', start_node_id: null, return_after_s: 0 },
]

beforeEach(() => {
  vi.resetModules()
  visuDevicesApi = {
    list: vi.fn().mockResolvedValue({ data: structuredClone(DEVICES) }),
    pages: vi.fn().mockResolvedValue({ data: PAGES }),
    update: vi.fn().mockImplementation(async devices => ({ data: devices })),
  }
  visuHeaderApi = {
    get: vi.fn().mockResolvedValue({ data: header() }),
    update: vi.fn().mockImplementation(async data => ({ data })),
  }
  dpApi = { get: vi.fn().mockImplementation(async id => (id === DP ? { data: { name: 'Außentemperatur' } } : Promise.reject(new Error('gone')))) }
  vi.doMock('@/api/client', () => ({ visuDevicesApi, visuHeaderApi, dpApi }))
})

afterEach(() => {
  vi.doUnmock('@/api/client')
  vi.unstubAllGlobals()
})

async function mountPanel() {
  const { default: VisuDevicesPanel } = await import('@/components/settings/VisuDevicesPanel.vue')
  const wrapper = mount(VisuDevicesPanel, {
    global: {
      stubs: {
        HelpButton: { props: ['helpId'], template: '<span data-testid="help" :data-help-id="helpId" />' },
        Spinner: { template: '<span data-testid="spinner" />' },
        DpCombobox: {
          props: ['modelValue', 'displayName'],
          emits: ['select'],
          template: '<button type="button" data-testid="dp-stub" :data-name="displayName" @click="$emit(\'select\', { id: \'33333333-3333-3333-3333-333333333333\', name: \'Wind\' })">{{ displayName }}</button>',
        },
        IconPicker: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input data-testid="icon-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

const row = (wrapper, index) => wrapper.get(`[data-testid="visu-device-row-${index}"]`)

describe('VisuDevicesPanel', () => {
  it('loads the profiles and offers every page with its path, in tree order', async () => {
    const wrapper = await mountPanel()

    expect(wrapper.findAll('[data-testid="help"]').map(h => h.attributes('data-help-id'))).toEqual(['settings-visu-header', 'settings-visu-devices'])
    expect(row(wrapper, 0).get('[data-testid="input-visu-device-name"]').element.value).toBe('Wandpanel')
    expect(row(wrapper, 0).get('[data-testid="input-visu-device-slug"]').element.value).toBe('panel')
    expect(row(wrapper, 0).get('[data-testid="select-visu-device-start"]').element.value).toBe('kitchen')
    expect(row(wrapper, 0).get('[data-testid="input-visu-device-return"]').element.value).toBe('120')
    expect(row(wrapper, 1).get('[data-testid="select-visu-device-start"]').element.value).toBe('')

    const labels = row(wrapper, 0).findAll('option').map(o => o.text())
    expect(labels).toEqual(['— Übersicht —', 'Haus', 'Haus › EG', 'Haus › EG › Küche', 'Garten'])
    expect(row(wrapper, 0).get('[data-testid="visu-device-link"]').text()).toBe(`${window.location.origin}/visu/?device=panel`)
    expect(wrapper.find('[data-testid="visu-device-error"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="btn-save-visu-devices"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the empty state without profiles', async () => {
    visuDevicesApi.list.mockResolvedValue({ data: [] })
    const wrapper = await mountPanel()

    expect(wrapper.get('[data-testid="visu-devices-empty"]').text()).toContain('Noch keine Geräte')
  })

  it('reports a load failure', async () => {
    visuDevicesApi.pages.mockRejectedValue(new Error('offline'))
    const wrapper = await mountPanel()

    expect(wrapper.get('[data-testid="visu-devices-msg"]').text()).toBe('Geräte konnten nicht geladen werden.')
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(false)
  })

  it('suggests the slug from the name until it is edited by hand', async () => {
    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="btn-add-visu-device"]').trigger('click')
    const added = row(wrapper, 2)

    await added.get('[data-testid="input-visu-device-name"]').setValue('  Visu-PC Küche & Bad!  ')
    expect(added.get('[data-testid="input-visu-device-slug"]').element.value).toBe('visu-pc-kueche-bad')

    await added.get('[data-testid="input-visu-device-name"]').setValue('Größe Öl Übung')
    expect(added.get('[data-testid="input-visu-device-slug"]').element.value).toBe('groesse-oel-uebung')

    await added.get('[data-testid="input-visu-device-slug"]').setValue('mein-pc')
    await added.get('[data-testid="input-visu-device-name"]').setValue('Anderer Name')
    expect(added.get('[data-testid="input-visu-device-slug"]').element.value).toBe('mein-pc')

    // Loaded profiles never get an automatic slug.
    await row(wrapper, 0).get('[data-testid="input-visu-device-name"]').setValue('Neu')
    expect(row(wrapper, 0).get('[data-testid="input-visu-device-slug"]').element.value).toBe('panel')
  })

  it.each([
    ['name', 'input-visu-device-name', '   ', 'Bitte einen Namen angeben.'],
    ['slug', 'input-visu-device-slug', 'Panel', 'Die Kennung darf nur'],
    ['duplicate slug', 'input-visu-device-slug', 'handy', 'Diese Kennung ist bereits vergeben.'],
    ['negative return', 'input-visu-device-return', '-5', 'zwischen 0 und 86400'],
    ['too large return', 'input-visu-device-return', '86401', 'zwischen 0 und 86400'],
    ['fractional return', 'input-visu-device-return', '1.5', 'zwischen 0 und 86400'],
    ['empty return', 'input-visu-device-return', '', 'zwischen 0 und 86400'],
  ])('blocks saving on an invalid %s', async (_case, testid, value, message) => {
    const wrapper = await mountPanel()
    await row(wrapper, 0).get(`[data-testid="${testid}"]`).setValue(value)

    expect(row(wrapper, 0).get('[data-testid="visu-device-error"]').text()).toContain(message)
    expect(wrapper.get('[data-testid="btn-save-visu-devices"]').attributes('disabled')).toBeDefined()
  })

  it('keeps a deleted start page visible and asks for another one', async () => {
    visuDevicesApi.list.mockResolvedValue({ data: [{ slug: 'panel', name: 'Panel', start_node_id: 'gone', return_after_s: 0 }] })
    const wrapper = await mountPanel()

    const select = row(wrapper, 0).get('[data-testid="select-visu-device-start"]')
    expect(select.element.value).toBe('gone')
    expect(select.findAll('option')[1].text()).toBe('(gelöschte Seite)')
    expect(row(wrapper, 0).get('[data-testid="visu-device-error"]').text()).toContain('existiert nicht mehr')

    await select.setValue('garden')
    expect(row(wrapper, 0).find('[data-testid="visu-device-error"]').exists()).toBe(false)
    expect(select.findAll('option').map(o => o.text())).not.toContain('(gelöschte Seite)')
  })

  it('saves all profiles, turning "overview" into no start page', async () => {
    const wrapper = await mountPanel()
    await row(wrapper, 0).get('[data-testid="select-visu-device-start"]').setValue('')
    await row(wrapper, 1).get('[data-testid="input-visu-device-return"]').setValue('300')

    await wrapper.get('[data-testid="btn-save-visu-devices"]').trigger('click')
    await flushPromises()

    expect(visuDevicesApi.update).toHaveBeenCalledWith([
      { slug: 'panel', name: 'Wandpanel', start_node_id: null, return_after_s: 120, header: null },
      { slug: 'handy', name: 'Handy', start_node_id: null, return_after_s: 300, header: null },
    ])
    expect(wrapper.get('[data-testid="visu-devices-msg"]').text()).toBe('Geräte gespeichert.')
  })

  it('removes a profile and saves the rest', async () => {
    const wrapper = await mountPanel()
    await row(wrapper, 0).get('[data-testid="btn-delete-visu-device"]').trigger('click')
    await wrapper.get('[data-testid="btn-save-visu-devices"]').trigger('click')
    await flushPromises()

    expect(visuDevicesApi.update).toHaveBeenCalledWith([{ slug: 'handy', name: 'Handy', start_node_id: null, return_after_s: 0, header: null }])
  })

  it('shows the server message when saving is rejected', async () => {
    visuDevicesApi.update.mockRejectedValue({ response: { data: { detail: 'Unknown start page: kitchen' } } })
    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="btn-save-visu-devices"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="visu-devices-msg"]').text()).toBe('Unknown start page: kitchen')
  })

  it('falls back to a generic message for structured or missing error details', async () => {
    visuDevicesApi.update.mockRejectedValueOnce({ response: { data: { detail: [{ msg: 'x' }] } } })
    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="btn-save-visu-devices"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="visu-devices-msg"]').text()).toBe('Speichern fehlgeschlagen.')

    visuDevicesApi.update.mockRejectedValueOnce(new Error('network'))
    await wrapper.get('[data-testid="btn-save-visu-devices"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="visu-devices-msg"]').text()).toBe('Speichern fehlgeschlagen.')
  })

  it('copies the device link and reports a blocked clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountPanel()

    await row(wrapper, 0).get('[data-testid="btn-copy-visu-device-link"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/visu/?device=panel`)
    expect(row(wrapper, 0).get('[data-testid="btn-copy-visu-device-link"]').text()).toBe('Kopiert ✓')
    expect(row(wrapper, 1).get('[data-testid="btn-copy-visu-device-link"]').text()).toBe('Kopieren')

    writeText.mockRejectedValueOnce(new Error('denied'))
    await row(wrapper, 1).get('[data-testid="btn-copy-visu-device-link"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="visu-devices-msg"]').text()).toContain('nicht in die Zwischenablage')
  })

  it('disables copying while the slug is invalid', async () => {
    const wrapper = await mountPanel()
    await row(wrapper, 0).get('[data-testid="input-visu-device-slug"]').setValue('-bad')

    expect(row(wrapper, 0).get('[data-testid="btn-copy-visu-device-link"]').attributes('disabled')).toBeDefined()
  })

  it('edits and saves the default header bar', async () => {
    visuHeaderApi.get.mockResolvedValue({ data: header({ values: [{ datapoint_id: DP, label: 'Außen', icon: '🌡', decimals: 1 }] }) })
    const wrapper = await mountPanel()
    const card = wrapper.get('[data-testid="visu-header-card"]')

    expect(card.get('[data-testid="help"]').attributes('data-help-id')).toBe('settings-visu-header')
    expect(card.get('[data-testid="input-header-value-datapoint"]').attributes('data-name')).toBe('Außentemperatur')
    await card.get('[data-testid="chk-header-sticky"]').setValue(true)
    await card.get('[data-testid="chk-header-show_clock"]').setValue(true)
    await card.get('[data-testid="btn-save-visu-header"]').trigger('click')
    await flushPromises()

    expect(visuHeaderApi.update).toHaveBeenCalledWith(header({ sticky: true, show_clock: true, values: [{ datapoint_id: DP, label: 'Außen', icon: '🌡', decimals: 1 }] }))
    expect(card.get('[data-testid="visu-header-msg"]').text()).toBe('Kopfleiste gespeichert.')
  })

  it('blocks saving the header bar while a value has no datapoint or the menu page is gone', async () => {
    visuHeaderApi.get.mockResolvedValue({ data: header({ menu_page_id: 'gone' }) })
    const wrapper = await mountPanel()
    const card = wrapper.get('[data-testid="visu-header-card"]')

    expect(card.get('[data-testid="visu-header-error"]').text()).toContain('existiert nicht mehr')
    await card.get('[data-testid="select-header-menu-page"]').setValue('garden')
    expect(card.find('[data-testid="visu-header-error"]').exists()).toBe(false)

    await card.get('[data-testid="btn-add-header-value"]').trigger('click')
    expect(card.get('[data-testid="visu-header-error"]').text()).toContain('braucht einen Datenpunkt')
    expect(card.get('[data-testid="btn-save-visu-header"]').attributes('disabled')).toBeDefined()

    await card.get('[data-testid="input-header-value-datapoint"]').trigger('click')
    expect(card.get('[data-testid="input-header-value-datapoint"]').attributes('data-name')).toBe('Wind')
    expect(card.find('[data-testid="visu-header-error"]').exists()).toBe(false)
  })

  it('reports a rejected header save with the server message or a generic one', async () => {
    visuHeaderApi.update.mockRejectedValueOnce({ response: { data: { detail: 'Unknown datapoint: x' } } })
    const wrapper = await mountPanel()
    const card = wrapper.get('[data-testid="visu-header-card"]')
    await card.get('[data-testid="btn-save-visu-header"]').trigger('click')
    await flushPromises()
    expect(card.get('[data-testid="visu-header-msg"]').text()).toBe('Unknown datapoint: x')

    visuHeaderApi.update.mockRejectedValueOnce(new Error('network'))
    await card.get('[data-testid="btn-save-visu-header"]').trigger('click')
    await flushPromises()
    expect(card.get('[data-testid="visu-header-msg"]').text()).toBe('Speichern fehlgeschlagen.')
  })

  it('gives a device its own header bar copied from the default and saves it', async () => {
    visuHeaderApi.get.mockResolvedValue({ data: header({ show_clock: true }) })
    const wrapper = await mountPanel()

    expect(row(wrapper, 0).find('[data-testid="visu-header-device"]').exists()).toBe(false)
    await row(wrapper, 0).get('[data-testid="chk-visu-device-own-header"]').setValue(true)
    const editor = row(wrapper, 0).get('[data-testid="visu-header-device"]')
    expect(editor.get('[data-testid="chk-header-show_clock"]').element.checked).toBe(true)
    await editor.get('[data-testid="chk-header-show_login"]').setValue(false)

    // The default stays untouched by the device's copy.
    expect(wrapper.get('[data-testid="visu-header-default"] [data-testid="chk-header-show_login"]').element.checked).toBe(true)

    await wrapper.get('[data-testid="btn-save-visu-devices"]').trigger('click')
    await flushPromises()
    expect(visuDevicesApi.update.mock.calls[0][0][0].header).toEqual(header({ show_clock: true, show_login: false }))
  })

  it('loads device headers with their datapoint names, flags their errors and can drop them again', async () => {
    visuDevicesApi.list.mockResolvedValue({
      data: [{ slug: 'panel', name: 'Panel', start_node_id: null, return_after_s: 0, header: header({ values: [{ datapoint_id: DP2, label: '', icon: '', decimals: 0 }] }) }],
    })
    const wrapper = await mountPanel()
    const editor = row(wrapper, 0).get('[data-testid="visu-header-device"]')

    expect(dpApi.get).toHaveBeenCalledWith(DP2)
    expect(editor.get('[data-testid="input-header-value-datapoint"]').attributes('data-name')).toBe(DP2)
    await editor.get('[data-testid="btn-add-header-value"]').trigger('click')
    expect(row(wrapper, 0).get('[data-testid="visu-device-error"]').text()).toContain('braucht einen Datenpunkt')

    await row(wrapper, 0).get('[data-testid="chk-visu-device-own-header"]').setValue(false)
    expect(row(wrapper, 0).find('[data-testid="visu-header-device"]').exists()).toBe(false)
    expect(row(wrapper, 0).find('[data-testid="visu-device-error"]').exists()).toBe(false)
  })

  it('shows no header editor when loading failed', async () => {
    visuHeaderApi.get.mockRejectedValue(new Error('offline'))
    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="visu-header-default"]').exists()).toBe(false)
  })
})
