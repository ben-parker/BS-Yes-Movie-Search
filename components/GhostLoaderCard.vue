<template>
  <div class="ghost-card">
    <div class="poster-placeholder" />
    <div class="info-placeholder">
      <div class="line-placeholder title" />
      <div class="line-placeholder year" />
      <div class="line-placeholder" />
      <div class="line-placeholder short" />
    </div>
  </div>
</template>

<style scoped>
.ghost-card {
  display: grid;
  grid-template-columns: var(--result-poster-width, 120px) minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
}

.poster-placeholder,
.line-placeholder {
  border-radius: 6px;
  background: #ebedf0;
  animation: pulse 1.5s ease-in-out infinite;
}

.poster-placeholder {
  aspect-ratio: 2 / 3;
}

.info-placeholder {
  display: grid;
  align-content: start;
  gap: 0.5rem;
}

.line-placeholder {
  height: 0.75rem;
}

.line-placeholder.title {
  width: 68%;
  height: 1.125rem;
}

.line-placeholder.year {
  width: 3rem;
  height: 1.375rem;
  margin-bottom: 0.125rem;
}

.line-placeholder.short {
  width: 78%;
}

@keyframes pulse {
  50% { opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
  .poster-placeholder,
  .line-placeholder {
    animation: none;
  }
}
</style>
