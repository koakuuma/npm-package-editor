<template>
  <Welcome v-if="!packageName" />
  <div v-else class="h-screen flex bg-[#1e1e1e]">
    <aside class="w-64 bg-[#252526] border-r border-[#3e3e42] flex flex-col">
      <div class="px-3 py-2 text-xs text-gray-300 border-b border-[#3e3e42] font-semibold">
        {{ packageName }}
      </div>
      <div class="flex-1 overflow-auto custom-scrollbar">
        <div v-if="loading" class="p-4 text-gray-500 text-sm">加载中...</div>
        <div v-else-if="error" class="p-4 text-red-400 text-xs">{{ error }}</div>
        <FileTree v-else :files="files" @select="selectFile" :selected="selectedFile" />
      </div>
    </aside>

    <main class="flex-1 flex flex-col">
      <div v-if="selectedFile"
        class="px-4 py-2 bg-[#1e1e1e] text-gray-400 text-sm border-b border-[#3e3e42] cursor-pointer hover:bg-[#2a2d2e]"
        @dblclick="copyUrl" title="双击复制URL">
        {{ selectedFile }}
      </div>
      <div ref="editorContainer" class="flex-1"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import Welcome from './components/Welcome.vue'
import FileTree from './components/FileTree.vue'
import { fetchPackageFiles, fetchFileContent, getPackageVersion } from './utils/npm'

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

interface FileItem {
  name: string
  path: string
  type: 'file' | 'dir'
}

const packageName = ref('')
const files = ref<FileItem[]>([])
const selectedFile = ref('')
const loading = ref(false)
const error = ref('')
const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const pkg = params.get('npmpackagename')

  if (pkg) {
    packageName.value = pkg
    await nextTick()

    if (editorContainer.value) {
      editor = monaco.editor.create(editorContainer.value, {
        value: '// 加载中...',
        language: 'javascript',
        theme: 'vs-dark',
        readOnly: true,
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: true },
        wordWrap: 'off',
        scrollBeyondLastLine: true,
        scrollbar: {
          horizontal: 'visible',
          vertical: 'visible',
          horizontalScrollbarSize: 10,
          verticalScrollbarSize: 10
        }
      })

      loadPackage()
    }
  }
})

onUnmounted(() => {
  editor?.dispose()
})

async function loadPackage() {
  loading.value = true
  error.value = ''

  try {
    files.value = await fetchPackageFiles(packageName.value)
    if (files.value.length > 0) {
      selectFile(files.value[0].path)
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function selectFile(path: string) {
  selectedFile.value = path
  if (!editor) return

  try {
    const content = await fetchFileContent(packageName.value, path)
    const ext = path.split('.').pop() || ''
    const language = getLanguage(ext)
    editor.setValue(content)
    const model = editor.getModel()
    if (model) monaco.editor.setModelLanguage(model, language)
  } catch (e) {
    editor.setValue(`// 无法加载文件: ${(e as Error).message}`)
  }
}

function getLanguage(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript', ts: 'typescript', json: 'json',
    vue: 'html', html: 'html', css: 'css', scss: 'scss',
    md: 'markdown', py: 'python', java: 'java',
    go: 'go', rs: 'rust', yml: 'yaml', yaml: 'yaml'
  }
  return map[ext] || 'plaintext'
}

function copyUrl() {
  const version = getPackageVersion()
  const url = `https://cdn.jsdelivr.net/npm/${packageName.value}@${version}${selectedFile.value}`
  navigator.clipboard.writeText(url)
}
</script>
