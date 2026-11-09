<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <h3 class="modal-title">Select Seasons for {{ item.title }}</h3>
      
      <p v-if="status === 'idle' || status === 'pending'" class="season-message" role="status">Loading seasons…</p>
      <div v-else-if="status === 'error'" class="season-message">
        <p role="alert">Couldn’t load seasons.</p>
        <button type="button" class="btn btn-secondary" @click="refresh()">Retry</button>
      </div>
      <p v-else-if="!localSelectedSeasons.length" class="season-message">No seasons listed.</p>
      <div v-else class="season-list">
        <div v-for="season in localSelectedSeasons" :key="season.number" class="season-item">
          <input
            type="checkbox"
            :id="`season-${season.number}`"
            v-model="season.selected"
          >
          <label :for="`season-${season.number}`">{{ season.name }}</label>
        </div>
      </div>

      <div class="modal-actions">
        <div v-if="status === 'success' && localSelectedSeasons.length" class="selection-tools">
          <a href="#" @click.prevent="selectAll">Select All</a>
          <span class="separator">|</span>
          <a href="#" @click.prevent="selectNone">Select None</a>
        </div>
        <div class="buttons">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="status !== 'success'" @click="submit">Download</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'submit']);
const localSelectedSeasons = ref([]);
const { data: seasons, status, refresh, clear } = useFetch(() => `/api/tv-seasons/${props.item.id}`, {
  server: false,
  retry: 0,
  timeout: 8000,
});

watch(seasons, (numbers) => {
  localSelectedSeasons.value = (numbers ?? []).map(number => ({
    number,
    name: `Season ${number}`,
    selected: number === 1,
  }));
}, { immediate: true });

onUnmounted(clear);

const selectAll = () => {
  localSelectedSeasons.value.forEach(s => s.selected = true);
};

const selectNone = () => {
  localSelectedSeasons.value.forEach(s => s.selected = false);
};

const submit = () => {
  const selectedNumbers = localSelectedSeasons.value
    .filter(s => s.selected)
    .map(s => s.number);
  emit('submit', selectedNumbers);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.modal-title {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.25rem;
  font-weight: 500;
}

.season-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.season-message {
  margin: 0 0 1.25rem;
}

.season-item {
  display: flex;
  align-items: center;
}

.season-item input {
  margin-right: 0.5rem;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selection-tools a {
  font-size: 0.875rem;
  color: #1976D2;
  text-decoration: none;
}

.selection-tools .separator {
  margin: 0 0.5rem;
  color: #bdbdbd;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  text-transform: uppercase;
}

.btn-primary {
  background-color: #1976D2;
  color: #ffffff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-secondary {
  background-color: #e0e0e0;
  color: #212121;
}
</style>
