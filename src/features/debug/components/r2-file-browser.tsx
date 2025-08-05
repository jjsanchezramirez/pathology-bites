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
  HardDrive
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'
import { R2FileListResponse, R2FileListParams } from '@/shared/types/r2-api'

interface R2FileBrowserProps {
  className?: string
  defaultBucket?: string
}

// Available R2 buckets
const R2_BUCKETS = [
  {
    name: 'pathology-bites-images',
    label: 'Images Bucket',
    icon: ImageIcon,
    description: 'Medical images, microscopic slides, and visual content'
  },
  {
    name: 'pathology-bites-data',
    label: 'Data Bucket',
    icon: Database,
    description: 'JSON files, datasets, and structured data'
  }
] as const

export function R2FileBrowser({ className, defaultBucket = 'pathology-bites-images' }: R2FileBrowserProps) {
  const [files, setFiles] = useState<R2FileListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [prefix, setPrefix] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'lastModified'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedBucket, setSelectedBucket] = useState(defaultBucket)

  const fetchFiles = useCallback(async (params: Partial<R2FileListParams> = {}) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: (params.page || currentPage).toString(),
        limit: '50',
        sortBy: params.sortBy || sortBy,
        sortOrder: params.sortOrder || sortOrder,
        bucket: selectedBucket,
        ...(params.prefix !== undefined ? { prefix: params.prefix } : prefix ? { prefix } : {}),
        ...(params.search !== undefined ? { search: params.search } : searchQuery ? { search: searchQuery } : {})
      })

      const response = await fetch(`/api/r2/files?${queryParams}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setFiles(data)
      const bucketInfo = R2_BUCKETS.find(b => b.name === selectedBucket)
      toast.success(`Loaded ${data.files.length} files from ${bucketInfo?.label || selectedBucket}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch files'
      toast.error(errorMessage)
      console.error('R2 fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, prefix, searchQuery, sortBy, sortOrder, selectedBucket])

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
          limit: '1000',
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

  const handleFileAccess = useCallback(async (file: any) => {
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
    fetchFiles()
  }, [selectedBucket])

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5" />
              <span>R2 Storage Browser</span>
              {files && (
                <Badge variant="secondary">
                  {files.pagination.totalItems} files
                </Badge>
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

          {/* File List */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading files...</p>
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
                  {files.files.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No files found
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">File</th>
                          <th className="text-left p-3 font-medium">Size</th>
                          <th className="text-left p-3 font-medium">Modified</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {files.files.map((file, index) => (
                          <tr key={file.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                {getFileIcon(file.contentType || '', file.key)}
                                <span className="font-mono text-xs truncate max-w-xs" title={file.key}>
                                  {file.key}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-gray-600">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="p-3 text-gray-600">
                              {formatDate(file.lastModified.toString())}
                            </td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFileAccess(file)}
                                title={file.url.startsWith('[PRIVATE:') ? 'Generate signed URL for private file' : 'Open public file'}
                              >
                                {file.url.startsWith('[PRIVATE:') ? (
                                  <span className="flex items-center space-x-1">
                                    <ExternalLink className="h-3 w-3" />
                                    <span className="text-xs text-orange-600">🔒</span>
                                  </span>
                                ) : (
                                  <ExternalLink className="h-3 w-3" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Pagination */}
              {files.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {files.pagination.page} of {files.pagination.totalPages} 
                    ({files.pagination.totalItems} total files)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!files.pagination.hasPreviousPage}
                      onClick={() => {
                        const newPage = currentPage - 1
                        setCurrentPage(newPage)
                        fetchFiles({ page: newPage })
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!files.pagination.hasNextPage}
                      onClick={() => {
                        const newPage = currentPage + 1
                        setCurrentPage(newPage)
                        fetchFiles({ page: newPage })
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
