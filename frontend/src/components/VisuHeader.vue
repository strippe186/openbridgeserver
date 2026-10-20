<script setup lang="ts">
/**
 * Kopfleiste über einer Visu-Seite. Was sie zeigt, legt der Administrator im
 * Admin-GUI fest — als Standard und optional je Geräteprofil (Handy, Wandpanel …).
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '@/stores/device'
import { useVisuStore } from '@/stores/visu'
import { useDatapointsStore } from '@/stores/datapoints'
import { useFormatStore } from '@/stores/format'
import { useThemeStore } from '@/stores/theme'
import Breadcrumb from '@/components/Breadcrumb.vue'
import AuthButton from '@/components/AuthButton.vue'
import VisuIcon from '@/components/VisuIcon.vue'
import type { VisuHeaderValue } from '@/api/client'

const props = defineProps<{ id: string; isPage: boolean }>()

const router = useRouter()
const device = useDeviceStore()
const visuStore = useVisuStore()
const dpStore = useDatapointsStore()
const format = useFormatStore()
const theme = useThemeStore()

const header = computed(() => device.header)
const title = computed(() => visuStore.getNode(props.id)?.name ?? '')
// Ziel des Menü-Knopfs: eine feste Seite oder die Startseite des Geräteprofils
// (ohne Profil bzw. Startseite: die Übersicht).
const menuPageId = computed(() =>
  header.value.menu_to_start ? (device.profile?.start_node_id ?? null) : header.value.menu_page_id,
)
const menuLabel = computed(() => header.value.menu_label || visuStore.getNode(menuPageId.value ?? '')?.name || '')
const menuIcon = computed(() => header.value.menu_icon || (menuLabel.value ? '' : '☰'))
const showMenu = computed(() =>
  (header.value.menu_to_start || !!header.value.menu_page_id) && menuPageId.value !== props.id,
)

function openMenu() {
  router.push(header.value.menu_to_start ? device.startRoute : { name: 'viewer', params: { id: header.value.menu_page_id } })
}

// Pfeil →: nächste Seite im selben Ordner (Reihenfolge der Seitenverwaltung),
// nach der letzten wieder die erste. Ohne weitere Seite kein Pfeil.
const nextPageId = computed(() => {
  const node = visuStore.getNode(props.id)
  if (node?.type !== 'PAGE') return null
  const pages = visuStore.getChildren(node.parent_id).filter((n) => n.type === 'PAGE')
  if (pages.length < 2) return null
  const index = pages.findIndex((n) => n.id === node.id)
  return pages[(index + 1) % pages.length].id
})

// Pfeil ←: zur zuvor besuchten Seite; ohne Verlauf (direkt geöffnet) eine
// Ebene höher, ganz oben zur Startseite des Geräts.
function goBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  const parentId = visuStore.getNode(props.id)?.parent_id
  router.push(parentId ? { name: 'viewer', params: { id: parentId } } : device.startRoute)
}

function goNext() {
  router.push({ name: 'viewer', params: { id: nextPageId.value } })
}

function valueText(item: VisuHeaderValue): string {
  const dp = dpStore.getValue(item.datapoint_id)
  if (!dp || dp.v === null || dp.v === undefined) return '—'
  const text = typeof dp.v === 'number' ? format.fmtNumber(dp.v, { decimals: item.decimals }) : String(dp.v)
  return dp.u ? `${text} ${dp.u}` : text
}

// Uhr: tickt nur, solange Uhrzeit oder Datum angezeigt werden.
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
const showTime = computed(() => header.value.visible && (header.value.show_clock || header.value.show_date))
watch(showTime, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(() => { now.value = new Date() }, 1000) : null
}, { immediate: true })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <header
    v-if="header.visible"
    class="border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0 bg-gray-50 dark:bg-gray-900"
    :class="{ 'sticky top-0 z-30': header.sticky }"
    data-testid="visu-header"
  >
    <div class="flex items-center gap-3 min-w-0">
      <button
        v-if="header.show_back"
        class="shrink-0 leading-none rounded text-base px-1.5 py-0.5 sm:text-3xl sm:px-3 sm:py-1 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        :title="$t('viewer.headerBack')"
        :aria-label="$t('viewer.headerBack')"
        data-testid="visu-header-back"
        @click="goBack"
      >←</button>
      <button
        v-if="showMenu"
        class="flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
        data-testid="visu-header-menu"
        @click="openMenu"
      >
        <span v-if="menuIcon" class="text-lg leading-none"><VisuIcon :icon="menuIcon" /></span>
        <span v-if="menuLabel">{{ menuLabel }}</span>
      </button>
      <h1 v-if="header.show_title" class="text-base font-semibold truncate" data-testid="visu-header-title">{{ title }}</h1>
      <Breadcrumb v-if="header.show_breadcrumb" />
    </div>

    <div class="flex items-center gap-2 sm:gap-3 shrink-0">
      <span
        v-for="item in header.values"
        :key="item.datapoint_id"
        class="flex items-center gap-1 text-sm tabular-nums"
        data-testid="visu-header-value"
      >
        <span v-if="item.icon" class="leading-none"><VisuIcon :icon="item.icon" /></span>
        <span v-if="item.label" class="hidden sm:inline text-gray-500 dark:text-gray-400">{{ item.label }}</span>
        <span class="font-medium">{{ valueText(item) }}</span>
      </span>
      <span v-if="showTime" class="flex flex-col items-end leading-tight tabular-nums" data-testid="visu-header-clock">
        <span v-if="header.show_clock" class="text-sm font-medium">{{ format.fmtTime(now) }}</span>
        <span v-if="header.show_date" class="text-xs text-gray-500 dark:text-gray-400">{{ format.fmtDate(now) }}</span>
      </span>
      <button
        v-if="visuStore.isAdmin && isPage"
        class="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-2 py-1 rounded"
        data-testid="visu-header-edit"
        @click="router.push({ name: 'editor', params: { id } })"
      >✏️ {{ $t('common.edit') }}</button>
      <button
        v-if="visuStore.isAdmin"
        class="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-2 py-1 rounded"
        data-testid="visu-header-manage"
        @click="router.push({ name: 'manage' })"
      >🗂 {{ $t('tree.manage') }}</button>
      <!-- Hell/Dunkel-Umschalter -->
      <button
        v-if="header.show_theme_toggle"
        class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded"
        :title="theme.isDark ? $t('common.darkMode') : $t('common.lightMode')"
        data-testid="visu-header-theme"
        @click="theme.toggle()"
      >{{ theme.isDark ? '☀️' : '🌙' }}</button>
      <AuthButton v-if="header.show_login || visuStore.isLoggedIn" />
      <button
        v-if="header.show_next && nextPageId"
        class="shrink-0 leading-none rounded text-base px-1.5 py-0.5 sm:text-3xl sm:px-3 sm:py-1 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        :title="$t('viewer.headerNext')"
        :aria-label="$t('viewer.headerNext')"
        data-testid="visu-header-next"
        @click="goNext"
      >→</button>
    </div>
  </header>
</template>
