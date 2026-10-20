<template>
  <div class="flex flex-col gap-4" data-testid="visu-devices-panel">
    <!-- Kopfleiste (Standard für alle Geräte ohne eigene) -->
    <div class="card" data-testid="visu-header-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ $t('settings.visuHeader.title') }}</h3>
          <p class="text-xs text-slate-500 mt-0.5">{{ $t('settings.visuHeader.desc') }}</p>
        </div>
        <HelpButton help-id="settings-visu-header" />
      </div>
      <div class="card-body flex flex-col gap-3">
        <div v-if="loading" class="flex justify-center py-4"><Spinner /></div>
        <template v-else-if="defaultHeader">
          <VisuHeaderEditor
            v-model="defaultHeader"
            :page-options="pageOptions"
            :dp-names="dpNames"
            testid="visu-header-default"
            @datapoint-selected="rememberDatapoint"
          />
          <p v-if="headerError(defaultHeader)" class="text-xs text-red-400" data-testid="visu-header-error">{{ $t(headerError(defaultHeader)) }}</p>
          <div
            v-if="headerMsg"
            :class="['p-3 rounded-lg text-sm border', headerMsg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30']"
            data-testid="visu-header-msg"
          >{{ headerMsg.text }}</div>
          <div class="flex justify-end">
            <button type="button" class="btn-primary" :disabled="headerSaving || !!headerError(defaultHeader)" data-testid="btn-save-visu-header" @click="saveHeader">
              <Spinner v-if="headerSaving" size="sm" color="white" />
              {{ $t('common.save') }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <div class="card">
      <div class="card-header flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ $t('settings.visuDevices.title') }}</h3>
          <p class="text-xs text-slate-500 mt-0.5">{{ $t('settings.visuDevices.desc') }}</p>
        </div>
        <div class="flex items-center gap-1">
          <HelpButton help-id="settings-visu-devices" />
          <button type="button" class="btn-primary btn-sm" :disabled="loading" data-testid="btn-add-visu-device" @click="addDevice">
            {{ $t('settings.visuDevices.addButton') }}
          </button>
        </div>
      </div>

      <div class="card-body flex flex-col gap-3">
        <div v-if="loading" class="flex justify-center py-4"><Spinner /></div>

        <div v-else-if="devices.length === 0" class="text-sm text-slate-500 py-4 text-center" data-testid="visu-devices-empty">
          {{ $t('settings.visuDevices.empty') }}
        </div>

        <div
          v-for="(device, index) in devices"
          :key="device._key"
          class="flex flex-col gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40"
          :data-testid="`visu-device-row-${index}`"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-group">
              <label class="label">{{ $t('settings.visuDevices.name') }} <span class="text-red-400">*</span></label>
              <input
                v-model="device.name"
                type="text"
                class="input"
                maxlength="80"
                :placeholder="$t('settings.visuDevices.namePlaceholder')"
                data-testid="input-visu-device-name"
                @input="onNameInput(device)"
              />
            </div>
            <div class="form-group">
              <label class="label">{{ $t('settings.visuDevices.slug') }} <span class="text-red-400">*</span></label>
              <input
                v-model="device.slug"
                type="text"
                class="input font-mono"
                maxlength="40"
                :placeholder="$t('settings.visuDevices.slugPlaceholder')"
                data-testid="input-visu-device-slug"
                @input="device._autoSlug = false"
              />
            </div>
            <div class="form-group">
              <label class="label">{{ $t('settings.visuDevices.startPage') }}</label>
              <select v-model="device.start_node_id" class="input" data-testid="select-visu-device-start">
                <option value="">{{ $t('settings.visuDevices.startOverview') }}</option>
                <option v-if="device.start_node_id && !pageIds.has(device.start_node_id)" :value="device.start_node_id">
                  {{ $t('settings.visuDevices.missingPage') }}
                </option>
                <option v-for="page in pageOptions" :key="page.id" :value="page.id">{{ page.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">{{ $t('settings.visuDevices.returnAfter') }}</label>
              <input
                v-model.number="device.return_after_s"
                type="number"
                min="0"
                :max="MAX_RETURN_AFTER_S"
                class="input w-32"
                data-testid="input-visu-device-return"
              />
              <p class="text-xs text-slate-500 mt-1">{{ $t('settings.visuDevices.returnAfterHint') }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" :checked="!!device.header" data-testid="chk-visu-device-own-header" @change="toggleOwnHeader(device, $event.target.checked)" />
              {{ $t('settings.visuHeader.ownHeader') }}
            </label>
            <div v-if="device.header" class="p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40">
              <VisuHeaderEditor
                v-model="device.header"
                :page-options="pageOptions"
                :dp-names="dpNames"
                testid="visu-header-device"
                @datapoint-selected="rememberDatapoint"
              />
            </div>
          </div>

          <p v-if="rowError(device)" class="text-xs text-red-400" data-testid="visu-device-error">{{ $t(rowError(device)) }}</p>

          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 shrink-0">{{ $t('settings.visuDevices.link') }}</span>
            <code class="text-xs text-slate-600 dark:text-slate-300 truncate flex-1" data-testid="visu-device-link">{{ deviceLink(device) }}</code>
            <button
              type="button"
              class="btn-secondary btn-sm shrink-0"
              :disabled="!slugValid(device)"
              data-testid="btn-copy-visu-device-link"
              @click="copyLink(device)"
            >{{ copiedKey === device._key ? $t('settings.visuDevices.copied') : $t('settings.visuDevices.copy') }}</button>
            <button
              type="button"
              class="btn-ghost btn-sm text-slate-400 hover:text-red-500 shrink-0"
              :title="$t('settings.visuDevices.deleteButtonTitle')"
              data-testid="btn-delete-visu-device"
              @click="devices.splice(index, 1)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16"/></svg>
            </button>
          </div>
        </div>

        <div
          v-if="msg"
          :class="['p-3 rounded-lg text-sm border', msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30']"
          data-testid="visu-devices-msg"
        >{{ msg.text }}</div>

        <div v-if="!loading" class="flex justify-end">
          <button type="button" class="btn-primary" :disabled="saving || hasErrors" data-testid="btn-save-visu-devices" @click="save">
            <Spinner v-if="saving" size="sm" color="white" />
            {{ $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dpApi, visuDevicesApi, visuHeaderApi } from '@/api/client'
import HelpButton from '@/components/ui/HelpButton.vue'
import Spinner from '@/components/ui/Spinner.vue'
import VisuHeaderEditor from '@/components/settings/VisuHeaderEditor.vue'

// Mirrors obs/visu_devices.py.
const MAX_RETURN_AFTER_S = 86400
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

const { t } = useI18n()

const devices = ref([])
const pages = ref([])
const loading = ref(true)
const saving = ref(false)
const msg = ref(null)
const copiedKey = ref(null)
const defaultHeader = ref(null)
const headerSaving = ref(false)
const headerMsg = ref(null)
const dpNames = ref({})
let nextKey = 0

function toRow(device, autoSlug = false) {
  return {
    slug: device.slug,
    name: device.name,
    start_node_id: device.start_node_id ?? '',
    return_after_s: device.return_after_s,
    header: device.header ?? null,
    _key: nextKey++,
    _autoSlug: autoSlug,
  }
}

// Pages in tree order, labelled with their full path ("Haus › EG › Küche").
const pageOptions = computed(() => {
  const byParent = new Map()
  for (const node of pages.value) {
    const parent = node.parent_id ?? null
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(node)
  }
  const options = []
  const walk = (parentId, prefix) => {
    for (const node of byParent.get(parentId) ?? []) {
      const label = prefix ? `${prefix} › ${node.name}` : node.name
      options.push({ id: node.id, label })
      walk(node.id, label)
    }
  }
  walk(null, '')
  return options
})

const pageIds = computed(() => new Set(pages.value.map(node => node.id)))

/** Suggest a URL slug from the name: "Visu-PC Küche" → "visu-pc-kueche". */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '')
}

function onNameInput(device) {
  if (device._autoSlug) device.slug = slugify(device.name)
}

function slugValid(device) {
  return SLUG_RE.test(device.slug)
}

function headerError(header) {
  if (header.values.some(item => !item.datapoint_id)) return 'settings.visuHeader.errorDatapoint'
  if (header.menu_page_id && !pageIds.value.has(header.menu_page_id)) return 'settings.visuHeader.errorMissingPage'
  return ''
}

function toggleOwnHeader(device, own) {
  device.header = own ? JSON.parse(JSON.stringify(defaultHeader.value)) : null
}

function rememberDatapoint(dp) {
  dpNames.value = { ...dpNames.value, [dp.id]: dp.name }
}

async function loadDatapointNames(headers) {
  const ids = [...new Set(headers.flatMap(header => header.values.map(item => item.datapoint_id)))]
  const names = {}
  await Promise.all(ids.map(async (id) => {
    try {
      const { data } = await dpApi.get(id)
      names[id] = data.name
    } catch {
      names[id] = id
    }
  }))
  dpNames.value = { ...dpNames.value, ...names }
}

async function saveHeader() {
  headerSaving.value = true
  headerMsg.value = null
  try {
    const { data } = await visuHeaderApi.update(defaultHeader.value)
    defaultHeader.value = data
    headerMsg.value = { ok: true, text: t('settings.visuHeader.saved') }
  } catch (err) {
    const detail = err?.response?.data?.detail
    headerMsg.value = { ok: false, text: typeof detail === 'string' ? detail : t('settings.visuDevices.saveError') }
  } finally {
    headerSaving.value = false
  }
}

function rowError(device) {
  if (device.header && headerError(device.header)) return headerError(device.header)
  if (!device.name.trim()) return 'settings.visuDevices.errorName'
  if (!slugValid(device)) return 'settings.visuDevices.errorSlug'
  if (devices.value.filter(other => other.slug === device.slug).length > 1) return 'settings.visuDevices.errorDuplicate'
  const seconds = device.return_after_s
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_RETURN_AFTER_S) return 'settings.visuDevices.errorReturn'
  if (device.start_node_id && !pageIds.value.has(device.start_node_id)) return 'settings.visuDevices.errorMissingPage'
  return ''
}

const hasErrors = computed(() => devices.value.some(device => rowError(device)))

function deviceLink(device) {
  return `${window.location.origin}/visu/?device=${device.slug}`
}

async function copyLink(device) {
  try {
    await navigator.clipboard.writeText(deviceLink(device))
    copiedKey.value = device._key
  } catch {
    msg.value = { ok: false, text: t('settings.visuDevices.copyFailed') }
  }
}

function addDevice() {
  devices.value.push(toRow({ slug: '', name: '', start_node_id: null, return_after_s: 0 }, true))
  msg.value = null
}

async function save() {
  saving.value = true
  msg.value = null
  try {
    const payload = devices.value.map(device => ({
      slug: device.slug,
      name: device.name,
      start_node_id: device.start_node_id || null,
      return_after_s: device.return_after_s,
      header: device.header,
    }))
    const { data } = await visuDevicesApi.update(payload)
    devices.value = data.map(device => toRow(device))
    msg.value = { ok: true, text: t('settings.visuDevices.saved') }
  } catch (err) {
    const detail = err?.response?.data?.detail
    msg.value = {
      ok: false,
      text: typeof detail === 'string' ? detail : t('settings.visuDevices.saveError'),
    }
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const [deviceRes, pageRes, headerRes] = await Promise.all([visuDevicesApi.list(), visuDevicesApi.pages(), visuHeaderApi.get()])
    devices.value = deviceRes.data.map(device => toRow(device))
    pages.value = pageRes.data
    defaultHeader.value = headerRes.data
    await loadDatapointNames([headerRes.data, ...deviceRes.data.map(device => device.header).filter(Boolean)])
  } catch {
    msg.value = { ok: false, text: t('settings.visuDevices.loadError') }
  } finally {
    loading.value = false
  }
})
</script>
