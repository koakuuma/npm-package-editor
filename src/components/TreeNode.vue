<template>
  <div>
    <div @click="handleClick" :class="[
      'px-1 py-0.5 cursor-pointer flex items-center gap-1 hover:bg-[#2a2d2e]',
      selected === node.path ? 'bg-[#37373d]' : ''
    ]" :style="{ paddingLeft: `${depth * 12 + 4}px` }">
      <span v-if="node.type === 'dir'" class="text-[9px] text-gray-400 w-3">{{ expanded ? '▼' : '▶' }}</span>
      <span v-else class="w-3"></span>
      <span :class="['text-[10px]', getFileColor(node.name)]">●</span>
      <span :class="selected === node.path ? 'text-white' : 'text-[#cccccc]'" class="text-[13px] leading-tight">
        {{ node.name }}
      </span>
    </div>

    <div v-if="node.type === 'dir' && expanded && node.children">
      <TreeNode v-for="child in node.children" :key="child.path" :node="child" :selected="selected" :depth="depth + 1"
        @select="$emit('select', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface TreeNodeData {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: TreeNodeData[]
}

const props = withDefaults(defineProps<{
  node: TreeNodeData
  selected: string
  depth?: number
}>(), {
  depth: 0
})

const emit = defineEmits(['select'])

const expanded = ref(true)

function handleClick() {
  if (props.node.type === 'dir') {
    expanded.value = !expanded.value
  } else {
    emit('select', props.node.path)
  }
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const colors: Record<string, string> = {
    js: 'text-yellow-400',
    ts: 'text-blue-400',
    json: 'text-yellow-300',
    vue: 'text-green-400',
    html: 'text-orange-400',
    css: 'text-blue-300',
    scss: 'text-pink-400',
    md: 'text-blue-200',
    py: 'text-blue-500',
    java: 'text-red-400',
    go: 'text-cyan-400',
    rs: 'text-orange-500'
  }
  if (props.node.type === 'dir') return 'text-yellow-600'
  return colors[ext || ''] || 'text-gray-400'
}
</script>
