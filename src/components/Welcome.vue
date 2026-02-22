<template>
  <div class="h-screen flex items-center justify-center bg-gray-900">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-white mb-8">📦 NPM Viewer</h1>
      <p class="text-gray-400 text-xl mb-12">View NPM Package Source Code Online</p>
      <div class="max-w-2xl mx-auto">
        <input v-model="packageName" @keyup.enter="navigate"
          class="w-full px-6 py-4 text-lg rounded-lg bg-gray-800 text-white border-2 border-gray-700 focus:border-blue-500 focus:outline-none"
          placeholder="Enter package name, e.g: vue, lodash...">
        <button @click="navigate"
          class="mt-6 px-8 py-4 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition font-medium">
          View Source
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const packageName = ref('')

function navigate() {
  if (packageName.value.trim()) {
    window.location.href = `?npmpackagename=${encodeURIComponent(packageName.value.trim())}`
  }
}
</script>
