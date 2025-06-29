
// TODO: Add your TheTVDB API Key to .env.development.local
const thetvdbApiKey = process.env.VUE_APP_THETVDB_API_KEY;
const thetvdbApiUrl = `https://api4.thetvdb.com/v4/search?`;

export const searchTheTvDb = async (query) => {
  if (query.length < 1) {
    return [];
  }

  try {
    const url = new URL(thetvdbApiUrl);
    url.searchParams.append('query', query);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${thetvdbApiKey}`
      }
    });

    if (!response.ok) {
      // TheTVDB returns errors in the body, so we try to parse it
      const errorData = await response.json();
      console.error('Error searching TheTVDB:', errorData);
      throw new Error(`TheTVDB API error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Map the response to a format consistent with the movie results
    return data.data.map(show => ({
      id: show.tvdb_id,
      original_title: show.name,
      release_date: show.year, // TheTVDB provides year, not a full date
      overview: show.overview,
      poster_path: show.image_url // TheTVDB provides a full URL
    }));

  } catch (error) {
    console.error('Error searching TheTVDB:', error);
    throw error;
  }
};
