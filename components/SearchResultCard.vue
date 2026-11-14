<template>
  <article class="card">
    <img
      v-if="item.posterUrl"
      :src="item.posterUrl"
      alt=""
      width="120"
      height="180"
      loading="lazy"
      decoding="async"
      class="poster"
    >
    <div v-else class="poster missing-poster" aria-hidden="true">?</div>

    <div class="card-content">
      <h2 class="title">{{ item.title }}</h2>
      <div class="metadata">
        <span class="release-year">{{ item.year || 'Year unknown' }}</span>
        <span v-if="item.language || item.studio" class="metadata-label">{{ item.language || item.studio }}</span>
      </div>
      <p v-if="item.overview" class="overview">{{ item.overview }}</p>

      <div class="actions" aria-live="polite">
        <span v-if="downloadState === 'inLibrary'" class="library-status">In Library</span>
        <button v-else type="button" class="download-button" :disabled="downloadPending" @click="download">
          {{ downloadLabel }}
        </button>
        <span v-if="downloadState === 'stalled'" class="download-error">No download found.</span>
        <span v-if="item.error" class="download-error" role="alert">{{ item.error }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  downloadState: { type: String, required: true },
});

const labels = { queued: 'Queued', downloading: 'Downloading', stalled: 'Retry search' };
const downloadLabel = computed(() => labels[props.downloadState] ?? 'Download');
const downloadPending = computed(() => ['queued', 'downloading'].includes(props.downloadState));

const emit = defineEmits(['download']);

const download = () => {
  emit('download', props.item);
};
</script>

<style scoped>
.card {
  display: grid;
  grid-template-columns: var(--result-poster-width, 120px) minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: #fff;
}

.poster {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 3;
  border-radius: 6px;
  object-fit: cover;
}

.missing-poster {
  display: grid;
  place-items: center;
  background: #eee;
  color: #777;
  font-size: 1.5rem;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  overflow-wrap: anywhere;
}

.title {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.25;
}

.metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

.release-year,
.metadata-label {
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  background: #e9eef4;
  color: #26394e;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}

.metadata-label {
  background: #f1f1f1;
  color: #424242;
  font-weight: 600;
}

.overview {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0.5rem 0 0;
  color: #555;
  font-size: 0.875rem;
  line-height: 1.4;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.625rem;
}

.download-button,
.library-status {
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

.download-button {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 0;
  background: #1458a6;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
}

.download-button:focus-visible {
  outline: 2px solid #1458a6;
  outline-offset: 2px;
}

.download-button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.library-status {
  padding: 0.375rem 0.625rem;
  background: #e8f3e9;
  color: #22552b;
}

.download-error {
  color: #9b2318;
  font-size: 0.875rem;
}
</style>
