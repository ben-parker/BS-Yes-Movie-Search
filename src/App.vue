<template>
  <div id="app">
    <div v-show="queue.length > 0">
      Currently Downloading
      <div v-for="movie in queue" :key="movie.downloadId">
        {{ movie.title }} - {{ movie.status }} ({{ movie.timeleft }} / {{ movie.sizeleft }})
      </div>

    </div>
    <div class="movie-search">
      <label for="movie-search">BS!Yes! Movie Search</label>
      <input type="search" id="movie-search"
        placeholder="Search for a movie..."
        class="movie-search"
        @input="doSearch"
      />
    </div>
    <ul class="search-results">
      <li v-for="movie in results" :key="movie.id">
        <div class="image-holder">
          <img v-if="movie.poster_path !== null" :src="moviePosterUrl(movie)" class="movie-poster">
          <div v-else class="no-image">
            <i class="material-icons" id="no-image">image</i>
          </div>
        </div>
        <div class="movie-details">
          <div class="movie-name">{{ movieTitle(movie) }}</div>
          <div class="movie-info">{{ movie.overview }}</div>
          <button v-if="movie.in_library" 
            :class="{downloaded: movie.in_library}"
            :disabled="movie.in_library"
          >
            In library
          </button>
          <button v-else @click="sendToDownloadClient(movie)" 
            :class="{downloaded: movie.in_library, downloading: movie.downloading}"
            :disabled="movie.downloading"
          >
            Download movie
            <span v-show="movie.downloading" class="movie-eta">ETA --:--:--</span>          
          </button>
          <div v-show="movie.error != ''" class="error">{{ movie.error }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',
  data: () => ({
    movie: null,
    results: [],
    timer: null,
    queue: [],
    queueTimer: null,
  }),
  methods: {
    async doSearch (e) {
      const value = e.target.value;
      const url = 'https://api.themoviedb.org/3/search/movie?api_key=' + process.env.VUE_APP_API + '&language=en-US&query=';
      
      if (value.length < 1) {
        this.results = [];
        return;
      }

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(async () => {
        const response = await axios.get(url + value);
        const results = response.data.results
          .filter(m => m.release_date !== '')
          .slice(0,5);
          
        this.checkLibrary(results);
      }, 1500);

    },
    moviePosterUrl (movie) {
      const imageBaseUrl = 'https://image.tmdb.org/t/p/w185_and_h278_bestv2';
      return imageBaseUrl + movie.poster_path;
    },
    movieTitle (movie) {
      return movie.original_title + ' (' + movie.release_date.slice(0,4) + ')';
    },
    async sendToDownloadClient (movie) {
      const url = 'http://localhost:7878/api/movie?apikey=' + process.env.VUE_APP_RADARR_API_KEY;
      const options = {
        title: movie.original_title,
        qualityProfileId: 1,
        titleSlug: movie.original_title.toLowerCase()
          .replace(/ /g, '-')
          .replace(/[^0-9a-z-]/g, '') 
          + '-' + movie.id,
        images: [
          {covertype: 'poster', url: 'https://image.tmdb.org/t/p/original' + movie.poster_path}
        ],
        tmdbId: movie.id,
        year: movie.release_date.slice(0,4),
        rootFolderPath: 'V:/Movies/',
        addOptions: { searchForMovie: true }
      };

      try {
        const response = await axios.post(url, options);
        if (response.data) {
          movie.error = '';
          movie.downloading = true; 
          this.updateQueue();
        }
        else {
          movie.error = 'Error downloading, talk to Ben'
        }
      }
      catch (error) {
        movie.error = 'Error downloading, talk to Ben'
        movie.downloading = false;
      }
           
    },
    async checkLibrary (movies) {
      // call radarr API
      const url = 'http://localhost:7878/api/movie?apikey=' + process.env.VUE_APP_RADARR_API_KEY;
      const library = await axios.get(url);

      const moviesWithLibraryInfo = movies
        .map(m => ({...m, in_library: false, downloading: false, error: ''}));

      moviesWithLibraryInfo.forEach(m => m.in_library = library.data.some(l => l.tmdbId == m.id));
      
      this.results = moviesWithLibraryInfo;
    },
    async updateQueue () {
      const url = 'http://192.168.50.185:7878/api/queue?apikey=' + process.env.VUE_APP_RADARR_API_KEY;

      const queue = await axios.get(url);
      if (queue.data) {
        this.queueTimer = setTimeout(async () => {
          this.updateQueue()
        }, 10000);

        this.queue = queue.data;
      }
    }
  }
};
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 100vh;
  font-family: 'Lato', sans-serif;
}

div.movie-search {
  width: 50%;
  max-width: 300px;
  text-align: center;
}

label {
  display: block;
  margin: 10px;
  font: 1.1em "typewriter", sans-serif;
}

input.movie-search {
  border: 1px solid rgb(0, 170, 135);
  align-self: center;
  padding: 5px;
}

ul.search-results {
  /* width: max-content; */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-content: center;
}

li {
  align-self: center;
  text-decoration: none;
  width: 100%;
  display: flex;
  margin: 20px;
}

div.movie-details {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-left: 10px;
}

div.movie-name {
  font-weight: bold;
  font-size: 20pt;
  text-align: center;
}

div.movie-info {
  margin-top: 10px;
  /* overflow: hidden; */
  line-height: 1em;
  max-height: 5em;
  overflow: hidden;
  padding-bottom: 0.5em;
}

button {
  color: white;
  background:rgb(0, 185, 255);
  border-radius: 5px;
  padding: 5px;
  margin-top: 20px;
}

button.downloaded {
  background: rgb(0, 170, 135);
}

button.downloading {
  background: lightgray;
  opacity: 50;
}

span.movie-eta {
  margin-left: 20px;
}

div.no-image {
  width: 185px;
  height: 278px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #dbdbdb;  
}

#no-image {
  font-size: 92px;
  color: black;
}

.error {
  color: red;
}
@media (min-width: 700px) {
  #app {
    max-width: 800px;
    margin: auto;
  }
}
/* 
@media (min-width: 1000px) {
  #app {
    margin-left: 20%;
    margin-right: 20%;
    width: 60%;
  }
} */
</style>
