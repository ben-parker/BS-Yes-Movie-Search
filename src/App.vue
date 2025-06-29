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

        <div class="movie-search mx-auto" style="max-width: 500px;">
          <v-img src="@/assets/bsyes.png" alt="BS!Yes! Movie Search" contain max-height="150" class="mx-auto mb-4"></v-img>
          <v-text-field
            v-model="searchQuery"
            label="Search for a movie..."
            variant="outlined"
            clearable
            @update:model-value="debouncedSearch"
          ></v-text-field>
        </div>

        <v-list v-if="results.length > 0" class="search-results mx-auto bg-transparent" style="max-width: 800px;">
          <v-list-item
            v-for="movie in results"
            :key="movie.id"
            class="my-4 pa-0"
          >
            <v-card variant="outlined">
              <div class="d-flex">
                <div>
                  <v-img
                    :src="moviePosterUrl(movie)"
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
                  <div class="text-h6">{{ movieTitle(movie) }}</div>
                  <div class="text-body-2 mt-2 overview-text">{{ movie.overview }}</div>
                  <v-spacer></v-spacer>
                  <div class="d-flex align-center mt-4">
                    <v-btn
                      v-if="movie.in_library"
                      color="success"
                      variant="tonal"
                      disabled
                    >
                      In Library
                    </v-btn>
                    <v-btn
                      v-else
                      :loading="movie.downloading"
                      :disabled="movie.downloading"
                      color="primary"
                      @click="sendToDownloadClient(movie)"
                    >
                      Download
                    </v-btn>
                    <v-alert
                      v-if="movie.error"
                      type="error"
                      density="compact"
                      class="ml-4"
                      :text="movie.error"
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
import axios from 'axios';

const searchQuery = ref('');
const results = ref([]);
const queue = ref([]);
let searchTimer = null;

// Environment variables for API keys
const radarrApiKey = process.env.VUE_APP_RADARR_API_KEY;
const tmdbApiKey = process.env.VUE_APP_API;

// API URLs
const radarrApiUrl = `http://localhost:7878/api/movie?apikey=${radarrApiKey}`;
const tmdbApiUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&language=en-US&query=`;
const radarrQueueUrl = `http://localhost:7878/api/queue?apikey=${radarrApiKey}`;

const moviePosterUrl = (movie) => {
  if (!movie.poster_path) return ''; // Return empty string for v-img to show placeholder
  return `https://image.tmdb.org/t/p/w185_and_h278_bestv2${movie.poster_path}`;
};

const movieTitle = (movie) => {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A';
  return `${movie.original_title} (${year})`;
};

const checkLibrary = async (movies) => {
  try {
    const libraryResponse = await axios.get(radarrApiUrl);
    const library = libraryResponse.data;

    const moviesWithLibraryInfo = movies.map(m => ({
      ...m,
      in_library: library.some(l => l.tmdbId === m.id),
      downloading: false,
      error: ''
    }));
    
    results.value = moviesWithLibraryInfo;
  } catch (error) {
    console.error('Error checking Radarr library:', error);
    // Optionally, set an error state to show in the UI
  }
};

const doSearch = async () => {
  if (searchQuery.value.length < 1) {
    results.value = [];
    return;
  }

  try {
    const response = await axios.get(tmdbApiUrl + searchQuery.value);
    const filteredResults = response.data.results
      .filter(m => m.release_date)
      .slice(0, 5);
    
    await checkLibrary(filteredResults);
  } catch (error) {
    console.error('Error searching TMDB:', error);
  }
};

const debouncedSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(doSearch, 500);
};

const sendToDownloadClient = async (movie) => {
  movie.downloading = true;
  movie.error = '';

  const options = {
    title: movie.original_title,
    qualityProfileId: 1, // This might need to be configurable
    titleSlug: `${movie.original_title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')}-${movie.id}`,
    images: [{
      covertype: 'poster',
      url: `https://image.tmdb.org/t/p/original${movie.poster_path}`
    }],
    tmdbId: movie.id,
    year: parseInt(movie.release_date.slice(0, 4)),
    rootFolderPath: 'V:/Movies/', // This should be configured in Radarr, not here
    addOptions: { searchForMovie: true }
  };

  try {
    await axios.post(radarrApiUrl, options);
    await updateQueue();
  } catch (error) {
    console.error('Error sending to Radarr:', error);
    movie.error = 'Download failed.';
  } finally {
    // Keep it loading until the queue updates and shows the item
    // movie.downloading = false; 
  }
};

const updateQueue = async () => {
  try {
    const response = await axios.get(radarrQueueUrl);
    queue.value = response.data;

    // If a movie was downloading, check if it's in the queue now
    // and stop the loading spinner.
    results.value.forEach(movie => {
      if (movie.downloading && queue.value.some(q => q.movie.tmdbId === movie.id)) {
        movie.downloading = false;
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
</style>

