import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: '2025-06-29',
  modules: [],
  app: {
    head: {
      title: 'BS!Yes! Movie Search',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },
  runtimeConfig: {
    // Private keys are only available on the server
    radarrApiKey: process.env.VUE_APP_RADARR_API_KEY,
    radarrUrl: process.env.VUE_APP_RADARR_URL,
    radarrRootFolderPath: process.env.VUE_APP_RADARR_ROOT_FOLDER_PATH,
    radarrQualityProfileId: process.env.VUE_APP_RADARR_QUALITY_PROFILE_ID,
    sonarrApiKey: process.env.VUE_APP_SONARR_API_KEY,
    sonarrUrl: process.env.VUE_APP_SONARR_URL,
    sonarrRootFolderPath: process.env.VUE_APP_SONARR_ROOT_FOLDER_PATH,
    sonarrQualityProfileId: process.env.VUE_APP_SONARR_QUALITY_PROFILE_ID,
    tmdbApiKey: process.env.VUE_APP_MOVIEDB_API_KEY,
    thetvdbApiKey: process.env.VUE_APP_TVDB_API_KEY,
    // Public keys that are exposed to the client
    public: {}
  }
})
