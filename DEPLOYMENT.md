# Deploying to Docker

This document provides instructions for building and running the application using Docker.

## 1. Create a `.env` file

For local development, create a `.env` file in the project root with the settings below. For Docker, provide these variables when starting the container.

```
NUXT_RADARR_API_KEY=your_radarr_api_key
NUXT_RADARR_URL=http://your_radarr_ip:7878
NUXT_RADARR_ROOT_FOLDER_PATH=/path/to/your/radarr/root/folder
NUXT_RADARR_QUALITY_PROFILE_ID=1
NUXT_SONARR_API_KEY=your_sonarr_api_key
NUXT_SONARR_URL=http://your_sonarr_ip:8989
NUXT_SONARR_ROOT_FOLDER_PATH=/path/to/your/sonarr/root/folder
NUXT_SONARR_QUALITY_PROFILE_ID=1
NUXT_TMDB_API_KEY=your_moviedb_api_key
NUXT_THETVDB_API_KEY=your_tvdb_api_key
```

## 2. Build the Docker image

Open a terminal and run the following command to build the Docker image:

```
docker build -t your-dockerhub-username/bs-yes-movie-search .
```

## 3. Push the Docker image to Docker Hub

Push the image to Docker Hub with the following command:

```
docker push your-dockerhub-username/bs-yes-movie-search
```

## 4. Run the Docker container on Unraid

On your Unraid server, go to the "Docker" tab and click "Add Container". Fill in the following information:

-   **Name:** bs-yes-movie-search
-   **Repository:** your-dockerhub-username/bs-yes-movie-search
-   **Network Type:** Bridge
-   **Port:** map container port `3000` to the host port you want to use.

In **Advanced View**, set **WebUI** to `http://[IP]:[PORT:3000]/`. Unraid uses the
mapped host port when you select **WebUI** from the container's menu. For **Icon
URL**, use the app's PNG at `http://YOUR_UNRAID_IP:YOUR_HOST_PORT/images/app-icon.png`.
For an existing container, update the image and start it before setting the icon
URL so Unraid can retrieve the PNG.

Add the following environment variables:

-   `NUXT_RADARR_API_KEY`
-   `NUXT_RADARR_URL`
-   `NUXT_RADARR_ROOT_FOLDER_PATH`
-   `NUXT_RADARR_QUALITY_PROFILE_ID`
-   `NUXT_SONARR_API_KEY`
-   `NUXT_SONARR_URL`
-   `NUXT_SONARR_ROOT_FOLDER_PATH`
-   `NUXT_SONARR_QUALITY_PROFILE_ID`
-   `NUXT_TMDB_API_KEY`
-   `NUXT_THETVDB_API_KEY`

Click "Apply" to start the container.
