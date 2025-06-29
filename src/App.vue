<template>
  <v-app>
    <v-main>
      <v-container>
        <div v-if="queue.length > 0" class="mb-4">
          <h2 class="text-h5">Currently Downloading</h2>
          <v-list lines="one">
            <v-list-item
              v-for="movie in queue"
              :key="movie.downloadId"
              :title="movie.title"
              :subtitle="`${movie.status} (${movie.timeleft} / ${movie.sizeleft})`"
            ></v-list-item>
          </v-list>
        </div>

        <div class="bsyes-logo-wrapper mb-8">
          <v-img src="/bsyes.png" alt="BS!Yes! Movie Search" contain class="bsyes-logo"></v-img>
        </div>

        <div class="movie-search mx-auto" style="max-width: 500px;">
          <v-btn-toggle v-model="searchType" mandatory class="mb-4">
            <v-btn value="movie">Movies</v-btn>
            <v-btn value="tv">TV Shows</v-btn>
          </v-btn-toggle>
          <v-text-field
            v-model="searchQuery"
            :label="`Search for a ${searchType}...`"
            variant="outlined"
            clearable
            @update:model-value="debouncedSearch"
          ></v-text-field>
        </div>

        <v-list v-if="results.length > 0" class="search-results mx-auto bg-transparent" style="max-width: 800px;">
          <v-list-item
            v-for="item in results"
            :key="item.id"
            class="my-4 pa-0"
          >
            <v-card variant="outlined">
              <div class="d-flex">
                <div>
                  <v-img
                    :src="itemPosterUrl(item)"
                    width="120"
                    height="180"
                    cover
                    class="ma-2 rounded"
                  >
                    <template v-slot:placeholder>
                      <div class="d-flex align-center justify-center fill-height bg-grey-lighten-2">
                        <v-icon>mdi-image</v-icon>
                      </div>
                    </template>
                  </v-img>
                </div>
                <div class="d-flex flex-column flex-grow-1 pa-4">
                  <div class="text-h6">{{ itemTitle(item) }}</div>
                  <div class="text-body-2 mt-2 overview-text">{{ item.overview }}</div>
                  <v-spacer></v-spacer>
                  <div class="d-flex align-center mt-4">
                    <v-btn
                      v-if="item.in_library"
                      color="success"
                      variant="tonal"
                      disabled
                    >
                      In Library
                    </v-btn>
                    <v-btn
                      v-else
                      :loading="item.downloading"
                      :disabled="item.downloading"
                      color="primary"
                      @click="sendToDownloadClient(item)"
                    >
                      Download
                    </v-btn>
                    <v-alert
                      v-if="item.error"
                      type="error"
                      density="compact"
                      class="ml-4"
                      :text="item.error"
                      variant="tonal"
                    ></v-alert>
                  </div>
                </div>
              </div>
            </v-card>
          </v-list-item>
        </v-list>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { searchTmdb } from './api/tmdb';
import { checkRadarrLibrary, sendToRadarr, getRadarrQueue } from './api/radarr';
import { searchTheTvDb } from './api/thetvdb';
import { checkSonarrLibrary, sendToSonarr, getSonarrQueue } from './api/sonarr';

const searchQuery = ref('');
const results = ref([]);
const queue = ref([]);
const searchType = ref('movie'); // 'movie' or 'tv'
let searchTimer = null;

const itemPosterUrl = (item) => {
  if (searchType.value === 'movie') {
    if (!item.poster_path) return '';
    return `https://image.tmdb.org/t/p/w185_and_h278_bestv2${item.poster_path}`;
  } else {
    // TheTVDB provides a full URL for the poster
    return item.poster_path || 'https://via.placeholder.com/120x180';
  }
};

const itemTitle = (item) => {
  if (searchType.value === 'movie') {
    const year = item.release_date ? item.release_date.slice(0, 4) : 'N/A';
    return `${item.original_title} (${year})`;
  } else {
    // Placeholder for TV show title
    return item.name;
  }
};

const doSearch = async () => {
  if (searchQuery.value.length < 1) {
    results.value = [];
    return;
  }

  try {
    let searchResults;
    if (searchType.value === 'movie') {
      searchResults = await searchTmdb(searchQuery.value);
      results.value = await checkRadarrLibrary(searchResults);
    } else {
      searchResults = await searchTheTvDb(searchQuery.value);
      results.value = await checkSonarrLibrary(searchResults);
    }
  } catch (error) {
    console.error(`Error during ${searchType.value} search:`, error);
  }
};

const debouncedSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(doSearch, 500);
};

const sendToDownloadClient = async (item) => {
  item.downloading = true;
  item.error = '';

  try {
    if (searchType.value === 'movie') {
      await sendToRadarr(item);
    } else {
      await sendToSonarr(item);
    }
    await updateQueue();
  } catch (error) {
    console.error(`Error sending to ${searchType.value} client:`, error);
    item.error = 'Download failed.';
  } finally {
    // Keep it loading until the queue updates and shows the item
    // item.downloading = false; 
  }
};

const updateQueue = async () => {
  try {
    const radarrQueue = await getRadarrQueue();
    const sonarrQueue = await getSonarrQueue();
    queue.value = [...radarrQueue, ...sonarrQueue];

    // If a movie was downloading, check if it's in the queue now
    // and stop the loading spinner.
    results.value.forEach(item => {
      if (item.downloading && queue.value.some(q => (q.movie && q.movie.tmdbId === item.id) || (q.series && q.series.tvdbId === item.id))) {
        item.downloading = false;
        // Optionally, mark as "in queue" instead of just stopping the loader
      }
    });

  } catch (error) {
    console.error('Error updating queue:', error);
  }
};

onMounted(() => {
  updateQueue();
  setInterval(updateQueue, 10000);
});
</script>

<style scoped>
.overview-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bsyes-logo-wrapper {
  padding: 0 8px; /* 8px padding on left and right */
  width: 100%; /* Default to full width on mobile */
  margin: 0 auto; /* Center the wrapper */
}

.bsyes-logo {
  width: 100%; /* Fill the padded wrapper */
}

@media (min-width: 960px) {
  .bsyes-logo-wrapper {
    width: 100%; /* Ensure wrapper takes full width */
  }
  .bsyes-logo {
    margin: 0 auto; /* Center the image */
  }
}
</style>

