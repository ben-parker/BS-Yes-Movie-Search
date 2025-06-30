<template>
  <div v-if="queue.length > 0" class="mb-4">
    <h2 class="text-h5">Currently Downloading</h2>
    <ul class="list">
      <li
        v-for="item in displayedItems"
        :key="item.downloadId"
        class="list-item"
      >
        <div class="list-item-content">
          <div class="list-item-title">{{ item.title }}</div>
          <div v-if="item.isQueued" class="list-item-subtitle">
            Queued
          </div>
          <div v-else>
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: item.progress + '%' }"></div>
            </div>
            <div class="list-item-subtitle">
              {{ item.progress.toFixed(1) }}% - {{ item.timeleft }} remaining
            </div>
          </div>
        </div>
      </li>
    </ul>
    <div v-if="queue.length > 3" class="toggle-link-wrapper">
      <a href="#" @click.prevent="isExpanded = !isExpanded">
        {{ isExpanded ? 'Show less' : `and ${queue.length - 3} more...` }}
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  queue: {
    type: Array,
    required: true
  }
});

const isExpanded = ref(false);

const displayedItems = computed(() => {
  if (isExpanded.value) {
    return props.queue;
  }
  return props.queue.slice(0, 3);
});
</script>

<style scoped>
.mb-4 {
  margin-bottom: 1rem;
}

.text-h5 {
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 2rem;
  letter-spacing: 0;
  color: #424242;
}

.list {
  list-style: none;
  padding: 0;
}

.list-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #E0E0E0;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item-title {
  font-weight: 500;
  color: #212121;
  margin-bottom: 0.5rem;
}

.list-item-subtitle {
  color: #757575;
  font-size: 0.875rem;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-bar {
  height: 100%;
  background-color: #d43e20; /* Burnt Orange */
  border-radius: 4px;
  transition: width 0.2s ease-in-out;
}

.toggle-link-wrapper {
  text-align: center;
  margin-top: 0.5rem;
}

.toggle-link-wrapper a {
  font-size: 0.875rem;
  color: #1976D2;
  text-decoration: none;
}
</style>

