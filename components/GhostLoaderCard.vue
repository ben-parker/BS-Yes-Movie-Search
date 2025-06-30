<template>
  <div class="ghost-card">
    <div class="d-flex">
      <div class="poster-placeholder" />
      <div class="info-placeholder">
        <div class="line-placeholder title" />
        <div class="line-placeholder" />
        <div class="line-placeholder short" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-bg {
  0% { background-color: #e0e0e0; }
  50% { background-color: #d6d6d6; }
  100% { background-color: #e0e0e0; }
}

.ghost-card {
  background-color: #ffffff;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  overflow: hidden;
  padding: 1rem;
}

.d-flex {
  display: flex;
  gap: 1rem;
}

.poster-placeholder {
  width: 120px;
  height: 180px;
  flex-shrink: 0;
  border-radius: 4px;
  animation: pulse-bg 1.5s infinite;
}

.info-placeholder {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
}

.line-placeholder {
  height: 1rem;
  border-radius: 4px;
  animation: pulse-bg 1.5s infinite;
}

.line-placeholder.title {
  height: 1.5rem;
  width: 60%;
}

.line-placeholder.short {
  width: 80%;
}
</style>
