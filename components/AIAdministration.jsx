'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Brain, Database, TrendingUp, Plus, Edit, Trash2, Eye, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function AIAdministration({ makeAuthenticatedRequest }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [aiDecisions, setAiDecisions] = useState([])
  const [keywords, setKeywords] = useState([])
  const [knowledgeBase, setKnowledgeBase] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])

  // New keyword dialog state
  const [showNewKeywordDialog, setShowNewKeywordDialog] = useState(false)
  const [newKeyword, setNewKeyword] = useState({
    departmentId: '',
    keyword: '',
    weight: 1.0
  })

  // New KB article dialog state
  const [showNewKBDialog, setShowNewKBDialog] = useState(false)
  const [newKBArticle, setNewKBArticle] = useState({
    title: '',
    content: '',
    tags: '',
    departmentId: ''
  })

  // Edit KB article dialog state
  const [showEditKBDialog, setShowEditKBDialog] = useState(false)
  const [editingKBArticle, setEditingKBArticle] = useState(null)
  const [editKBArticle, setEditKBArticle] = useState({
    title: '',
    content: '',
    tags: '',
    departmentId: ''
  })

  // Edit keyword dialog state
  const [showEditKeywordDialog, setShowEditKeywordDialog] = useState(false)
  const [editingKeyword, setEditingKeyword] = useState(null)
  const [editKeyword, setEditKeyword] = useState({
    keyword: '',
    weight: 1.0,
    isActive: true
  })

  useEffect(() => {
    fetchAIData()
  }, [])

  const fetchAIData = async () => {
    try {
      setLoading(true)

      // Fetch AI decisions
      const decisionsResponse = await makeAuthenticatedRequest('/api/admin/ai-decisions')
      if (decisionsResponse.ok) {
        const decisionsData = await decisionsResponse.json()
        setAiDecisions(decisionsData.decisions || [])
        setStats(decisionsData.stats || {})
      }

      // Fetch keywords
      const keywordsResponse = await makeAuthenticatedRequest('/api/admin/keywords')
      if (keywordsResponse.ok) {
        const keywordsData = await keywordsResponse.json()
        setKeywords(keywordsData.departments || [])
        setDepartments(keywordsData.departments || [])
      }

      // Fetch knowledge base
      const kbResponse = await makeAuthenticatedRequest('/api/admin/knowledge-base')
      if (kbResponse.ok) {
        const kbData = await kbResponse.json()
        setKnowledgeBase(kbData.articles || [])
      }

    } catch (error) {
      console.error('Error fetching AI data:', error)
      toast.error('Failed to fetch AI data')
    } finally {
      setLoading(false)
    }
  }

  const addKeyword = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/admin/keywords', {
        method: 'POST',
        body: JSON.stringify(newKeyword)
      })

      if (response.ok) {
        setNewKeyword({ departmentId: '', keyword: '', weight: 1.0 })
        setShowNewKeywordDialog(false)
        fetchAIData()
        toast.success('Keyword added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add keyword')
      }
    } catch (error) {
      console.error('Error adding keyword:', error)
      toast.error('Failed to add keyword')
    }
  }

  const addKBArticle = async () => {
    try {
      const articleData = {
        ...newKBArticle,
        tags: newKBArticle.tags ? newKBArticle.tags.split(',').map(t => t.trim()) : []
      }

      const response = await makeAuthenticatedRequest('/api/admin/knowledge-base', {
        method: 'POST',
        body: JSON.stringify(articleData)
      })

      if (response.ok) {
        setNewKBArticle({ title: '', content: '', tags: '', departmentId: '' })
        setShowNewKBDialog(false)
        fetchAIData()
        toast.success('Knowledge base article added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add knowledge base article')
      }
    } catch (error) {
      console.error('Error adding KB article:', error)
      toast.error('Failed to add knowledge base article')
    }
  }

  const deleteKeyword = async (keywordId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/keywords/${keywordId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchAIData()
        toast.success('Keyword deleted successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete keyword')
      }
    } catch (error) {
      console.error('Error deleting keyword:', error)
      toast.error('Failed to delete keyword')
    }
  }

  const updateKeyword = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/keywords/${editingKeyword.id}`, {
        method: 'PUT',
        body: JSON.stringify(editKeyword)
      })

      if (response.ok) {
        setEditingKeyword(null)
        setShowEditKeywordDialog(false)
        fetchAIData()
        toast.success('Keyword updated successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update keyword')
      }
    } catch (error) {
      console.error('Error updating keyword:', error)
      toast.error('Failed to update keyword')
    }
  }

  const startEditKeyword = (keyword) => {
    setEditingKeyword(keyword)
    setEditKeyword({
      keyword: keyword.keyword,
      weight: keyword.weight,
      isActive: keyword.isActive
    })
    setShowEditKeywordDialog(true)
  }

  const updateKBArticle = async () => {
    try {
      const articleData = {
        ...editKBArticle,
        tags: editKBArticle.tags ? editKBArticle.tags.split(',').map(t => t.trim()) : []
      }

      const response = await makeAuthenticatedRequest(`/api/admin/knowledge-base/${editingKBArticle.id}`, {
        method: 'PUT',
        body: JSON.stringify(articleData)
      })

      if (response.ok) {
        setEditingKBArticle(null)
        setShowEditKBDialog(false)
        fetchAIData()
        toast.success('Knowledge base article updated successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update knowledge base article')
      }
    } catch (error) {
      console.error('Error updating KB article:', error)
      toast.error('Failed to update knowledge base article')
    }
  }

  const startEditKBArticle = (article) => {
    setEditingKBArticle(article)
    setEditKBArticle({
      title: article.title,
      content: article.content,
      tags: article.tags ? article.tags.join(', ') : '',
      departmentId: article.departmentId || ''
    })
    setShowEditKBDialog(true)
  }

  const deleteKBArticle = async (articleId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/knowledge-base/${articleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchAIData()
        toast.success('Knowledge base article deleted successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete knowledge base article')
      }
    } catch (error) {
      console.error('Error deleting KB article:', error)
      toast.error('Failed to delete knowledge base article')
    }
  }

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Decisions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDecisions || 0}</div>
            <p className="text-xs text-muted-foreground">Total routing decisions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getConfidenceColor(stats.averageConfidence || 0)}`}>
              {((stats.averageConfidence || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Average routing confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keywords</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {keywords.reduce((total, dept) => total + dept.keywords.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across {keywords.length} departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KB Articles</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeBase.length}</div>
            <p className="text-xs text-muted-foreground">
              {knowledgeBase.filter(kb => kb.hasEmbedding).length} with embeddings
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="decisions">AI Decisions</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent AI Decisions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent AI Decisions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiDecisions.slice(0, 5).map((decision) => (
                    <div key={decision.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{decision.ticket.title}</div>
                        <div className="text-sm text-gray-500">
                          {decision.ticket.requester?.firstName} {decision.ticket.requester?.lastName}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getConfidenceBadge(decision.departmentConfidence)}>
                          {(decision.departmentConfidence * 100).toFixed(0)}%
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(decision.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performing KB Articles */}
            <Card>
              <CardHeader>
                <CardTitle>Top Knowledge Base Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {knowledgeBase
                    .sort((a, b) => b.usageCount - a.usageCount)
                    .slice(0, 5)
                    .map((article) => (
                      <div key={article.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{article.title}</div>
                          <div className="text-sm text-gray-500">
                            {article.department?.name || 'General'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{article.usageCount}</div>
                          <div className="text-xs text-gray-500">uses</div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Routing Decisions</CardTitle>
              <p className="text-sm text-gray-500">
                Review how AI is routing tickets to departments
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiDecisions.map((decision) => (
                  <div key={decision.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium">{decision.ticket.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{decision.ticket.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-sm text-gray-500">
                            By: {decision.ticket.requester?.firstName} {decision.ticket.requester?.lastName}
                          </span>
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-500">
                            {new Date(decision.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Badge className={getConfidenceBadge(decision.departmentConfidence)}>
                        {(decision.departmentConfidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="font-medium text-gray-700">Suggested Department:</label>
                        <p>{decision.suggestedDepartment || 'None'}</p>
                      </div>
                      <div>
                        <label className="font-medium text-gray-700">Final Department:</label>
                        <p>{decision.finalDepartment || 'None'}</p>
                      </div>
                      <div>
                        <label className="font-medium text-gray-700">Keyword Matches:</label>
                        <p>
                          {decision.keywordMatches
                            ? JSON.parse(decision.keywordMatches).join(', ')
                            : 'None'}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-gray-700">Override:</label>
                        <p className={decision.wasOverridden ? 'text-red-600' : 'text-green-600'}>
                          {decision.wasOverridden ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>

                    {decision.aiReasoning && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <label className="font-medium text-gray-700">AI Reasoning:</label>
                        <p className="text-sm mt-1">{decision.aiReasoning}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Department Keywords</h2>
            <Dialog open={showNewKeywordDialog} onOpenChange={setShowNewKeywordDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Keyword
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Keyword</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Select value={newKeyword.departmentId} onValueChange={(value) =>
                      setNewKeyword({...newKeyword, departmentId: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="keyword">Keyword</Label>
                    <Input
                      id="keyword"
                      value={newKeyword.keyword}
                      onChange={(e) => setNewKeyword({...newKeyword, keyword: e.target.value})}
                      placeholder="Enter keyword"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">Weight</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      value={newKeyword.weight}
                      onChange={(e) => setNewKeyword({...newKeyword, weight: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowNewKeywordDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addKeyword}>Add Keyword</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Keyword Dialog */}
          <Dialog open={showEditKeywordDialog} onOpenChange={setShowEditKeywordDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Keyword</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-keyword">Keyword</Label>
                  <Input
                    id="edit-keyword"
                    value={editKeyword.keyword}
                    onChange={(e) => setEditKeyword({...editKeyword, keyword: e.target.value})}
                    placeholder="Enter keyword"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-weight">Weight</Label>
                  <Input
                    id="edit-weight"
                    type="number"
                    step="0.1"
                    value={editKeyword.weight}
                    onChange={(e) => setEditKeyword({...editKeyword, weight: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-active"
                    checked={editKeyword.isActive}
                    onCheckedChange={(checked) => setEditKeyword({...editKeyword, isActive: checked})}
                  />
                  <Label htmlFor="edit-active">Active</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowEditKeywordDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={updateKeyword}>Update Keyword</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {keywords.map((department) => (
              <Card key={department.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full bg-${department.color}-500`}></span>
                    {department.name}
                    <Badge variant="secondary">{department.keywords.length} keywords</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {department.keywords.map((keyword) => (
                      <div key={keyword.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{keyword.keyword}</span>
                          <Badge variant="outline">
                            {keyword.weight.toFixed(1)}x
                          </Badge>
                          {!keyword.isActive && (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditKeyword(keyword)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteKeyword(keyword.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="knowledge-base" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Knowledge Base Articles</h2>
            <Dialog open={showNewKBDialog} onOpenChange={setShowNewKBDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Article
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Knowledge Base Article</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newKBArticle.title}
                      onChange={(e) => setNewKBArticle({...newKBArticle, title: e.target.value})}
                      placeholder="Article title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={newKBArticle.content}
                      onChange={(e) => setNewKBArticle({...newKBArticle, content: e.target.value})}
                      placeholder="Article content"
                      rows={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={newKBArticle.tags}
                      onChange={(e) => setNewKBArticle({...newKBArticle, tags: e.target.value})}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department (optional)</Label>
                    <Select value={newKBArticle.departmentId} onValueChange={(value) =>
                      setNewKBArticle({...newKBArticle, departmentId: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">General (No department)</SelectItem>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowNewKBDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addKBArticle}>Add Article</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit KB Article Dialog */}
          <Dialog open={showEditKBDialog} onOpenChange={setShowEditKBDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Knowledge Base Article</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editKBArticle.title}
                    onChange={(e) => setEditKBArticle({...editKBArticle, title: e.target.value})}
                    placeholder="Article title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea
                    id="edit-content"
                    value={editKBArticle.content}
                    onChange={(e) => setEditKBArticle({...editKBArticle, content: e.target.value})}
                    placeholder="Article content"
                    rows={8}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                  <Input
                    id="edit-tags"
                    value={editKBArticle.tags}
                    onChange={(e) => setEditKBArticle({...editKBArticle, tags: e.target.value})}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-department">Department (optional)</Label>
                  <Select value={editKBArticle.departmentId} onValueChange={(value) =>
                    setEditKBArticle({...editKBArticle, departmentId: value})
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">General (No department)</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowEditKBDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={updateKBArticle}>Update Article</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {knowledgeBase.map((article) => (
              <Card key={article.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{article.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        {article.department && (
                          <Badge style={{backgroundColor: `var(--${article.department.color}-100)`}}>
                            {article.department.name}
                          </Badge>
                        )}
                        {article.hasEmbedding ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Embedded
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            No Embedding
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{article.usageCount} uses</div>
                      <div className="text-xs text-gray-500">
                        {article.responseUsage} in responses
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {article.content.substring(0, 150)}...
                    </p>

                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {article.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        Updated: {new Date(article.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditKBArticle(article)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKBArticle(article.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}