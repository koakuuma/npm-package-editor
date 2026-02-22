<template>
  <div class="h-screen flex items-center justify-center bg-gray-900">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-white mb-8">📦 NPM Viewer</h1>
      <p class="text-gray-400 text-xl mb-12">在线查看 NPM 包源码</p>
      <div class="max-w-2xl mx-auto">
        <input v-model="packageName" @keyup.enter="navigate"
          class="w-full px-6 py-4 text-lg rounded-lg bg-gray-800 text-white border-2 border-gray-700 focus:border-blue-500 focus:outline-none"
          placeholder="输入包名，如: vue, lodash, koishi-plugin-githubsth">
        <button @click="navigate"
          class="mt-6 px-8 py-4 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition font-medium">
          查看源码
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
