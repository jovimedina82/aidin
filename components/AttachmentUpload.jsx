'use client'
import { useState, useCallback } from 'react'
import { Upload, X, File, Download, Image, FileText, FileSpreadsheet, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'

export default function AttachmentUpload({ ticketId, onUploadComplete, existingAttachments = [], readOnly = false }) {
  const { makeAuthenticatedRequest } = useAuth()
  const [attachments, setAttachments] = useState(existingAttachments)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Get file icon
  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />
    if (mimeType.includes('pdf')) return <FileText className="w-4 h-4" />
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-4 h-4" />
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz')) return <Archive className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('ticketId', ticketId)

        const response = await makeAuthenticatedRequest('/api/attachments', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          setAttachments(prev => [...prev, data.attachment])
          toast.success(`Uploaded ${file.name}`)
        } else {
          const error = await response.json()
          toast.error(`Failed to upload ${file.name}: ${error.error}`)
        }
      }

      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || [])
    handleFileUpload(files)
    e.target.value = '' // Reset input
  }

  // Handle drag and drop
  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files || [])
    handleFileUpload(files)
  }, [ticketId])

  // Handle delete attachment
  const handleDelete = async (attachmentId, fileName) => {
    if (!confirm(`Delete ${fileName}?`)) return

    try {
      const response = await makeAuthenticatedRequest(`/api/attachments?id=${attachmentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId))
        toast.success('Attachment deleted')
      } else {
        const error = await response.json()
        toast.error(`Failed to delete: ${error.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete attachment')
    }
  }

  // Handle download attachment
  const handleDownload = async (attachmentId, fileName) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/attachments/${attachmentId}/download`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('Failed to download attachment')
      }
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download attachment')
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop files here, or click to select
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Max 25MB per file, 50MB total per ticket. Images, PDFs, documents, spreadsheets, archives allowed.
          </p>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            onChange={handleFileInputChange}
            disabled={uploading}
          />
          <label htmlFor="file-upload">
            <Button
              type="button"
              disabled={uploading}
              onClick={() => document.getElementById('file-upload').click()}
              asChild
            >
              <span className="cursor-pointer">
                {uploading ? 'Uploading...' : 'Select Files'}
              </span>
            </Button>
          </label>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Attachments ({attachments.length})
          </h4>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0 text-gray-500">
                  {getFileIcon(attachment.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.fileSize)} •
                    {new Date(attachment.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(attachment.id, attachment.fileName)}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(attachment.id, attachment.fileName)}
                    title="Delete"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
