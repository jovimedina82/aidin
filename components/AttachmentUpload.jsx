'use client'
import { useState, useCallback, useEffect } from 'react'
import { Upload, X, File, Download, Image, FileText, FileSpreadsheet, Archive, FileVideo, FileAudio, Presentation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'

export default function AttachmentUpload({ ticketId, onUploadComplete, existingAttachments = [], readOnly = false }) {
  const { makeAuthenticatedRequest } = useAuth()
  const [attachments, setAttachments] = useState(existingAttachments)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Sync attachments state when existingAttachments prop changes
  useEffect(() => {
    console.log('🎨 AttachmentUpload: Received attachments:', existingAttachments.map(a => ({
      fileName: a.fileName,
      userId: a.userId,
      userType: a.user?.userType,
      userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : 'NO USER',
      hasUser: !!a.user
    })))
    setAttachments(existingAttachments)
  }, [existingAttachments])

  // Get file icon based on MIME type and filename
  const getFileIcon = (mimeType, fileName = '') => {
    const ext = fileName.toLowerCase().split('.').pop()

    // Images
    if (mimeType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-purple-600" />
    }

    // PDF
    if (mimeType.includes('pdf') || ext === 'pdf') {
      return <FileText className="w-5 h-5 text-red-600" />
    }

    // Excel/Spreadsheets
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />
    }

    // Word documents
    if (mimeType.includes('word') || mimeType.includes('msword') || ['doc', 'docx'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-600" />
    }

    // PowerPoint/Presentations
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
      return <Presentation className="w-5 h-5 text-orange-600" />
    }

    // Archives
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz') || mimeType.includes('7z') || ['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return <Archive className="w-5 h-5 text-yellow-700" />
    }

    // Video
    if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) {
      return <FileVideo className="w-5 h-5 text-indigo-600" />
    }

    // Audio
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      return <FileAudio className="w-5 h-5 text-pink-600" />
    }

    // Default
    return <File className="w-5 h-5 text-gray-600" />
  }

  // Get background color based on user type
  const getBackgroundColor = (user) => {
    if (!user) return 'bg-gray-100 border-gray-300' // Fallback
    if (user.userType === 'Client') return 'bg-blue-100 border-blue-300' // Requester (more visible blue)
    return 'bg-green-100 border-green-300' // Staff/Manager/Admin (more visible green)
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
    let successCount = 0

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
          successCount++
        } else {
          const error = await response.json()
          toast.error(`Failed to upload ${file.name}: ${error.error}`)
        }
      }

      // Show reminder message if at least one file was uploaded successfully
      if (successCount > 0) {
        setTimeout(() => {
          toast.info('💡 Remember to add a comment to send these attachments to the requester', {
            duration: 5000
          })
        }, 500)
      }

      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (error) {
      // console.error('Upload error:', error)
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
      // console.error('Delete error:', error)
      toast.error('Failed to delete attachment')
    }
  }

  // Handle download attachment
  const handleDownload = async (attachmentId, fileName) => {
    console.log('📥 Client: Starting download for:', attachmentId, fileName)
    try {
      const response = await makeAuthenticatedRequest(`/api/attachments/${attachmentId}/download`)
      console.log('📥 Client: Response received:', response.status, response.statusText)

      if (response.ok) {
        const blob = await response.blob()
        console.log('📥 Client: Blob created, size:', blob.size, 'type:', blob.type)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        console.log('✅ Client: Download initiated successfully')
      } else {
        const errorText = await response.text()
        console.error('❌ Client: Download failed:', response.status, errorText)
        toast.error('Failed to download attachment')
      }
    } catch (error) {
      console.error('❌ Client: Download error:', error)
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
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                getBackgroundColor(attachment.user)
              } hover:opacity-90`}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getFileIcon(attachment.mimeType, attachment.fileName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatFileSize(attachment.fileSize)} • {new Date(attachment.uploadedAt).toLocaleDateString()}
                    {attachment.user && (
                      <span className="ml-1">
                        • {attachment.user.firstName} {attachment.user.lastName}
                      </span>
                    )}
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
