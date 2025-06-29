
const radarrApiKey = process.env.VUE_APP_RADARR_API_KEY;
const radarrApiUrl = `http://localhost:7878/api/movie?apikey=${radarrApiKey}`;
const radarrQueueUrl = `http://localhost:7878/api/queue?apikey=${radarrApiKey}`;

export const checkRadarrLibrary = async (movies) => {
  try {
    const response = await fetch(radarrApiUrl);
    const library = await response.json();

    return movies.map(m => ({
      ...m,
      in_library: library.some(l => l.tmdbId === m.id),
      downloading: false,
      error: ''
    }));
  } catch (error) {
    console.error('Error checking Radarr library:', error);
    throw error;
  }
};

export const sendToRadarr = async (movie) => {
  const options = {
    title: movie.original_title,
    qualityProfileId: 1,
    titleSlug: `${movie.original_title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')}-${movie.id}`,
    images: [{
      covertype: 'poster',
      url: `https://image.tmdb.org/t/p/original${movie.poster_path}`
    }],
    tmdbId: movie.id,
    year: parseInt(movie.release_date.slice(0, 4)),
    rootFolderPath: 'V:/Movies/',
    addOptions: { searchForMovie: true }
  };

  try {
    await fetch(radarrApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });
  } catch (error) {
    console.error('Error sending to Radarr:', error);
    throw error;
  }
};

export const getRadarrQueue = async () => {
    try {
        const response = await fetch(radarrQueueUrl);
        return await response.json();
    } catch (error) {
        console.error('Error getting Radarr queue:', error);
        throw error;
    }
};
