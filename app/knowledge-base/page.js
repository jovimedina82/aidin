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
import { Book, Plus, Search, Edit, Trash2, Image, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

export default function KnowledgeBasePage() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const [articles, setArticles] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    departmentId: '',
    images: []
  })

  const isAdmin = user?.roles?.some(role => ['Admin'].includes(role))

  useEffect(() => {
    fetchArticles()
    fetchDepartments()
  }, [])

  const fetchArticles = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/admin/knowledge-base')
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || [])
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
              Create and manage help articles for your support team and Virtual Assistant
            </p>
          </div>
          {isAdmin && (
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
              setShowCreateDialog(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Article
                </Button>
              </DialogTrigger>
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
              <Card key={article.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">
                      {article.title}
                    </CardTitle>
                    {isAdmin && (
                      <div className="flex space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(article.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {article.department && (
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: `${article.department.color}20`, color: article.department.color }}
                      >
                        {article.department.name}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      Used {article.usageCount || 0} times
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <CardDescription className="line-clamp-3 mb-3">
                    {article.content}
                  </CardDescription>

                  {Array.isArray(article.tags) && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
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

                  {article.images && article.images.length > 0 && (
                    <div className="mt-3 flex items-center text-sm text-muted-foreground">
                      <Image className="h-4 w-4 mr-1" />
                      {article.images.length} image{article.images.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}