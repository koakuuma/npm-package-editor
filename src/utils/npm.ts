interface FileItem {
  name: string
  path: string
  type: 'file' | 'dir'
}

interface JsDelivrFile {
  type: 'file' | 'directory'
  name: string
  files?: JsDelivrFile[]
}

let cachedVersion = ''
const fileCache = new Map<string, string>()

export async function fetchPackageFiles(packageName: string): Promise<FileItem[]> {
  const res = await fetch(`https://data.jsdelivr.com/v1/packages/npm/${packageName}`)
  if (!res.ok) throw new Error('包不存在或网络错误')

  const data = await res.json()
  cachedVersion = data.tags?.latest || data.versions?.[0]?.version
  if (!cachedVersion) throw new Error('无法获取版本信息')

  const filesRes = await fetch(`https://data.jsdelivr.com/v1/packages/npm/${packageName}@${cachedVersion}`)
  if (!filesRes.ok) throw new Error('获取文件列表失败')

  const filesData = await filesRes.json()
  return flattenFiles(filesData.files || [], '')
}

function flattenFiles(files: JsDelivrFile[], basePath: string): FileItem[] {
  const result: FileItem[] = []

  for (const file of files) {
    const fullPath = basePath + '/' + file.name

    if (file.type === 'file') {
      result.push({
        name: file.name,
        path: fullPath,
        type: 'file'
      })
    } else if (file.type === 'directory' && file.files) {
      result.push(...flattenFiles(file.files, fullPath))
    }
  }

  return result.filter(f => !f.path.includes('node_modules'))
}

export async function fetchFileContent(packageName: string, filePath: string): Promise<string> {
  const cacheKey = `${packageName}@${cachedVersion}${filePath}`

  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey)!
  }

  const url = `https://cdn.jsdelivr.net/npm/${packageName}@${cachedVersion}${filePath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('文件加载失败')
  const content = await res.text()
  fileCache.set(cacheKey, content)
  return content
}

export function getPackageVersion(): string {
  return cachedVersion
}
