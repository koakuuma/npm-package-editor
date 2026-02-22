<template>
  <div class="text-sm text-[#cccccc]">
    <TreeNode v-for="node in tree" :key="node.path" :node="node" :selected="selected"
      @select="$emit('select', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TreeNode from './TreeNode.vue'

interface FileItem {
  name: string
  path: string
  type: 'file' | 'dir'
}

interface TreeNodeData {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: TreeNodeData[]
}

const props = defineProps<{
  files: FileItem[]
  selected: string
}>()

defineEmits(['select'])

const tree = computed(() => {
  const root: TreeNodeData[] = []

  for (const file of props.files) {
    const parts = file.path.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const fullPath = '/' + parts.slice(0, i + 1).join('/')

      let node = current.find(n => n.name === part)

      if (!node) {
        node = {
          name: part,
          path: fullPath,
          type: isLast ? 'file' : 'dir',
          children: isLast ? undefined : []
        }
        current.push(node)
      }

      if (!isLast && node.children) {
        current = node.children
      }
    }
  }

  return root
})
</script>
