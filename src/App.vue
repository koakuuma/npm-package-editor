<template>
  <Welcome v-if="!packageName" />
  <div v-else class="flex h-screen overflow-hidden bg-[#1e1e1e]">
    <aside class="relative flex flex-col border-r border-[#3e3e42] bg-[#252526]" :style="{ width: `${sidebarWidth}px` }">
      <div ref="packageMenuRef" class="relative border-b border-[#3e3e42] px-2 py-1.5">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-xs text-gray-200 transition hover:bg-[#2a2d2e]"
          :disabled="loading && !files.length"
          @click="togglePackageMenu"
        >
          <span class="truncate font-semibold uppercase tracking-wide">{{ packageName }}</span>
          <span class="flex shrink-0 items-center gap-2 text-[11px] text-gray-400">
            <span
              v-if="downloading"
              class="h-3.5 w-3.5 animate-spin rounded-full border border-[#8cdcfe] border-t-transparent"
            />
            <span v-if="downloadStatusLabel">{{ downloadStatusLabel }}</span>
            <span>{{ packageMenuOpen ? '▴' : '▾' }}</span>
          </span>
        </button>

        <div
          v-if="packageMenuOpen"
          class="absolute left-2 right-2 top-full z-10 mt-1 overflow-hidden rounded border border-[#3e3e42] bg-[#252526] shadow-lg shadow-black/30"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-gray-200 transition hover:bg-[#2a2d2e] disabled:cursor-not-allowed disabled:text-gray-500"
            :disabled="loading || downloading || files.length === 0"
            @click="handleDownloadZip"
          >
            <span>{{ downloading ? 'Preparing ZIP...' : 'Download as ZIP' }}</span>
            <span class="text-[11px] text-gray-400">
              {{ downloading ? downloadMenuLabel : `${files.length} files` }}
            </span>
          </button>
        </div>
      </div>

      <div class="custom-scrollbar flex-1 overflow-auto">
        <div v-if="loading" class="p-4 text-sm text-gray-500">Loading...</div>
        <div v-else-if="error" class="p-4 text-xs text-red-400">{{ error }}</div>
        <FileTree v-else :files="files" :selected="selectedFile" @select="selectFile" />
      </div>

      <div
        class="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#007acc]"
        @mousedown="startResize"
      />
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <div
        v-if="selectedFile"
        class="cursor-pointer border-b border-[#3e3e42] bg-[#1e1e1e] px-4 py-1.5 text-xs text-gray-400 hover:bg-[#2a2d2e]"
        title="Double click to copy URL"
        @dblclick="copyUrl"
      >
        {{ selectedFile }}
      </div>

      <div v-if="isImageFile" class="flex flex-1 items-center justify-center overflow-auto bg-[#1e1e1e]">
        <img :src="imageUrl" :alt="selectedFile" class="max-h-full max-w-full object-contain" />
      </div>

      <div v-else-if="isBinaryFile" class="flex flex-1 items-center justify-center bg-[#1e1e1e]">
        <div class="text-center text-gray-400">
          <div class="mb-4 text-4xl">📦</div>
          <div class="text-sm">Binary file preview is not supported.</div>
          <div class="mt-2 text-xs text-gray-500">{{ selectedFile }}</div>
        </div>
      </div>

      <div v-else ref="editorContainer" class="flex-1 overflow-hidden" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import Welcome from './components/Welcome.vue'
import FileTree from './components/FileTree.vue'
import {
  downloadPackageZip,
  fetchFileContent,
  fetchPackageFiles,
  getPackageVersion,
  type FileItem,
  type PackageDownloadProgress
} from './utils/npm'

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  allowJs: true,
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  target: monaco.languages.typescript.ScriptTarget.ES2020
})

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  allowJs: true,
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  target: monaco.languages.typescript.ScriptTarget.ES2020
})

const packageName = ref('')
const files = ref<FileItem[]>([])
const selectedFile = ref('')
const loading = ref(false)
const error = ref('')
const editorContainer = ref<HTMLElement | null>(null)
const packageMenuRef = ref<HTMLElement | null>(null)
const sidebarWidth = ref(250)
const isImageFile = ref(false)
const isBinaryFile = ref(false)
const imageUrl = ref('')
const packageMenuOpen = ref(false)
const downloading = ref(false)
const downloadProgress = ref<PackageDownloadProgress | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const downloadStatusLabel = computed(() => {
  if (!downloading.value || !downloadProgress.value) {
    return ''
  }

  if (downloadProgress.value.stage === 'fetch') {
    return `${downloadProgress.value.completed}/${downloadProgress.value.total}`
  }

  return `${Math.round(downloadProgress.value.percent || 0)}%`
})

const downloadMenuLabel = computed(() => {
  if (!downloadProgress.value) {
    return ''
  }

  if (downloadProgress.value.stage === 'fetch') {
    return `${downloadProgress.value.completed}/${downloadProgress.value.total}`
  }

  return `Compressing ${Math.round(downloadProgress.value.percent || 0)}%`
})

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)

  const params = new URLSearchParams(window.location.search)
  const pkg = params.get('npmpackagename')

  if (!pkg) {
    return
  }

  packageName.value = pkg
  await nextTick()

  if (!editorContainer.value) {
    return
  }

  editor = monaco.editor.create(editorContainer.value, {
    value: '',
    language: 'javascript',
    theme: 'vs-dark',
    readOnly: true,
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: true },
    wordWrap: 'off',
    scrollBeyondLastLine: false
  })

  await loadPackage()
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  editor?.dispose()
})

async function loadPackage() {
  loading.value = true
  error.value = ''
  files.value = []
  packageMenuOpen.value = false

  try {
    files.value = await fetchPackageFiles(packageName.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function selectFile(path: string) {
  selectedFile.value = path
  const ext = path.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  if (imageExts.includes(ext)) {
    isImageFile.value = true
    isBinaryFile.value = false
    const version = getPackageVersion(packageName.value)
    imageUrl.value = `https://cdn.jsdelivr.net/npm/${packageName.value}@${version}${path}`
    return
  }

  const binaryExts = ['ttf', 'otf', 'woff', 'woff2', 'eot', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib']
  if (binaryExts.includes(ext)) {
    isImageFile.value = false
    isBinaryFile.value = true
    return
  }

  isImageFile.value = false
  isBinaryFile.value = false
  if (!editor) {
    return
  }

  editor.setValue('')

  try {
    const content = await fetchFileContent(packageName.value, path)
    const language = getLanguage(path)
    editor.setValue(content)
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, language)
    }
  } catch (e) {
    editor.setValue(`// Failed to load file: ${(e as Error).message}`)
  }
}

async function handleDownloadZip() {
  packageMenuOpen.value = false
  downloading.value = true
  downloadProgress.value = {
    stage: 'fetch',
    completed: 0,
    total: files.value.length,
    currentFile: ''
  }

  try {
    await downloadPackageZip(packageName.value, files.value, progress => {
      downloadProgress.value = progress
    })
  } catch (e) {
    error.value = `Failed to download ZIP: ${(e as Error).message}`
  } finally {
    downloading.value = false
    downloadProgress.value = null
  }
}

function togglePackageMenu() {
  if (loading.value && !files.value.length) {
    return
  }

  packageMenuOpen.value = !packageMenuOpen.value
}

function handleDocumentClick(event: MouseEvent) {
  if (!packageMenuRef.value) {
    return
  }

  const target = event.target
  if (target instanceof Node && !packageMenuRef.value.contains(target)) {
    packageMenuOpen.value = false
  }
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    vue: 'html',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    yml: 'yaml',
    yaml: 'yaml'
  }
  return map[ext] || 'plaintext'
}

function copyUrl() {
  const version = getPackageVersion(packageName.value)
  const url = `https://cdn.jsdelivr.net/npm/${packageName.value}@${version}${selectedFile.value}`
  navigator.clipboard.writeText(url)
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMouseMove = (moveEvent: MouseEvent) => {
    const newWidth = startWidth + (moveEvent.clientX - startX)
    sidebarWidth.value = Math.max(150, Math.min(600, newWidth))
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>
