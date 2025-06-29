
// TODO: Add your Sonarr API Key to .env.development.local
const sonarrApiKey = process.env.VUE_APP_SONARR_API_KEY;
// TODO: Add your Sonarr URL to .env.development.local
const sonarrApiUrl = process.env.VUE_APP_SONARR_URL;

const sonarrSeriesApiUrl = `${sonarrApiUrl}/api/v3/series`;
const sonarrQueueApiUrl = `${sonarrApiUrl}/api/v3/queue`;

export const checkSonarrLibrary = async (tvShows) => {
  if (!sonarrApiUrl || !sonarrApiKey) {
    console.warn('Sonarr URL or API key is not configured.');
    return tvShows.map(s => ({ ...s, in_library: false, downloading: false, error: '' }));
  }

  try {
    const response = await fetch(`${sonarrSeriesApiUrl}?apikey=${sonarrApiKey}`);
    const library = await response.json();

    return tvShows.map(s => ({
      ...s,
      in_library: library.some(l => l.tvdbId === s.id),
      downloading: false,
      error: ''
    }));
  } catch (error) {
    console.error('Error checking Sonarr library:', error);
    throw error;
  }
};

export const sendToSonarr = async (tvShow) => {
  if (!sonarrApiUrl || !sonarrApiKey) {
    console.error('Sonarr URL or API key is not configured.');
    throw new Error('Sonarr not configured');
  }

  // This is a guess based on Sonarr's API documentation
  // You may need to adjust the qualityProfileId and rootFolderPath
  const options = {
    tvdbId: tvShow.id,
    title: tvShow.original_title,
    qualityProfileId: 1, // Adjust as needed
    rootFolderPath: 'V:/TV Shows/', // Adjust as needed
    addOptions: { searchForMissingEpisodes: true }
  };

  try {
    await fetch(`${sonarrSeriesApiUrl}?apikey=${sonarrApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });
  } catch (error) {
    console.error('Error sending to Sonarr:', error);
    throw error;
  }
};

export const getSonarrQueue = async () => {
  if (!sonarrApiUrl || !sonarrApiKey) {
    console.warn('Sonarr URL or API key is not configured.');
    return [];
  }

  try {
    const response = await fetch(`${sonarrQueueApiUrl}?apikey=${sonarrApiKey}`);
    const queue = await response.json();
    // Sonarr queue response is more complex, this is a simplified placeholder
    return queue.records || []; 
  } catch (error) {
    console.error('Error getting Sonarr queue:', error);
    throw error;
  }
};
