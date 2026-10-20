import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VisuHeaderEditor from '@/components/settings/VisuHeaderEditor.vue'

const DP = '11111111-1111-1111-1111-111111111111'
const PAGES = [{ id: 'menu', label: 'Haus › Menü' }]

function header(overrides = {}) {
  return {
    visible: true, sticky: false, show_breadcrumb: true, show_title: false, menu_page_id: null, menu_label: '', menu_icon: '',
    show_clock: false, show_date: false, values: [], show_theme_toggle: true, show_login: true, ...overrides,
  }
}

// A parent that keeps the v-model, like the settings panel does.
function mountEditor(initial) {
  const wrapper = mount({
    components: { VisuHeaderEditor },
    data: () => ({ model: initial, picked: [] }),
    template: '<VisuHeaderEditor v-model="model" :page-options="pages" :dp-names="{}" @datapoint-selected="picked.push($event)" />',
    computed: { pages: () => PAGES },
  }, {
    global: {
      stubs: {
        DpCombobox: { props: ['modelValue'], emits: ['select'], template: '<button type="button" data-testid="dp-stub" @click="$emit(\'select\', { id: \'' + DP + '\', name: \'T\' })" />' },
        IconPicker: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input data-testid="icon-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
      },
    },
  })
  return { wrapper, model: () => wrapper.vm.model }
}

describe('VisuHeaderEditor', () => {
  it('hides every option while the bar is switched off', async () => {
    const { wrapper, model } = mountEditor(header({ visible: false }))

    expect(wrapper.find('[data-testid="chk-header-sticky"]').exists()).toBe(false)
    await wrapper.get('[data-testid="chk-header-visible"]').setValue(true)
    expect(model().visible).toBe(true)
    expect(wrapper.find('[data-testid="chk-header-sticky"]').exists()).toBe(true)
  })

  it('configures the menu button only once a target page is chosen', async () => {
    const { wrapper, model } = mountEditor(header())

    expect(wrapper.find('[data-testid="input-header-menu-label"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="select-header-menu-page"]').findAll('option').map(o => o.text())).toEqual(['— kein Knopf —', 'Startseite des Geräts', 'Haus › Menü'])
    await wrapper.get('[data-testid="select-header-menu-page"]').setValue('menu')
    await wrapper.get('[data-testid="input-header-menu-label"]').setValue('Menü')
    await wrapper.get('[data-testid="icon-stub"]').setValue('☰')
    expect(model()).toMatchObject({ menu_page_id: 'menu', menu_label: 'Menü', menu_icon: '☰' })

    await wrapper.get('[data-testid="select-header-menu-page"]').setValue('')
    expect(model().menu_page_id).toBeNull()
  })

  it('can lead to the start page of each device instead of one page', async () => {
    const { wrapper, model } = mountEditor(header({ menu_page_id: 'menu' }))
    const select = wrapper.get('[data-testid="select-header-menu-page"]')

    expect(wrapper.find('[data-testid="header-menu-start-hint"]').exists()).toBe(false)
    await select.setValue('__start__')
    expect(model()).toMatchObject({ menu_to_start: true, menu_page_id: null })
    expect(select.element.value).toBe('__start__')
    expect(wrapper.find('[data-testid="header-menu-start-hint"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="input-header-menu-label"]').exists()).toBe(true)

    await select.setValue('menu')
    expect(model()).toMatchObject({ menu_to_start: false, menu_page_id: 'menu' })
  })

  it('offers a deleted menu page as its own entry', () => {
    const { wrapper } = mountEditor(header({ menu_page_id: 'gone' }))

    expect(wrapper.get('[data-testid="select-header-menu-page"]').findAll('option')[2].text()).toBe('(gelöschte Seite)')
  })

  it('adds up to three values, edits and removes them', async () => {
    const { wrapper, model } = mountEditor(header())
    const add = () => wrapper.get('[data-testid="btn-add-header-value"]').trigger('click')

    await add()
    const first = wrapper.get('[data-testid="header-value-0"]')
    await first.get('[data-testid="input-header-value-datapoint"]').trigger('click')
    await first.get('[data-testid="input-header-value-label"]').setValue('Außen')
    await first.get('[data-testid="input-header-value-icon"]').setValue('🌡')
    await first.get('[data-testid="select-header-value-decimals"]').setValue('2')
    expect(model().values).toEqual([{ datapoint_id: DP, label: 'Außen', icon: '🌡', decimals: 2 }])
    expect(wrapper.vm.picked).toEqual([{ id: DP, name: 'T' }])

    await add()
    await add()
    expect(model().values).toHaveLength(3)
    await wrapper.get('[data-testid="header-value-1"] [data-testid="input-header-value-label"]').setValue('Wind')
    expect(model().values.map(v => v.label)).toEqual(['Außen', 'Wind', ''])
    expect(wrapper.get('[data-testid="btn-add-header-value"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="header-value-0"] [data-testid="btn-remove-header-value"]').trigger('click')
    expect(model().values).toHaveLength(2)
    expect(model().values[0].datapoint_id).toBe('')
    expect(wrapper.get('[data-testid="btn-add-header-value"]').attributes('disabled')).toBeUndefined()
  })
})
