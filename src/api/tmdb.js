
const tmdbApiKey = process.env.VUE_APP_API;
const tmdbApiUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&language=en-US&query=`;

export const searchTmdb = async (query) => {
  if (query.length < 1) {
    return [];
  }

  try {
    const response = await fetch(tmdbApiUrl + query);
    const data = await response.json();
    return data.results
      .filter(m => m.release_date)
      .slice(0, 5);
  } catch (error) {
    console.error('Error searching TMDB:', error);
    throw error;
  }
};
