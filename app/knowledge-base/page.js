'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import DashboardLayout from '../../components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Book, Plus, Search, Edit, Trash2, Image, Upload, X, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function KnowledgeBasePage() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const [articles, setArticles] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [viewingArticle, setViewingArticle] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    departmentId: '',
    images: []
  })

  // Handle different role formats: can be string, object with role.name, or object with role.role.name
  const getRoleName = (role) => {
    if (typeof role === 'string') return role
    if (role?.role?.name) return role.role.name
    if (role?.name) return role.name
    return null
  }

  const isAdmin = user?.roles?.some(role => getRoleName(role) === 'Admin')
  const canManageArticles = user?.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(getRoleName(role)))

  useEffect(() => {
    if (user) {
      fetchArticles()
      fetchDepartments()
    }
  }, [user])

  const fetchArticles = async () => {
    try {
      setLoading(true)
      // Use admin API if admin, otherwise use public API
      const endpoint = isAdmin ? '/api/admin/knowledge-base' : '/api/knowledge-base'
      const response = await makeAuthenticatedRequest(endpoint)
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || [])
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to load articles')
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
      toast.error('Failed to load knowledge base articles')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error)
    }
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length !== files.length) {
      toast.error('Only image files are allowed')
      return
    }

    // Convert images to base64 for storage/preview
    Promise.all(
      imageFiles.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve({
            name: file.name,
            data: e.target.result,
            size: file.size
          })
          reader.readAsDataURL(file)
        })
      })
    ).then(images => {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...images]
      }))
    })
  }

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required')
      return
    }

    try {
      const articleData = {
        title: formData.title,
        content: formData.content,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        departmentId: formData.departmentId || null,
        images: formData.images
      }

      const url = editingArticle
        ? `/api/admin/knowledge-base/${editingArticle.id}`
        : '/api/admin/knowledge-base'

      const method = editingArticle ? 'PUT' : 'POST'

      const response = await makeAuthenticatedRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articleData)
      })

      if (response.ok) {
        toast.success(editingArticle ? 'Article updated successfully' : 'Article created successfully')
        setShowCreateDialog(false)
        setEditingArticle(null)
        setFormData({ title: '', content: '', tags: '', departmentId: '', images: [] })
        fetchArticles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save article')
      }
    } catch (error) {
      console.error('Error saving article:', error)
      toast.error('Failed to save article')
    }
  }

  const handleEdit = (article) => {
    setEditingArticle(article)
    setFormData({
      title: article.title || '',
      content: article.content || '',
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      departmentId: article.departmentId || '',
      images: article.images || []
    })
    setShowCreateDialog(true)
  }

  const handleDelete = async (articleId) => {
    if (!confirm('Are you sure you want to delete this article?')) return

    try {
      const response = await makeAuthenticatedRequest(`/api/admin/knowledge-base/${articleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Article deleted successfully')
        fetchArticles()
      } else {
        toast.error('Failed to delete article')
      }
    } catch (error) {
      console.error('Error deleting article:', error)
      toast.error('Failed to delete article')
    }
  }

  const handleToggleActive = async (articleId, currentStatus) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/knowledge-base/${articleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (response.ok) {
        toast.success(!currentStatus ? 'Article activated' : 'Article deactivated')
        fetchArticles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to toggle article status')
      }
    } catch (error) {
      console.error('Error toggling article status:', error)
      toast.error('Failed to toggle article status')
    }
  }

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (Array.isArray(article.tags) && article.tags.some(tag =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  )

  const resetForm = () => {
    setFormData({ title: '', content: '', tags: '', departmentId: '', images: [] })
    setEditingArticle(null)
  }

  return (
    <TooltipProvider delayDuration={1000}>
      <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center">
              <Book className="mr-3 h-8 w-8 text-blue-600" />
              Knowledge Base
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? 'Create and manage help articles for your support team and Virtual Assistant'
                : 'Browse help articles and solutions for common issues'
              }
            </p>
          </div>
          {isAdmin && (
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
              setShowCreateDialog(open)
              if (!open) resetForm()
            }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Article
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create a new knowledge base article</p>
                </TooltipContent>
              </Tooltip>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingArticle ? 'Edit Article' : 'Create New Article'}
                  </DialogTitle>
                  <DialogDescription>
                    Create helpful articles that the Virtual Assistant can use to solve tickets automatically.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., How to reset password in Outlook"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={formData.departmentId || undefined}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.departmentId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, departmentId: '' }))}
                          className="text-xs"
                        >
                          Clear department
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="password, outlook, email, reset (comma-separated)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Detailed step-by-step instructions..."
                      className="min-h-[200px]"
                      required
                    />
                  </div>

                  {/* Image Upload Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Image className="h-4 w-4" />
                      <Label>Attached Images</Label>
                    </div>

                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <div className="mt-4">
                          <Label htmlFor="image-upload" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-foreground">
                              Click to upload images
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              PNG, JPG, GIF up to 10MB each
                            </span>
                          </Label>
                          <input
                            id="image-upload"
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Image Previews */}
                    {formData.images.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {formData.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image.data}
                              alt={image.name}
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {image.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateDialog(false)
                        resetForm()
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingArticle ? 'Update Article' : 'Create Article'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search articles by title, content, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Articles Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Book className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No articles found' : 'No articles yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'Create your first knowledge base article to help users and the Virtual Assistant solve common issues'
                }
              </p>
              {isAdmin && !searchTerm && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Article
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <Tooltip key={article.id}>
                  <TooltipTrigger asChild>
                    <Card
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setViewingArticle(article)}
                    >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">
                      {article.title}
                    </CardTitle>
                    {isAdmin && (
                      <div className="flex space-x-1 ml-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(article)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit this article</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(article.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete this article</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center space-x-2 flex-wrap">
                      {article.department && (
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: `${article.department.color}20`, color: article.department.color }}
                        >
                          {article.department.name}
                        </Badge>
                      )}
                      {canManageArticles && (
                        <Badge variant={article.isActive ? 'default' : 'secondary'} className="flex items-center gap-1">
                          {article.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {article.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                    {canManageArticles && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Label htmlFor={`active-${article.id}`} className="text-xs text-muted-foreground cursor-pointer">
                              {article.isActive ? 'Active' : 'Inactive'}
                            </Label>
                            <Switch
                              id={`active-${article.id}`}
                              checked={article.isActive}
                              onCheckedChange={() => handleToggleActive(article.id, article.isActive)}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{article.isActive ? 'Deactivate article (hide from users and AI)' : 'Activate article (visible to users and AI)'}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <CardDescription className="line-clamp-3 mb-3">
                    {article.content}
                  </CardDescription>

                  {Array.isArray(article.tags) && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {article.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{article.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {article.images && article.images.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <Image className="h-3 w-3 mr-1" />
                              {article.images.length} image{article.images.length !== 1 ? 's' : ''}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>This article contains {article.images.length} attached image{article.images.length !== 1 ? 's' : ''}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center font-medium text-blue-600">
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Used {article.usageCount || 0} {(article.usageCount || 0) === 1 ? 'time' : 'times'}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>This article has been used {article.usageCount || 0} {(article.usageCount || 0) === 1 ? 'time' : 'times'} by the AI to generate responses</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-md p-4 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-xl"
            >
              <div className="space-y-2">
                <p className="text-sm font-bold text-white">{article.title}</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {article.content.replace(/[#*`\n]/g, ' ').trim().substring(0, 200)}
                  {article.content.length > 200 && '...'}
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
                  {article.department && (
                    <span className="text-xs text-slate-400">
                      📁 {article.department.name}
                    </span>
                  )}
                  <span className="text-xs text-blue-400 font-medium">
                    ✓ Used {article.usageCount || 0} {(article.usageCount || 0) === 1 ? 'time' : 'times'}
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
            ))}
          </div>
        )}

        {/* View Article Dialog */}
        {viewingArticle && (
          <Dialog open={!!viewingArticle} onOpenChange={(open) => !open && setViewingArticle(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl mb-2">{viewingArticle.title}</DialogTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {viewingArticle.department && (
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: `${viewingArticle.department.color}20`, color: viewingArticle.department.color }}
                        >
                          {viewingArticle.department.name}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        Used {viewingArticle.usageCount || 0} times
                      </Badge>
                      {canManageArticles && (
                        <Badge variant={viewingArticle.isActive ? 'default' : 'secondary'} className="flex items-center gap-1">
                          {viewingArticle.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {viewingArticle.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleEdit(viewingArticle)
                          setViewingArticle(null)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleDelete(viewingArticle.id)
                          setViewingArticle(null)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="mt-6 space-y-6">
                {/* Tags */}
                {Array.isArray(viewingArticle.tags) && viewingArticle.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewingArticle.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Content</h3>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-3 text-gray-900" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900" {...props} />,
                        h4: ({node, ...props}) => <h4 className="text-base font-bold mt-3 mb-2 text-gray-900" {...props} />,
                        p: ({node, ...props}) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                        em: ({node, ...props}) => <em className="italic text-gray-800" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-2 ml-4" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-2 ml-4" {...props} />,
                        li: ({node, ...props}) => <li className="text-gray-700 leading-relaxed" {...props} />,
                        a: ({node, ...props}) => <a className="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4" {...props} />,
                        code: ({node, inline, ...props}) =>
                          inline
                            ? <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />
                            : <code className="block bg-gray-100 p-4 rounded text-sm font-mono text-gray-800 overflow-x-auto my-4" {...props} />,
                        pre: ({node, ...props}) => <pre className="bg-gray-100 p-4 rounded overflow-x-auto my-4" {...props} />,
                        hr: ({node, ...props}) => <hr className="my-6 border-gray-300" {...props} />,
                        img: ({node, ...props}) => (
                          <img
                            className="max-w-full h-auto rounded-lg border border-gray-300 my-4"
                            loading="lazy"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {viewingArticle.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Images */}
                {viewingArticle.images && viewingArticle.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Attached Images ({viewingArticle.images.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {viewingArticle.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image.data}
                            alt={image.name}
                            className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(image.data, '_blank')}
                          />
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {image.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Created:</span>{' '}
                      <span className="font-medium">
                        {new Date(viewingArticle.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Updated:</span>{' '}
                      <span className="font-medium">
                        {new Date(viewingArticle.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {viewingArticle.createdBy && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Created by:</span>{' '}
                      <span className="font-medium">
                        {viewingArticle.createdBy.firstName} {viewingArticle.createdBy.lastName}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        ({viewingArticle.createdBy.email})
                      </span>
                    </div>
                  )}
                </div>

                {canManageArticles && (
                  <div className="pt-4 border-t flex items-center justify-between">
                    <span className="text-sm font-medium">Article Status</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="view-active-toggle" className="text-sm text-muted-foreground cursor-pointer">
                        {viewingArticle.isActive ? 'Active' : 'Inactive'}
                      </Label>
                      <Switch
                        id="view-active-toggle"
                        checked={viewingArticle.isActive}
                        onCheckedChange={() => {
                          handleToggleActive(viewingArticle.id, viewingArticle.isActive)
                          setViewingArticle(null)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      </DashboardLayout>
    </TooltipProvider>
  )
}