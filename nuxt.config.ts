import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: '2025-06-29',
  modules: [],
  nitro: {
    storage: {
      providerCache: { driver: 'lru-cache', max: 1000 }
    }
  },
  app: {
    head: {
      title: 'BS!Yes! Movie Search',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },
  runtimeConfig: {
    // Set these private values through NUXT_* environment variables at runtime.
    radarrApiKey: '',
    radarrUrl: '',
    radarrRootFolderPath: '',
    radarrQualityProfileId: '',
    sonarrApiKey: '',
    sonarrUrl: '',
    sonarrRootFolderPath: '',
    sonarrQualityProfileId: '',
    tmdbApiKey: '',
    thetvdbApiKey: ''
  }
})
