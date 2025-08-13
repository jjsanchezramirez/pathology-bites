// src/features/debug/components/r2-file-browser.tsx
/**
 * R2 File Browser Debug Component
 * Provides file browsing capabilities with download functionality
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'

import {
  FolderOpen,
  File,
  Download,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Image,
  Archive,
  Video,
  Music,
  Code,
  Database,
  ImageIcon,
  HardDrive,
  BookOpen
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'
import { R2FileListResponse, R2FileListParams } from '@/shared/types/r2-api'

interface R2FileBrowserProps {
  className?: string
  defaultBucket?: string
}

interface DirectoryItem {
  name: string
  path: string
  type: 'directory'
  fileCount?: number
  key: string
  lastModified: string
}

interface FileItem {
  name: string
  key: string
  url: string
  size: number
  lastModified: string
  contentType: string
  type: 'file'
}

type BrowserItem = DirectoryItem | FileItem

// Available R2 buckets
const R2_BUCKETS = [
  {
    name: 'pathology-bites-images',
    label: 'Images Bucket',
    icon: ImageIcon,
    description: 'Medical images, microscopic slides, visual content, and Anki media (Public)',
    commonFolders: ['anki/', 'microscopic/', 'slides/', 'diagrams/']
  },
  {
    name: 'pathology-bites-data',
    label: 'Data Bucket',
    icon: Database,
    description: 'JSON files, datasets, and structured data (Private)',
    commonFolders: ['datasets/', 'configs/', 'exports/', 'backups/']
  }
] as const

export function R2FileBrowser({ className, defaultBucket = 'pathology-bites-images' }: R2FileBrowserProps) {
  const [files, setFiles] = useState<R2FileListResponse | null>(null)
  const [items, setItems] = useState<BrowserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [prefix, setPrefix] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'lastModified'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedBucket, setSelectedBucket] = useState(defaultBucket)

  // Get current bucket info
  const currentBucket = R2_BUCKETS.find(bucket => bucket.name === selectedBucket)

  // Process files into directories and files
  const processFilesIntoItems = useCallback((files: any[], currentPrefix: string): BrowserItem[] => {
    const directories = new Map<string, { name: string; files: any[]; lastModified: string }>()
    const currentLevelFiles: any[] = []

    files.forEach(file => {
      // Handle root level (no prefix) vs prefixed paths
      let relativePath: string
      if (currentPrefix === '' || currentPrefix === '/') {
        relativePath = file.key
      } else {
        // Only process files that start with our current prefix
        if (!file.key.startsWith(currentPrefix)) {
          return
        }
        relativePath = file.key.substring(currentPrefix.length)
      }
      
      // Skip empty paths
      if (!relativePath) return

      const pathParts = relativePath.split('/').filter(Boolean)
      
      if (pathParts.length === 1 && !file.key.endsWith('/')) {
        // File at current level (not a directory marker)
        currentLevelFiles.push(file)
      } else if (pathParts.length > 1 || file.key.endsWith('/')) {
        // File in subdirectory or directory marker
        const dirName = pathParts[0]
        if (dirName && !directories.has(dirName)) {
          directories.set(dirName, { 
            name: dirName, 
            files: [], 
            lastModified: file.lastModified 
          })
        }
        if (dirName) {
          const dirData = directories.get(dirName)!
          if (!file.key.endsWith('/')) {
            // Only count actual files, not directory markers
            dirData.files.push(file)
          }
          // Use the most recent file's modification date for the directory
          if (new Date(file.lastModified) > new Date(dirData.lastModified)) {
            dirData.lastModified = file.lastModified
          }
        }
      }
    })

    // Create directory items
    const directoryItems: DirectoryItem[] = Array.from(directories.entries()).map(([name, data]) => ({
      name,
      path: currentPrefix + name + '/',
      type: 'directory' as const,
      fileCount: data.files.length,
      key: currentPrefix + name + '/',
      lastModified: data.lastModified
    }))

    // Create file items
    const fileItems: FileItem[] = currentLevelFiles.map(file => ({
      name: file.key.split('/').pop() || file.key,
      key: file.key,
      url: file.url,
      size: file.size,
      lastModified: file.lastModified,
      contentType: file.contentType || '',
      type: 'file' as const
    }))

    // Sort directories alphabetically, then files alphabetically
    directoryItems.sort((a, b) => a.name.localeCompare(b.name))
    fileItems.sort((a, b) => a.name.localeCompare(b.name))

    return [...directoryItems, ...fileItems]
  }, [])

  // Helper functions for folder navigation
  const navigateToFolder = useCallback((folderPath: string) => {
    setPrefix(folderPath)
    setCurrentPage(1)
    fetchFiles({ page: 1, prefix: folderPath })
  }, [])

  const navigateUp = useCallback(() => {
    if (!prefix) return
    const parts = prefix.split('/').filter(Boolean)
    parts.pop() // Remove last folder
    const newPrefix = parts.length > 0 ? parts.join('/') + '/' : ''
    navigateToFolder(newPrefix)
  }, [prefix, navigateToFolder])

  const getBreadcrumbs = useCallback(() => {
    if (!prefix) return []
    const parts = prefix.split('/').filter(Boolean)
    return parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/') + '/'
    }))
  }, [prefix])

  // Helper to detect if a file key represents a folder
  const isFolder = useCallback((key: string) => {
    return key.endsWith('/')
  }, [])

  // Helper to get folder name from file key
  const getFolderFromKey = useCallback((key: string) => {
    if (!prefix) return key.split('/')[0] + '/'
    const relativePath = key.replace(prefix, '')
    return relativePath.split('/')[0] + '/'
  }, [prefix])

  const fetchFiles = useCallback(async (params: Partial<R2FileListParams> = {}) => {
    setLoading(true)
    
    try {
      const currentPrefix = params.prefix !== undefined ? params.prefix : prefix
      
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '2000',
        sortBy: params.sortBy || sortBy,
        sortOrder: params.sortOrder || sortOrder,
        bucket: selectedBucket,
        ...(currentPrefix ? { prefix: currentPrefix } : {}),
        ...(params.search !== undefined ? { search: params.search } : searchQuery ? { search: searchQuery } : {})
      })

      const response = await fetch(`/api/r2/files?${queryParams}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setFiles(data)
      
      // Process files into directory structure
      const processedItems = processFilesIntoItems(data.files, currentPrefix)
      setItems(processedItems)
      
      const bucketInfo = R2_BUCKETS.find(b => b.name === selectedBucket)
      const directoryCount = processedItems.filter(item => item.type === 'directory').length
      const fileCount = processedItems.filter(item => item.type === 'file').length

      toast.success(`Found ${directoryCount} directories and ${fileCount} files from ${bucketInfo?.label || selectedBucket}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch files'
      toast.error(errorMessage)
      console.error('R2 fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, []) // Empty dependencies to prevent infinite loops

  const downloadAllUrls = useCallback(async () => {
    if (!files) return

    try {
      // Get all files across all pages
      const allFiles = []
      let page = 1
      let hasMore = true

      toast.loading('Collecting all file URLs...', { id: 'download-urls' })

      while (hasMore) {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: '1000', // Use maximum page size for bulk operations
          sortBy,
          sortOrder,
          bucket: selectedBucket,
          ...(prefix ? { prefix } : {}),
          ...(searchQuery ? { search: searchQuery } : {})
        })

        const response = await fetch(`/api/r2/files?${queryParams}`)
        if (!response.ok) break

        const data: R2FileListResponse = await response.json()
        allFiles.push(...data.files)
        hasMore = data.pagination.hasNextPage
        page++
      }

      // Create download data
      const downloadData = {
        metadata: {
          timestamp: new Date().toISOString(),
          totalFiles: allFiles.length,
          bucket: selectedBucket,
          bucketLabel: R2_BUCKETS.find(b => b.name === selectedBucket)?.label || selectedBucket,
          filters: {
            prefix: prefix || null,
            search: searchQuery || null,
            sortBy,
            sortOrder
          }
        },
        files: allFiles.map(file => ({
          key: file.key,
          url: file.url,
          size: file.size,
          lastModified: file.lastModified,
          contentType: file.contentType,
          sizeFormatted: formatFileSize(file.size)
        }))
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(downloadData, null, 2)], { 
        type: 'application/json' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `r2-files-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Downloaded ${allFiles.length} file URLs`, { id: 'download-urls' })
    } catch (error) {
      toast.error('Failed to download file URLs', { id: 'download-urls' })
      console.error('Download error:', error)
    }
  }, [files, prefix, searchQuery, sortBy, sortOrder])

  const handleSearch = useCallback(() => {
    setCurrentPage(1)
    fetchFiles({ page: 1, search: searchQuery })
  }, [searchQuery, fetchFiles])

  const handleSort = useCallback((newSortBy: typeof sortBy) => {
    const newSortOrder = newSortBy === sortBy && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setCurrentPage(1)
    fetchFiles({ page: 1, sortBy: newSortBy, sortOrder: newSortOrder })
  }, [sortBy, sortOrder, fetchFiles])



  const getFileIcon = (contentType: string, fileName: string) => {
    if (contentType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />
    if (contentType.startsWith('video/')) return <Video className="h-4 w-4 text-purple-500" />
    if (contentType.startsWith('audio/')) return <Music className="h-4 w-4 text-green-500" />
    if (contentType.includes('json') || contentType.includes('javascript') || fileName.endsWith('.js') || fileName.endsWith('.ts')) {
      return <Code className="h-4 w-4 text-yellow-500" />
    }
    if (contentType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      return <FileText className="h-4 w-4 text-gray-500" />
    }
    if (contentType.includes('zip') || contentType.includes('archive')) {
      return <Archive className="h-4 w-4 text-orange-500" />
    }
    return <File className="h-4 w-4 text-gray-400" />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleFileAccess = useCallback(async (file: FileItem) => {
    // Check if this is a private file
    if (file.url.startsWith('[PRIVATE:')) {
      try {
        const response = await fetch('/api/r2/private-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: file.key,
            bucket: selectedBucket,
            expiresIn: 3600 // 1 hour
          })
        })

        if (!response.ok) {
          throw new Error('Failed to generate signed URL')
        }

        const data = await response.json()
        window.open(data.signedUrl, '_blank')
        toast.success('Generated temporary access URL (expires in 1 hour)')
      } catch (error) {
        toast.error('Failed to access private file')
        console.error('Private file access error:', error)
      }
    } else {
      // Public file, open directly
      window.open(file.url, '_blank')
    }
  }, [selectedBucket])

  useEffect(() => {
    // Only call on mount or when bucket changes
    fetchFiles()
  }, [selectedBucket]) // Don't include fetchFiles here to avoid infinite loop

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5" />
              <span>R2 Storage Browser</span>
              {items.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">
                    {items.filter(item => item.type === 'directory').length} dirs, {items.filter(item => item.type === 'file').length} files
                  </Badge>
                  {(prefix || searchQuery) && (
                    <Badge variant="outline" className="text-xs">
                      {prefix && `📁 ${prefix}`}
                      {searchQuery && `🔍 "${searchQuery}"`}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Bucket Info */}
            <div className="flex items-center space-x-2">
              <Badge
                variant={selectedBucket === 'pathology-bites-images' ? 'default' : 'outline'}
                className="text-xs"
              >
                {selectedBucket === 'pathology-bites-images' ? '🌐 Public' : '🔒 Private'}
              </Badge>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {selectedBucket}
              </code>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => fetchFiles()} 
                disabled={loading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={downloadAllUrls}
                disabled={!files || files.files.length === 0}
                size="sm"
                variant="default"
              >
                <Download className="h-4 w-4 mr-2" />
                Download URLs
              </Button>
            </div>
          </div>

          {/* Folder Navigation */}
          <div className="space-y-3">
            {/* Breadcrumb Navigation */}
            {prefix && (
              <div className="flex items-center space-x-2 text-sm">
                <FolderOpen className="h-4 w-4 text-gray-500" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToFolder('')}
                  className="h-6 px-2 text-xs"
                >
                  Root
                </Button>
                {getBreadcrumbs().map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center space-x-2">
                    <span className="text-gray-400">/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateToFolder(crumb.path)}
                      className="h-6 px-2 text-xs"
                    >
                      {crumb.name}
                    </Button>
                  </div>
                ))}
                {prefix && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={navigateUp}
                    className="h-6 px-2 text-xs ml-2"
                    title="Go up one level"
                  >
                    ↑ Up
                  </Button>
                )}
              </div>
            )}

          </div>

          {/* Prefix Filter */}
          <div className="flex gap-2">
            <Input
              placeholder="Filter by prefix (e.g., images/)"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={() => {
                setCurrentPage(1)
                fetchFiles({ page: 1, prefix })
              }}
              size="sm"
              variant="outline"
            >
              Filter
            </Button>
            {prefix && (
              <Button 
                onClick={() => {
                  setPrefix('')
                  setCurrentPage(1)
                  fetchFiles({ page: 1, prefix: '' })
                }}
                size="sm"
                variant="ghost"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Search Warning */}
          {searchQuery && selectedBucket === 'pathology-bites-anki' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-800">Large Dataset Search</span>
              </div>
              <p className="text-yellow-700 mt-1">
                Searching through thousands of files may take a moment. The search will scan all files in the bucket to provide accurate results.
              </p>
            </div>
          )}

          {/* File List */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="font-medium">Loading files...</p>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBucket === 'pathology-bites-anki'
                    ? 'Searching through thousands of files...'
                    : 'Searching files...'}
                </p>
              )}
            </div>
          ) : files ? (
            <>
              {/* Sort Controls */}
              <div className="flex gap-2 text-sm">
                <span className="text-gray-500">Sort by:</span>
                <Button
                  variant={sortBy === 'name' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSort('name')}
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
                <Button
                  variant={sortBy === 'size' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSort('size')}
                >
                  Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
                <Button
                  variant={sortBy === 'lastModified' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSort('lastModified')}
                >
                  Modified {sortBy === 'lastModified' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </div>

              {/* Files Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No files or directories found
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">Name</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Size</th>
                          <th className="text-left p-3 font-medium">Modified</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={item.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                {item.type === 'directory' ? (
                                  <FolderOpen className="h-4 w-4 text-blue-500" />
                                ) : (
                                  getFileIcon((item as FileItem).contentType, item.name)
                                )}
                                {item.type === 'directory' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigateToFolder((item as DirectoryItem).path)}
                                    className="font-mono text-xs text-blue-600 hover:text-blue-800 p-0 h-auto"
                                    title={`Navigate to folder: ${item.name}`}
                                  >
                                    {item.name}/
                                  </Button>
                                ) : (
                                  <span className="font-mono text-xs truncate max-w-xs" title={item.key}>
                                    {item.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {item.type === 'directory' ? (
                                <Badge variant="outline" className="text-xs">
                                  Directory
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {((item as FileItem).contentType?.split('/')[0] || 'File')}
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-gray-600">
                              {item.type === 'directory' 
                                ? ((item as DirectoryItem).fileCount ? `${(item as DirectoryItem).fileCount} items` : '-')
                                : formatFileSize((item as FileItem).size)
                              }
                            </td>
                            <td className="p-3 text-gray-600">
                              {formatDate(item.lastModified)}
                            </td>
                            <td className="p-3">
                              {item.type === 'directory' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigateToFolder((item as DirectoryItem).path)}
                                  title={`Open folder: ${item.name}`}
                                >
                                  <FolderOpen className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleFileAccess(item as FileItem)}
                                  title={(item as FileItem).url.startsWith('[PRIVATE:') ? 'Generate signed URL for private file' : 'Open public file'}
                                >
                                  {(item as FileItem).url.startsWith('[PRIVATE:') ? (
                                    <span className="flex items-center space-x-1">
                                      <ExternalLink className="h-3 w-3" />
                                      <span className="text-xs text-orange-600">🔒</span>
                                    </span>
                                  ) : (
                                    <ExternalLink className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Click refresh to load files
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
