/**
 * Pinia-Store: Geräteprofil dieses Browsers (Startseite, Rücksprung, Kopfleiste).
 *
 * Die Profile selbst werden zentral im Admin-GUI gepflegt und über eine
 * öffentliche Route geladen. Welches Profil *dieses* Gerät nutzt, merkt sich
 * der Browser — gesetzt über den Link `/visu/?device=<kennung>` oder die
 * Auswahl auf der Übersicht. `?device=` ohne Wert (oder `none`) löst das
 * Gerät wieder vom Profil.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { visuDevices, visuHeader, type VisuDevice, type VisuHeader } from '@/api/client'

export const DEVICE_STORAGE_KEY = 'visu_device'

/** Kopfleiste, solange (oder falls) der Server keine liefert — wie bisher. */
export const FALLBACK_HEADER: VisuHeader = {
  visible: true,
  sticky: false,
  show_breadcrumb: true,
  show_title: false,
  menu_page_id: null,
  menu_label: '',
  menu_icon: '',
  show_clock: false,
  show_date: false,
  values: [],
  show_theme_toggle: true,
  show_login: true,
}

function readStoredSlug(): string | null {
  try {
    return localStorage.getItem(DEVICE_STORAGE_KEY)
  } catch {
    return null
  }
}

export const useDeviceStore = defineStore('device', () => {
  const slug = ref<string | null>(readStoredSlug())
  const devices = ref<VisuDevice[]>([])
  const defaultHeader = ref<VisuHeader>(FALLBACK_HEADER)
  let loading: Promise<void> | null = null

  const profile = computed(() => devices.value.find(device => device.slug === slug.value) ?? null)

  /** Wohin „Start“ führt: die Startseite des Profils, sonst die Übersicht. */
  const startRoute = computed<RouteLocationRaw>(() =>
    profile.value?.start_node_id
      ? { name: 'viewer', params: { id: profile.value.start_node_id } }
      : { name: 'tree' },
  )

  const returnAfterMs = computed(() => (profile.value?.return_after_s ?? 0) * 1000)

  /** Die Kopfleiste dieses Geräts: eigene des Profils, sonst die Standard-Kopfleiste. */
  const header = computed<VisuHeader>(() => profile.value?.header ?? defaultHeader.value)

  /** Lädt Profile und Standard-Kopfleiste einmal; ein Fehler lässt die Visu wie bisher weiterlaufen. */
  function load(): Promise<void> {
    loading ??= Promise.all([
      visuDevices.list()
        .then((list) => { devices.value = list })
        .catch(() => { devices.value = [] }),
      visuHeader.get()
        .then((loaded) => { defaultHeader.value = loaded })
        .catch(() => { defaultHeader.value = FALLBACK_HEADER }),
    ]).then(() => undefined)
    return loading
  }

  function select(next: string | null) {
    slug.value = next || null
    try {
      if (slug.value) localStorage.setItem(DEVICE_STORAGE_KEY, slug.value)
      else localStorage.removeItem(DEVICE_STORAGE_KEY)
    } catch {
      // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
    }
  }

  /** Übernimmt `?device=` aus der URL, falls vorhanden. */
  function applyQuery(query: Record<string, unknown>) {
    if (!('device' in query)) return
    const value = Array.isArray(query.device) ? query.device[0] : query.device
    select(typeof value === 'string' && value !== 'none' ? value : null)
  }

  return { slug, devices, defaultHeader, profile, startRoute, returnAfterMs, header, load, select, applyQuery }
})
