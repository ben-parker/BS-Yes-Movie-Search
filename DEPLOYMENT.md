# Deploying to Docker

This document provides instructions for building and running the application using Docker.

## 1. Create a `.env` file

Create a `.env` file in the root of the project with the following content:

```
VUE_APP_RADARR_API_KEY=your_radarr_api_key
VUE_APP_RADARR_URL=http://your_radarr_ip:7878
VUE_APP_RADARR_ROOT_FOLDER_PATH=/path/to/your/radarr/root/folder
VUE_APP_RADARR_QUALITY_PROFILE_ID=1
VUE_APP_SONARR_API_KEY=your_sonarr_api_key
VUE_APP_SONARR_URL=http://your_sonarr_ip:8989
VUE_APP_SONARR_ROOT_FOLDER_PATH=/path/to/your/sonarr/root/folder
VUE_APP_SONARR_QUALITY_PROFILE_ID=1
VUE_APP_MOVIEDB_API_KEY=your_moviedb_api_key
VUE_APP_TVDB_API_KEY=your_tvdb_api_key
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
-   **WebUI:** http://[YOUR_UNRAID_IP]:3000

Add the following environment variables:

-   `VUE_APP_RADARR_API_KEY`
-   `VUE_APP_RADARR_URL`
-   `VUE_APP_RADARR_ROOT_FOLDER_PATH`
-   `VUE_APP_RADARR_QUALITY_PROFILE_ID`
-   `VUE_APP_SONARR_API_KEY`
-   `VUE_APP_SONARR_URL`
-   `VUE_APP_SONARR_ROOT_FOLDER_PATH`
-   `VUE_APP_SONARR_QUALITY_PROFILE_ID`
-   `VUE_APP_MOVIEDB_API_KEY`
-   `VUE_APP_TVDB_API_KEY`
-   `VUE_APP_TVDB_PIN`

Click "Apply" to start the container.
