<template>
  <div class="card">
    <div class="d-flex">
      <div class="poster-container">
        <img
          v-if="item.posterUrl"
          :src="item.posterUrl"
          width="120"
          height="180"
          class="ma-2 rounded"
        >
        <div v-else class="ma-2 rounded missing-poster">
          <span>?</span>
        </div>
      </div>
      <div class="d-flex flex-column flex-grow-1 pa-4">
        <div class="text-h6">{{ title }}</div>
        <div class="text-body-2 mt-2 overview-text">{{ item.overview }}</div>
        <div class="spacer"></div>
        <div class="d-flex align-center mt-4">
          <button
            v-if="item.inLibrary"
            class="btn btn-success"
            disabled
          >
            In Library
          </button>
          <button
            v-else
            :disabled="item.downloading"
            class="btn btn-primary"
            @click="download"
          >
            <span v-if="item.downloading" class="loader"></span>
            <span v-else>Download</span>
          </button>
          <div
            v-if="item.error"
            class="alert alert-error ml-4"
          >
            {{ item.error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  searchType: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['download']);

const title = computed(() => `${props.item.title} (${props.item.year})`);

const download = () => {
  emit('download', props.item);
};
</script>

<style scoped>
.card {
  background-color: #ffffff;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.poster-container {
  width: 120px;
  height: 180px;
  flex-shrink: 0;
  margin: 0.5rem;
}

.missing-poster {
  width: 100%;
  height: 100%;
  background-color: #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 4rem;
  font-weight: bold;
}

.d-flex {
  display: flex;
}

.flex-column {
  flex-direction: column;
}

.flex-grow-1 {
  flex-grow: 1;
}

.align-center {
  align-items: center;
}

.ma-2 {
  margin: 0;
}

.rounded {
  border-radius: 4px;
}

.pa-4 {
  padding: 1rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1rem;
}

.ml-4 {
  margin-left: 1rem;
}

.text-h6 {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.6rem;
  letter-spacing: 0.0125em;
  color: #212121;
}

.text-body-2 {
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.25rem;
  letter-spacing: 0.0178571429em;
  color: #616161;
}

.overview-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spacer {
  flex-grow: 1;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  text-transform: uppercase;
  transition: background-color 0.3s, opacity 0.3s;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-primary {
  background-color: #1976D2;
  color: #ffffff;
}

.btn-primary:not(:disabled):hover {
  background-color: #1565C0;
}

.btn-success {
  background-color: #4CAF50;
  color: #ffffff;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 4px;
}

.alert-error {
  background-color: #D32F2F;
  color: #ffffff;
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1976D2;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
