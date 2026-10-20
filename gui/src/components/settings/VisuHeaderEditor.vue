<template>
  <div class="flex flex-col gap-3" :data-testid="testid">
    <label class="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" :checked="modelValue.visible" data-testid="chk-header-visible" @change="set('visible', $event.target.checked)" />
      {{ $t('settings.visuHeader.visible') }}
    </label>

    <template v-if="modelValue.visible">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <label v-for="flag in FLAGS" :key="flag" class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="modelValue[flag]" :data-testid="`chk-header-${flag}`" @change="set(flag, $event.target.checked)" />
          {{ $t(`settings.visuHeader.${flag}`) }}
        </label>
      </div>

      <!-- Menü-/Start-Knopf -->
      <fieldset class="flex flex-col gap-2">
        <legend class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{{ $t('settings.visuHeader.menu') }}</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="form-group">
            <label class="label">{{ $t('settings.visuHeader.menuPage') }}</label>
            <select :value="menuTarget" class="input" data-testid="select-header-menu-page" @change="setMenuTarget($event.target.value)">
              <option value="">{{ $t('settings.visuHeader.menuNone') }}</option>
              <option :value="START">{{ $t('settings.visuHeader.menuStart') }}</option>
              <option v-if="menuPageMissing" :value="modelValue.menu_page_id">{{ $t('settings.visuDevices.missingPage') }}</option>
              <option v-for="page in pageOptions" :key="page.id" :value="page.id">{{ page.label }}</option>
            </select>
            <p v-if="modelValue.menu_to_start" class="text-xs text-slate-500 mt-1" data-testid="header-menu-start-hint">{{ $t('settings.visuHeader.menuStartHint') }}</p>
          </div>
          <div v-if="menuTarget" class="form-group">
            <label class="label">{{ $t('settings.visuHeader.menuLabel') }}</label>
            <input :value="modelValue.menu_label" type="text" class="input" maxlength="40" :placeholder="$t('settings.visuHeader.menuLabelPlaceholder')" data-testid="input-header-menu-label" @input="set('menu_label', $event.target.value)" />
          </div>
        </div>
        <div v-if="menuTarget" class="form-group">
          <label class="label">{{ $t('settings.visuHeader.icon') }}</label>
          <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40">
            <IconPicker :model-value="modelValue.menu_icon" @update:model-value="set('menu_icon', $event)" />
          </div>
        </div>
      </fieldset>

      <!-- Datenpunkt-Werte -->
      <fieldset class="flex flex-col gap-2">
        <legend class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{{ $t('settings.visuHeader.values') }}</legend>
        <p class="text-xs text-slate-500">{{ $t('settings.visuHeader.valuesHint') }}</p>
        <div
          v-for="(item, index) in modelValue.values"
          :key="index"
          class="flex flex-col gap-2 p-2 rounded border border-slate-200 dark:border-slate-700/60"
          :data-testid="`header-value-${index}`"
        >
          <div class="flex items-end gap-2">
            <div class="form-group flex-1">
              <label class="label">{{ $t('settings.visuHeader.datapoint') }} <span class="text-red-400">*</span></label>
              <DpCombobox
                :model-value="item.datapoint_id"
                :display-name="dpNames[item.datapoint_id] ?? ''"
                data-testid="input-header-value-datapoint"
                @select="(dp) => selectDatapoint(index, dp)"
              />
            </div>
            <button
              type="button"
              class="btn-ghost btn-sm text-slate-400 hover:text-red-500 shrink-0"
              :title="$t('settings.visuHeader.removeValue')"
              data-testid="btn-remove-header-value"
              @click="removeValue(index)"
            >✕</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="form-group">
              <label class="label">{{ $t('settings.visuHeader.valueLabel') }}</label>
              <input :value="item.label" type="text" class="input" maxlength="40" :placeholder="$t('settings.visuHeader.valueLabelPlaceholder')" data-testid="input-header-value-label" @input="setValue(index, 'label', $event.target.value)" />
            </div>
            <div class="form-group">
              <label class="label">{{ $t('settings.visuHeader.valueIcon') }}</label>
              <input :value="item.icon" type="text" class="input" maxlength="200" data-testid="input-header-value-icon" @input="setValue(index, 'icon', $event.target.value)" />
            </div>
            <div class="form-group">
              <label class="label">{{ $t('settings.visuHeader.decimals') }}</label>
              <select :value="item.decimals" class="input" data-testid="select-header-value-decimals" @change="setValue(index, 'decimals', Number($event.target.value))">
                <option v-for="n in DECIMALS" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <button type="button" class="btn-secondary btn-sm" :disabled="!canAddValue" data-testid="btn-add-header-value" @click="addValue">
            {{ $t('settings.visuHeader.addValue') }}
          </button>
        </div>
      </fieldset>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DpCombobox from '@/components/ui/DpCombobox.vue'
import IconPicker from '@/components/ui/IconPicker.vue'

// Mirrors obs/visu_header.py.
const MAX_HEADER_VALUES = 3
const DECIMALS = [0, 1, 2, 3]
// Select value for "the device profile's own start page" (menu_to_start).
const START = '__start__'
const FLAGS = ['sticky', 'show_title', 'show_breadcrumb', 'show_clock', 'show_date', 'show_theme_toggle', 'show_login']

const props = defineProps({
  modelValue: { type: Object, required: true },
  pageOptions: { type: Array, required: true },
  dpNames: { type: Object, required: true },
  testid: { type: String, default: 'visu-header-editor' },
})
const emit = defineEmits(['update:modelValue', 'datapoint-selected'])

const menuPageMissing = computed(() =>
  !!props.modelValue.menu_page_id && !props.pageOptions.some(page => page.id === props.modelValue.menu_page_id),
)
const menuTarget = computed(() => (props.modelValue.menu_to_start ? START : (props.modelValue.menu_page_id ?? '')))
const canAddValue = computed(() => props.modelValue.values.length < MAX_HEADER_VALUES)

function set(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function setMenuTarget(value) {
  emit('update:modelValue', {
    ...props.modelValue,
    menu_to_start: value === START,
    menu_page_id: value === START ? null : value || null,
  })
}

function setValue(index, key, value) {
  set('values', props.modelValue.values.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
}

function selectDatapoint(index, dp) {
  setValue(index, 'datapoint_id', dp.id)
  emit('datapoint-selected', dp)
}

function addValue() {
  set('values', [...props.modelValue.values, { datapoint_id: '', label: '', icon: '', decimals: 1 }])
}

function removeValue(index) {
  set('values', props.modelValue.values.filter((_, i) => i !== index))
}
</script>
