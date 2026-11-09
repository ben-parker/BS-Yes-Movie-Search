<template>
  <div class="app-container">
    <main class="main-content">
      <div class="container">
        <DownloadQueue :queue="queue" />

        <div class="bsyes-logo-wrapper">
          <img src="/images/bsyes.png" alt="BS!Yes! Movie Search" class="bsyes-logo">
        </div>

        <div class="search-container">
          <form class="search-wrapper" role="search" @submit.prevent="submitSearch">
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="search"
              :aria-label="activeSearch.placeholder"
              :placeholder="activeSearch.placeholder"
              enterkeyhint="search"
              class="search-input"
            >
            <button
              v-if="searchQuery"
              type="button"
              class="clear-button"
              aria-label="Clear search"
              @click="clearSearch"
            >
              &times;
            </button>
          </form>

          <div class="toggle-wrapper" role="group" aria-label="Search type">
            <button
              v-for="(search, type) in searches"
              :key="type"
              type="button"
              :aria-pressed="activeSearchType === type"
              @click="selectSearchType(type)"
            >
              {{ search.label }}
            </button>
          </div>

          <p class="visually-hidden" role="status">{{ searchAnnouncement }}</p>
          <section
            v-if="query"
            :aria-label="activeSearch.label + ' results'"
            :aria-busy="activeSearch.status === 'loading' || activeSearch.loadingMore"
          >
            <template v-if="activeSearch.status === 'loading'">
              <p class="loading-label" aria-hidden="true">Searching {{ activeSearch.subject }}…</p>
              <ul class="search-results" aria-hidden="true">
                <li v-for="n in 3" :key="n"><GhostLoaderCard /></li>
              </ul>
            </template>

            <div v-else-if="activeSearch.status === 'error'" class="search-message">
              <h2>Search unavailable</h2>
              <p>We couldn’t search {{ activeSearch.subject }}. Please try again.</p>
              <button type="button" class="action-button" @click="submitSearch">Retry search</button>
            </div>

            <template v-else-if="activeSearch.status === 'ready'">
              <div v-if="!activeSearch.results.length" class="search-message">
                <h2>No {{ activeSearch.subject }} found</h2>
                <p>Try a different spelling or a shorter title.</p>
              </div>

              <ul v-else class="search-results">
                <li v-for="item in activeSearch.results" :key="item.id">
                  <SearchResultCard :item="item" @download="handleDownload($event, activeSearchType)" />
                </li>
              </ul>

              <div v-if="activeSearch.hasMore" class="pagination">
                <p v-if="activeSearch.loadingMore" class="loading-more" aria-hidden="true">Loading more movies…</p>
                <template v-else-if="activeSearch.loadMoreFailed">
                  <p>Couldn’t load more movies.</p>
                  <button type="button" class="action-button" @click="runSearch(true)">Retry loading more</button>
                </template>
                <div v-else ref="loadMoreTarget" class="load-more-target" aria-hidden="true" />
              </div>
            </template>
          </section>
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
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { $fetch } from 'ofetch';
import DownloadQueue from '~/components/DownloadQueue.vue';
import SearchResultCard from '~/components/SearchResultCard.vue';
import GhostLoaderCard from '~/components/GhostLoaderCard.vue';
import SeasonSelectionModal from '~/components/SeasonSelectionModal.vue';

const emptySearch = () => ({
  status: 'idle',
  results: [],
  page: 1,
  hasMore: false,
  loadingMore: false,
  loadMoreFailed: false,
});

const searchInput = ref(null);
const loadMoreTarget = ref(null);
const searchQuery = ref('');
const query = computed(() => searchQuery.value.trim());
const searches = reactive({
  movie: { label: 'Movies', subject: 'movies', placeholder: 'Search movies', ...emptySearch() },
  tv: { label: 'TV Shows', subject: 'TV shows', placeholder: 'Search TV shows', ...emptySearch() },
});
const activeSearchType = ref('movie');
const activeSearch = computed(() => searches[activeSearchType.value]);
const queue = ref([]);
const selectedTvShow = ref(null);
let searchTimer = null;
let searchController = null;
let queueTimer = null;
let queueGeneration = 0;

const searchAnnouncement = computed(() => {
  const { status, subject, results, loadingMore, loadMoreFailed } = activeSearch.value;
  if (status === 'loading') return `Searching ${subject}…`;
  if (status === 'error') return `Couldn’t search ${subject}. Please try again.`;
  if (loadingMore) return 'Loading more movies…';
  if (loadMoreFailed) return 'Couldn’t load more movies.';
  if (status === 'ready') {
    return results.length ? `${results.length} results loaded.` : `No ${subject} found.`;
  }
  return '';
});

const cancelSearch = () => {
  clearTimeout(searchTimer);
  const controller = searchController;
  searchController = null;
  controller?.abort();

  const search = activeSearch.value;
  if (search.status === 'loading') search.status = 'idle';
  search.loadingMore = false;
};

const runSearch = async (append = false) => {
  clearTimeout(searchTimer);
  const type = activeSearchType.value;
  const search = activeSearch.value;
  if (!query.value || searchController || (append && !search.hasMore)) return;
  const page = append ? search.page + 1 : 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  searchController = controller;

  if (append) {
    search.loadingMore = true;
    search.loadMoreFailed = false;
  } else {
    search.status = 'loading';
  }

  try {
    const response = await $fetch('/api/search', {
      query: { type, query: query.value, page: type === 'movie' ? page : undefined },
      signal: controller.signal,
      retry: 0,
    });
    if (searchController !== controller) return;

    const results = type === 'movie' ? response.results : response;
    if (append) {
      const existingIds = new Set(search.results.map(item => item.id));
      search.results.push(...results.filter(item => !existingIds.has(item.id)));
    } else {
      search.results = results;
    }
    search.page = page;
    search.hasMore = type === 'movie' && response.hasMore;
    search.status = 'ready';
  } catch (error) {
    if (searchController !== controller) return;

    if (append) {
      search.loadMoreFailed = true;
    } else {
      search.status = 'error';
    }
    console.error(`${search.label} search failed:`, error);
  } finally {
    clearTimeout(timeout);
    if (searchController === controller) {
      searchController = null;
      search.loadingMore = false;
    }
  }
};

watch(loadMoreTarget, (target, _, onCleanup) => {
  if (!target) return;

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && loadMoreTarget.value === target) void runSearch(true);
  }, { rootMargin: '0px 0px 240px 0px' });
  observer.observe(target);
  onCleanup(() => observer.disconnect());
}, { flush: 'post' });

const submitSearch = () => {
  if (activeSearch.value.status !== 'ready') void runSearch();
};

const selectSearchType = (type) => {
  if (type === activeSearchType.value) return;

  cancelSearch();
  activeSearchType.value = type;
  if (activeSearch.value.status === 'idle') void runSearch();
};

const clearSearch = () => {
  searchQuery.value = '';
  searchInput.value?.focus();
};

watch(query, () => {
  cancelSearch();
  for (const search of Object.values(searches)) {
    Object.assign(search, emptySearch());
  }
  if (query.value) {
    activeSearch.value.status = 'loading';
    searchTimer = setTimeout(runSearch, 350);
  }
}, { flush: 'sync' });

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
  cancelSearch();
  queueGeneration++;
  clearInterval(queueTimer);
});
</script>

<style scoped>
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

.bsyes-logo-wrapper {
  padding: 0 1rem;
  margin-bottom: 2rem;
}

.bsyes-logo {
  display: block;
  width: 100%;
  height: auto;
}

.search-container {
  max-width: 800px;
  margin: 0 auto;
  --result-poster-width: clamp(64px, 21vw, 120px);
}

.search-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
  min-height: 48px;
  padding: 0.75rem 3rem 0.75rem 1rem;
  font: inherit;
  border: 1px solid #bdbdbd;
  border-radius: 12px;
  box-sizing: border-box;
  appearance: none;
}

.search-input::-webkit-search-cancel-button {
  appearance: none;
}

.clear-button {
  position: absolute;
  inset: 0 0 0 auto;
  width: 48px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 12px;
  color: #555;
  font-size: 1.5rem;
  cursor: pointer;
}

.toggle-wrapper {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  margin: 0.75rem 0 1rem;
  padding: 0.25rem;
  border-radius: 12px;
  background: #f1f1f1;
}

.toggle-wrapper button {
  min-height: 44px;
  padding: 0.5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #424242;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.toggle-wrapper button[aria-pressed="true"] {
  background: #b8351b;
  color: #ffffff;
}

.search-input:focus-visible,
.clear-button:focus-visible,
.toggle-wrapper button:focus-visible,
.action-button:focus-visible {
  outline: 2px solid #1458a6;
  outline-offset: 2px;
}

.search-results {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.loading-label {
  margin: 0 0 0.75rem;
  color: #555;
  font-size: 0.875rem;
}

.search-message {
  padding: 1.5rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: #fafafa;
  text-align: center;
}

.search-message h2 {
  margin: 0;
  font-size: 1.125rem;
}

.search-message p,
.pagination p {
  margin: 0.5rem 0 0;
  color: #555;
}

.pagination {
  margin: 1rem 0;
  text-align: center;
}

.action-button {
  min-height: 44px;
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  border: 1px solid #1458a6;
  border-radius: 8px;
  background: #fff;
  color: #1458a6;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.load-more-target {
  height: 1px;
}

.loading-more {
  font-size: 0.875rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
