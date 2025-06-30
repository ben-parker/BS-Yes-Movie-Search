<template>
  <div class="app-container">
    <main class="main-content">
      <div class="container">
        <DownloadQueue :queue="queue" />

        <div class="bsyes-logo-wrapper mb-8">
          <img src="/images/bsyes.png" alt="BS!Yes! Movie Search" class="bsyes-logo">
        </div>

        <div class="search-container mx-auto" style="max-width: 800px;">
          <div class="search-wrapper">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search for a movie or tv show..."
              class="search-input"
              @input="debouncedSearch"
            >
            <div v-if="isLoading" class="spinner" />
            <button v-else-if="searchQuery" class="clear-button" @click="clearSearch">
              &times;
            </button>
          </div>

          <div v-if="isLoading" class="toggle-wrapper mt-4">
            <div class="ghost-button" />
            <div class="ghost-button" />
          </div>
          <div v-else-if="movieResults.length > 0 || tvResults.length > 0" class="toggle-wrapper mt-4">
            <button
              :class="{ active: activeSearchType === 'movie' }"
              :disabled="movieToggleDisabled"
              @click="activeSearchType = 'movie'"
            >
              <span v-if="movieSearchError" class="error-indicator">&times;</span>
              Movies ({{ movieResults.length }})
            </button>
            <button
              :class="{ active: activeSearchType === 'tv' }"
              :disabled="tvToggleDisabled"
              @click="activeSearchType = 'tv'"
            >
              <span v-if="tvSearchError" class="error-indicator">&times;</span>
              TV Shows ({{ tvResults.length }})
            </button>
          </div>
        </div>

        <ul v-if="isLoading" class="search-results mx-auto" style="max-width: 800px;">
          <li v-for="n in 5" :key="n" class="my-4 pa-0">
            <GhostLoaderCard />
          </li>
        </ul>
        <div v-else-if="movieResults.length > 0 || tvResults.length > 0">
          <ul v-show="activeSearchType === 'movie'" class="search-results mx-auto" style="max-width: 800px;">
            <li
              v-for="item in movieResults"
              :key="item.id"
              class="my-4 pa-0"
            >
              <SearchResultCard :item="item" :search-type="'movie'" @download="handleDownload" />
            </li>
          </ul>
          <ul v-show="activeSearchType === 'tv'" class="search-results mx-auto" style="max-width: 800px;">
            <li
              v-for="item in tvResults"
              :key="item.id"
              class="my-4 pa-0"
            >
              <SearchResultCard :item="item" :search-type="'tv'" @download="handleDownload" />
            </li>
          </ul>
        </div>
      </div>
    </main>
    <SeasonSelectionModal
      v-if="showSeasonModal"
      :item="selectedTvShow"
      @close="showSeasonModal = false"
      @submit="sendTvShowToDownloadClient"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { $fetch } from 'ofetch';
import DownloadQueue from '~/components/DownloadQueue.vue';
import SearchResultCard from '~/components/SearchResultCard.vue';
import GhostLoaderCard from '~/components/GhostLoaderCard.vue';
import SeasonSelectionModal from '~/components/SeasonSelectionModal.vue';

const searchQuery = ref('');
const movieResults = ref([]);
const tvResults = ref([]);
const activeSearchType = ref('movie');
const movieToggleDisabled = ref(false);
const tvToggleDisabled = ref(false);
const movieSearchError = ref(false);
const tvSearchError = ref(false);
const isLoading = ref(false);
const queue = ref([]);
const showSeasonModal = ref(false);
const selectedTvShow = ref(null);
let searchTimer = null;
let ghostLoaderTimer = null;

const activeResults = computed(() => {
  return activeSearchType.value === 'movie' ? movieResults.value : tvResults.value;
});

const doSearch = async () => {
  if (searchQuery.value.length < 1) {
    clearSearch();
    return;
  }

  isLoading.value = true;
  movieResults.value = [];
  tvResults.value = [];
  movieSearchError.value = false;
  tvSearchError.value = false;

  const [moviePromise, tvPromise] = await Promise.allSettled([
    $fetch(`/api/search?type=movie&query=${searchQuery.value}`),
    $fetch(`/api/search?type=tv&query=${searchQuery.value}`)
  ]);

  isLoading.value = false;

  if (moviePromise.status === 'fulfilled') {
    movieResults.value = moviePromise.value;
    movieToggleDisabled.value = moviePromise.value.length === 0;
  } else {
    console.error('Movie search failed:', moviePromise.reason);
    movieSearchError.value = true;
    movieToggleDisabled.value = true;
  }

  if (tvPromise.status === 'fulfilled') {
    tvResults.value = tvPromise.value;
    tvToggleDisabled.value = tvPromise.value.length === 0;
  } else {
    console.error('TV search failed:', tvPromise.reason);
    tvSearchError.value = true;
    tvToggleDisabled.value = true;
  }

  if (movieResults.value.length > 0) {
    activeSearchType.value = 'movie';
  } else if (tvResults.value.length > 0) {
    activeSearchType.value = 'tv';
  }
};

const clearSearch = () => {
  searchQuery.value = '';
  movieResults.value = [];
  tvResults.value = [];
  movieToggleDisabled.value = true;
  tvToggleDisabled.value = true;
  movieSearchError.value = false;
  tvSearchError.value = false;
  isLoading.value = false;
  clearTimeout(searchTimer);
  clearTimeout(ghostLoaderTimer);
};

const debouncedSearch = () => {
  clearTimeout(searchTimer);
  clearTimeout(ghostLoaderTimer);

  if (searchQuery.value.length > 0) {
    ghostLoaderTimer = setTimeout(() => {
      isLoading.value = true;
    }, 300);

    searchTimer = setTimeout(doSearch, 1000);
  } else {
    clearSearch();
  }
};

const handleDownload = (item) => {
  if (activeSearchType.value === 'tv') {
    selectedTvShow.value = item;
    showSeasonModal.value = true;
  } else {
    sendMovieToDownloadClient(item);
  }
};

const sendMovieToDownloadClient = async (item) => {
  item.downloading = true;
  item.error = '';

  try {
    await $fetch('/api/download', {
      method: 'POST',
      body: { ...item, type: 'movie' }
    });
    await updateQueue();
  } catch (error) {
    console.error(`Error sending movie to client:`, error);
    item.error = 'Download failed.';
  }
};

const sendTvShowToDownloadClient = async (selectedSeasons) => {
  showSeasonModal.value = false;
  const item = selectedTvShow.value;
  item.downloading = true;
  item.error = '';

  try {
    await $fetch('/api/download', {
      method: 'POST',
      body: { ...item, type: 'tv', seasons: selectedSeasons }
    });
    await updateQueue();
  } catch (error) {
    console.error(`Error sending tv show to client:`, error);
    item.error = 'Download failed.';
  }
};

const updateQueue = async () => {
  try {
    queue.value = await $fetch('/api/queue');

    const allResults = [...movieResults.value, ...tvResults.value];
    allResults.forEach(item => {
      if (item.downloading && queue.value.some(q => (q.movie && q.movie.tmdbId === item.id) || (q.series && q.series.tvdbId === item.id))) {
        item.downloading = false;
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
/* General Styles */
.app-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #ffffff;
  color: #212121;
  min-height: 100vh;
}

.main-content {
  padding: 1rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.mb-8 {
  margin-bottom: 2rem;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.my-4 {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.mt-4 {
  margin-top: 1rem;
}

.pa-0 {
  padding: 0;
}

/* Logo */
.bsyes-logo-wrapper {
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}

.bsyes-logo {
  width: 100%;
  height: auto;
  display: block;
}

/* Search Container */
.search-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.search-wrapper {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  box-sizing: border-box;
  -webkit-appearance: none;
}

.clear-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: #757575;
  cursor: pointer;
  padding: 0.5rem;
  line-height: 1;
}

.spinner {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1976D2;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: translateY(-50%) rotate(0deg); }
  100% { transform: translateY(-50%) rotate(360deg); }
}

/* Ghost Button Loader */
.ghost-button {
  width: 120px; /* Adjust width as needed */
  height: 38px; /* Match button height */
  background-color: #e0e0e0;
  border-radius: 8px;
  animation: pulse-bg 1.5s infinite;
}

@keyframes pulse-bg {
  0% { background-color: #e0e0e0; }
  50% { background-color: #f0f0f0; }
  100% { background-color: #e0e0e0; }
}

/* Toggle Buttons */
.toggle-wrapper {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.toggle-wrapper button {
  position: relative;
  padding: 0.5rem 1rem;
  border: 1px solid #E0E0E0;
  background-color: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.toggle-wrapper button.active {
  background-color: #d43e20;
  color: #ffffff;
  border-color: #d43e20;
}

.toggle-wrapper button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-indicator {
  color: #D32F2F;
  font-weight: bold;
  margin-right: 0.25rem;
}

/* Search Results */
.search-results {
  list-style: none;
  padding: 0;
}
</style>
