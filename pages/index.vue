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
          <div v-else-if="hasResults" class="toggle-wrapper mt-4">
            <button
              v-for="(search, type) in searches"
              :key="type"
              :class="{ active: activeSearchType === type }"
              :disabled="search.results.length === 0"
              @click="activeSearchType = type"
            >
              <span v-if="search.failed" class="error-indicator">&times;</span>
              {{ search.label }} ({{ search.results.length }})
            </button>
          </div>
        </div>

        <ul v-if="isLoading" class="search-results mx-auto" style="max-width: 800px;">
          <li v-for="n in 5" :key="n" class="my-4 pa-0">
            <GhostLoaderCard />
          </li>
        </ul>
        <div v-else-if="hasResults">
          <ul
            v-for="(search, type) in searches"
            v-show="activeSearchType === type"
            :key="type"
            class="search-results mx-auto"
            style="max-width: 800px;"
          >
            <li
              v-for="item in search.results"
              :key="item.id"
              class="my-4 pa-0"
            >
              <SearchResultCard :item="item" @download="handleDownload($event, type)" />
            </li>
          </ul>
        </div>
      </div>
    </main>
    <SeasonSelectionModal
      v-if="selectedTvShow"
      :item="selectedTvShow"
      @close="selectedTvShow = null"
      @submit="submitTvDownload"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { $fetch } from 'ofetch';
import DownloadQueue from '~/components/DownloadQueue.vue';
import SearchResultCard from '~/components/SearchResultCard.vue';
import GhostLoaderCard from '~/components/GhostLoaderCard.vue';
import SeasonSelectionModal from '~/components/SeasonSelectionModal.vue';

const searchQuery = ref('');
const searches = reactive({
  movie: { label: 'Movies', results: [], failed: false },
  tv: { label: 'TV Shows', results: [], failed: false },
});
const activeSearchType = ref('movie');
const isLoading = ref(false);
const queue = ref([]);
const selectedTvShow = ref(null);
let searchTimer = null;
let ghostLoaderTimer = null;
let queueTimer = null;
let searchGeneration = 0;
let queueGeneration = 0;

const hasResults = computed(() => Object.values(searches).some(search => search.results.length > 0));

const resetResults = () => {
  for (const search of Object.values(searches)) {
    search.results = [];
    search.failed = false;
  }
};

const doSearch = async (query, generation) => {
  isLoading.value = true;
  resetResults();

  const entries = Object.entries(searches);
  const outcomes = await Promise.allSettled(entries.map(([type]) => $fetch('/api/search', {
    query: { type, query },
  })));
  if (generation !== searchGeneration) return;

  outcomes.forEach((outcome, index) => {
    const [, search] = entries[index];
    if (outcome.status === 'fulfilled') {
      search.results = outcome.value;
    } else {
      search.failed = true;
      console.error(`${search.label} search failed:`, outcome.reason);
    }
  });

  const firstResult = entries.find(([, search]) => search.results.length > 0);
  if (firstResult) {
    activeSearchType.value = firstResult[0];
  }
  isLoading.value = false;
};

const invalidateSearch = () => {
  searchGeneration++;
  clearTimeout(searchTimer);
  clearTimeout(ghostLoaderTimer);
};

const clearSearch = () => {
  invalidateSearch();
  searchQuery.value = '';
  resetResults();
  isLoading.value = false;
};

const debouncedSearch = () => {
  const query = searchQuery.value;
  if (!query) {
    clearSearch();
    return;
  }

  invalidateSearch();
  const generation = searchGeneration;
  ghostLoaderTimer = setTimeout(() => {
    isLoading.value = true;
  }, 300);
  searchTimer = setTimeout(() => doSearch(query, generation), 1000);
};

const submitDownload = async (item, type, seasons) => {
  if (item.submitting) return;
  item.submitting = true;
  item.error = '';

  try {
    await $fetch('/api/download', {
      method: 'POST',
      body: { type, id: item.id, title: item.title, year: item.year, seasons },
    });
    void updateQueue();
  } catch (error) {
    console.error(`Error submitting ${type} download:`, error);
    item.error = 'Download failed.';
  } finally {
    item.submitting = false;
  }
};

const handleDownload = (item, type) => {
  if (type === 'tv') {
    selectedTvShow.value = item;
  } else {
    return submitDownload(item, type);
  }
};

const submitTvDownload = (seasons) => {
  const item = selectedTvShow.value;
  selectedTvShow.value = null;
  if (item) return submitDownload(item, 'tv', seasons);
};

const updateQueue = async () => {
  const generation = ++queueGeneration;
  try {
    const entries = await $fetch('/api/queue');
    if (generation === queueGeneration) queue.value = entries;
  } catch (error) {
    console.error('Error updating queue:', error);
  }
};

onMounted(() => {
  updateQueue();
  queueTimer = setInterval(updateQueue, 10000);
});

onUnmounted(() => {
  invalidateSearch();
  queueGeneration++;
  clearInterval(queueTimer);
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
