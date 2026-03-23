import JSZip from 'jszip'

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'dir'
}

export interface PackageDownloadProgress {
  stage: 'fetch' | 'compress'
  completed: number
  total: number
  currentFile: string
  percent?: number
}

interface JsDelivrFile {
  type: 'file' | 'directory'
  name: string
  files?: JsDelivrFile[]
}

interface PackageMetaResponse {
  tags?: {
    latest?: string
  }
  versions?: Array<string | { version?: string }>
}

interface CachedFileEntry {
  buffer: ArrayBuffer
  text?: string
}

const MAX_FILE_CACHE_ENTRIES = 15
const versionCache = new Map<string, string>()
const fileCache = new Map<string, CachedFileEntry>()

export async function fetchPackageFiles(packageName: string): Promise<FileItem[]> {
  const version = await ensurePackageVersion(packageName)
  const filesRes = await fetch(`https://data.jsdelivr.com/v1/packages/npm/${packageName}@${version}`)

  if (!filesRes.ok) {
    throw new Error('Failed to fetch file list')
  }

  const filesData = await filesRes.json()
  return flattenFiles(filesData.files || [], '')
}

export async function fetchFileContent(packageName: string, filePath: string): Promise<string> {
  const version = await ensurePackageVersion(packageName)
  const normalizedPath = normalizePath(filePath)
  const cacheKey = `${packageName}@${version}${normalizedPath}`

  const cachedEntry = getCachedFile(cacheKey)
  if (cachedEntry?.text !== undefined) {
    return cachedEntry.text
  }

  if (cachedEntry) {
    const text = decodeText(cachedEntry.buffer)
    setCachedFile(cacheKey, {
      ...cachedEntry,
      text
    })
    return text
  }

  const buffer = await loadFileBuffer(packageName, version, normalizedPath)
  const text = decodeText(buffer)
  setCachedFile(cacheKey, { buffer, text })
  return text
}

export async function downloadPackageZip(
  packageName: string,
  files: FileItem[],
  onProgress?: (progress: PackageDownloadProgress) => void
): Promise<void> {
  if (files.length === 0) {
    throw new Error('No files to download')
  }

  const version = await ensurePackageVersion(packageName)
  const zip = new JSZip()
  const rootFolder = zip.folder(getArchiveRootName(packageName, version))

  if (!rootFolder) {
    throw new Error('Failed to create zip archive')
  }

  const total = files.length
  let nextIndex = 0
  let completed = 0
  const concurrency = Math.min(6, total)

  const worker = async () => {
    while (nextIndex < total) {
      const currentIndex = nextIndex++
      const file = files[currentIndex]
      onProgress?.({
        stage: 'fetch',
        completed,
        total,
        currentFile: file.path
      })

      const buffer = await fetchFileBuffer(packageName, file.path)
      rootFolder.file(stripLeadingSlash(file.path), buffer)

      completed += 1
      onProgress?.({
        stage: 'fetch',
        completed,
        total,
        currentFile: file.path
      })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    metadata => {
      onProgress?.({
        stage: 'compress',
        completed: total,
        total,
        currentFile: '',
        percent: metadata.percent
      })
    }
  )

  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `${getArchiveRootName(packageName, version)}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}

export function getPackageVersion(packageName: string): string {
  return versionCache.get(packageName) || ''
}

async function ensurePackageVersion(packageName: string): Promise<string> {
  if (versionCache.has(packageName)) {
    return versionCache.get(packageName)!
  }

  const res = await fetch(`https://data.jsdelivr.com/v1/packages/npm/${packageName}`)
  if (!res.ok) {
    throw new Error('Package not found or network error')
  }

  const data = (await res.json()) as PackageMetaResponse
  const fallbackVersion = data.versions?.[0]
  const version =
    data.tags?.latest ||
    (typeof fallbackVersion === 'string' ? fallbackVersion : fallbackVersion?.version)

  if (!version) {
    throw new Error('Failed to get version info')
  }

  versionCache.set(packageName, version)
  return version
}

async function fetchFileBuffer(packageName: string, filePath: string): Promise<ArrayBuffer> {
  const version = await ensurePackageVersion(packageName)
  const normalizedPath = normalizePath(filePath)
  const cacheKey = `${packageName}@${version}${normalizedPath}`

  const cachedEntry = getCachedFile(cacheKey)
  if (cachedEntry) {
    return cachedEntry.buffer.slice(0)
  }

  const buffer = await loadFileBuffer(packageName, version, normalizedPath)
  setCachedFile(cacheKey, { buffer })
  return buffer.slice(0)
}

async function loadFileBuffer(packageName: string, version: string, filePath: string): Promise<ArrayBuffer> {
  const res = await fetch(buildFileUrl(packageName, version, filePath))
  if (!res.ok) {
    throw new Error(`Failed to load file: ${filePath}`)
  }

  return res.arrayBuffer()
}

function buildFileUrl(packageName: string, version: string, filePath: string): string {
  return `https://cdn.jsdelivr.net/npm/${packageName}@${version}${filePath}`
}

function flattenFiles(files: JsDelivrFile[], basePath: string): FileItem[] {
  const result: FileItem[] = []

  for (const file of files) {
    const fullPath = `${basePath}/${file.name}`

    if (file.type === 'file') {
      result.push({
        name: file.name,
        path: fullPath,
        type: 'file'
      })
      continue
    }

    if (file.type === 'directory' && file.files) {
      result.push(...flattenFiles(file.files, fullPath))
    }
  }

  return result.filter(file => !file.path.includes('node_modules'))
}

function normalizePath(filePath: string): string {
  return filePath.startsWith('/') ? filePath : `/${filePath}`
}

function stripLeadingSlash(filePath: string): string {
  return filePath.replace(/^\/+/, '')
}

function getArchiveRootName(packageName: string, version: string): string {
  return `${packageName.replace(/\//g, '-')}-${version}`
}

function getCachedFile(cacheKey: string): CachedFileEntry | undefined {
  const entry = fileCache.get(cacheKey)
  if (!entry) {
    return undefined
  }

  fileCache.delete(cacheKey)
  fileCache.set(cacheKey, entry)
  return entry
}

function setCachedFile(cacheKey: string, entry: CachedFileEntry): void {
  if (fileCache.has(cacheKey)) {
    fileCache.delete(cacheKey)
  }

  fileCache.set(cacheKey, entry)

  while (fileCache.size > MAX_FILE_CACHE_ENTRIES) {
    const oldestKey = fileCache.keys().next().value
    if (!oldestKey) {
      break
    }

    fileCache.delete(oldestKey)
  }
}

function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer)
}
