<template>
  <section aria-label="Downloads">
    <ul v-if="queue.length" class="download-list">
      <li v-for="item in queue" :key="item.id" class="download-card">
        <h2 class="download-title">{{ item.title }}</h2>
        <p v-if="item.status" class="download-status">{{ formatStatus(item.status) }}</p>
        <template v-if="item.status?.toLowerCase() === 'downloading'">
          <div class="progress-track" aria-hidden="true">
            <div class="progress-bar" :style="{ width: item.progress + '%' }" />
          </div>
          <p class="download-progress">
            {{ item.progress.toFixed(1) }}%<span v-if="item.timeleft"> · {{ item.timeleft }} remaining</span>
          </p>
        </template>
      </li>
    </ul>
    <p v-else class="empty-queue">No active downloads.</p>
  </section>
</template>

<script setup>
defineProps({
  queue: {
    type: Array,
    required: true,
  },
});

const formatStatus = (status) => {
  const normalized = status.toLowerCase();
  if (normalized === 'delay') return 'Pending';
  if (normalized === 'downloadclientunavailable') return 'Pending · Download client unavailable';

  const label = status.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
};
</script>

<style scoped>
.download-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.download-card {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
}

.download-title {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.download-status {
  display: inline-block;
  margin: 0.375rem 0 0;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: #f1f1f1;
  color: #424242;
  font-size: 0.875rem;
  font-weight: 600;
}

.progress-track {
  height: 8px;
  margin-top: 0.75rem;
  overflow: hidden;
  border-radius: 4px;
  background: #e0e0e0;
}

.progress-bar {
  height: 100%;
  background: #b8351b;
  transition: width 0.2s ease-in-out;
}

.download-progress {
  margin: 0.375rem 0 0;
  color: #555;
  font-size: 0.875rem;
}

.empty-queue {
  margin: 0;
  padding: 1.5rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: #fafafa;
  text-align: center;
}
</style>
