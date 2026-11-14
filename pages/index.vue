<template>
  <div class="app-container">
    <main class="main-content">
      <div class="container">
        <div class="bsyes-logo-wrapper">
          <img src="/images/bsyes.png" alt="BS!Yes! Movie Search" class="bsyes-logo">
        </div>

        <div class="search-container">
          <div class="toggle-wrapper" role="group" aria-label="Views">
            <button
              v-for="(search, type) in searches"
              :key="type"
              type="button"
              :aria-pressed="!showDownloads && activeSearchType === type"
              @click="selectSearchType(type)"
            >
              {{ search.label }}
            </button>
            <button
              type="button"
              :aria-pressed="showDownloads"
              :disabled="!queue.length"
              @click="selectDownloads"
            >
              Downloads<span v-if="queue.length"> ({{ queue.length }})</span>
            </button>
          </div>

          <DownloadQueue v-if="showDownloads" :queue="queue" />
          <form v-else class="search-wrapper" role="search" @submit.prevent="submitSearch">
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

          <p class="visually-hidden" role="status">{{ searchAnnouncement }}</p>
          <section
            v-if="!showDownloads && query"
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
                <li v-for="item in orderedResults" :key="item.id">
                  <SearchResultCard
                    :item="item"
                    :download-state="downloadState(item, activeSearchType)"
                    @download="handleDownload($event, activeSearchType)"
                  />
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
const showDownloads = ref(false);
const movieTitleGroups = computed(() => {
  // Map order keeps each title at the relevance rank of its first match.
  const moviesByTitle = new Map();
  for (const movie of searches.movie.results) {
    const title = movie.title.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!moviesByTitle.has(title)) moviesByTitle.set(title, []);
    moviesByTitle.get(title).push(movie);
  }
  return Array.from(moviesByTitle.values());
});
const orderedResults = computed(() => {
  if (activeSearchType.value !== 'movie') return activeSearch.value.results;

  return movieTitleGroups.value.flatMap(movies =>
    [...movies].sort((a, b) => Number(b.year) - Number(a.year))
  );
});
const queue = ref([]);
const downloadRequests = reactive(new Map());
const downloadKey = (type, id) => `${type}:${id}`;
const noDownloadTimeout = 120000;
const selectedTvShow = ref(null);
let searchTimer = null;
let searchController = null;
let queueTimer = null;
let queueGeneration = 0;

const searchAnnouncement = computed(() => {
  if (showDownloads.value) return queue.value.length ? '' : 'No active downloads.';
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
  if (showDownloads.value || !query.value || searchController || (append && !search.hasMore)) return;
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
  if (!showDownloads.value && type === activeSearchType.value) return;

  cancelSearch();
  showDownloads.value = false;
  activeSearchType.value = type;
  if (activeSearch.value.status === 'idle') void runSearch();
};

const selectDownloads = () => {
  if (showDownloads.value || !queue.value.length) return;

  cancelSearch();
  showDownloads.value = true;
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
  if (query.value && !showDownloads.value) {
    activeSearch.value.status = 'loading';
    searchTimer = setTimeout(runSearch, 350);
  }
}, { flush: 'sync' });

const matchingDownloads = (entries, type, arrId, seasons) => entries.filter(entry =>
  arrId && entry.type === type && entry.arrId === arrId && !entry.blocked &&
  (!seasons || entry.season == null || seasons.includes(entry.season))
);

const downloadState = (item, type) => {
  const request = downloadRequests.get(downloadKey(type, item.id));
  if (request) return request.state;
  if (item.inLibrary) return 'inLibrary';

  const matches = matchingDownloads(queue.value, type, item.arrId);
  if (matches.some(entry => entry.transferring)) return 'downloading';
  return matches.length ? 'queued' : 'available';
};

const submitDownload = async (item, type, seasons) => {
  const key = downloadKey(type, item.id);
  const previous = downloadRequests.get(key);
  const state = downloadState(item, type);
  if (state !== 'available' && state !== 'stalled') return;

  const request = reactive({ type, seasons, state: 'queued', arrId: undefined, lastSeen: 0 });
  downloadRequests.set(key, request);
  item.error = '';

  try {
    const { arrId } = await $fetch('/api/download', {
      method: 'POST',
      body: { type, id: item.id, title: item.title, year: item.year, seasons, arrId: previous?.arrId ?? item.arrId },
    });
    request.arrId = arrId;
    request.lastSeen = Date.now();
    void updateQueue();
  } catch (error) {
    console.error(`Error submitting ${type} download:`, error);
    if (previous) downloadRequests.set(key, previous);
    else downloadRequests.delete(key);
    item.error = 'Download failed.';
  }
};

const handleDownload = (item, type) => {
  const request = downloadRequests.get(downloadKey(type, item.id));
  if (request?.state === 'stalled') {
    void submitDownload(item, type, request.seasons);
  } else if (type === 'tv') {
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
  const pending = [...downloadRequests.values()].filter(request => request.arrId && request.state !== 'inLibrary');
  const tracked = pending.map(({ type, arrId, seasons }) => ({ type, arrId, seasons }));
  try {
    const { entries, imports, unavailable } = await $fetch('/api/queue', {
      query: { tracked: JSON.stringify(tracked) },
    });
    if (generation !== queueGeneration) return;

    queue.value = [...entries, ...queue.value.filter(entry => unavailable[entry.type])];
    const now = Date.now();
    pending.forEach((request, index) => {
      if (imports[index] === true) {
        request.state = 'inLibrary';
        return;
      }
      if (unavailable[request.type]) return;

      const matches = matchingDownloads(entries, request.type, request.arrId, request.seasons);
      if (matches.length) {
        request.lastSeen = now;
        if (matches.some(entry => entry.transferring)) request.state = 'downloading';
        else if (request.state === 'stalled') request.state = 'queued';
      } else if (imports[index] === false && now - request.lastSeen >= noDownloadTimeout) {
        request.state = 'stalled';
      }
    });
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
  margin-bottom: 1rem;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
  margin: 0 0 1rem;
  padding: 0.25rem;
  border-radius: 12px;
  background: #f1f1f1;
}

.toggle-wrapper button {
  min-height: 44px;
  padding: 0.5rem 0.25rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #424242;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.toggle-wrapper button[aria-pressed="true"] {
  background: #b8351b;
  color: #ffffff;
}

.toggle-wrapper button:disabled {
  color: #737373;
  cursor: default;
}

.toggle-wrapper button[aria-pressed="true"]:disabled {
  background: #e0e0e0;
  color: #424242;
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
