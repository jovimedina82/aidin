'use client'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Users,
  Crown,
  Shield,
  User,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  Move,
  Minus,
  Plus
} from 'lucide-react'
import { Input } from '@/components/ui/input'

const NetworkOrgChart = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All')
  const [zoom, setZoom] = useState(1)
  const [transform, setTransform] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [nodeSpacing, setNodeSpacing] = useState(150)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Admin': return <Crown className="h-4 w-4 text-yellow-500" />
      case 'Manager': return <Shield className="h-4 w-4 text-blue-500" />
      case 'Staff': return <Users className="h-4 w-4 text-green-500" />
      default: return <User className="h-4 w-4 text-gray-500" />
    }
  }

  // Improved layout algorithm for better node distribution
  const calculatePositions = (hierarchy) => {
    const positions = new Map()
    const levelHeight = 180
    const centerX = 400

    // First pass: Calculate tree structure and count nodes per level
    const levelInfo = new Map() // level -> {nodes: [], totalWidth: number}

    const buildLevelInfo = (nodes, level) => {
      if (!levelInfo.has(level)) {
        levelInfo.set(level, { nodes: [], totalWidth: 0 })
      }

      nodes.forEach(node => {
        levelInfo.get(level).nodes.push(node)
        if (node.directReports && node.directReports.length > 0) {
          buildLevelInfo(node.directReports, level + 1)
        }
      })
    }

    buildLevelInfo(hierarchy, 0)

    // Second pass: Position nodes with better spacing
    const positionLevel = (level) => {
      const levelData = levelInfo.get(level)
      if (!levelData) return

      const nodes = levelData.nodes
      const nodeCount = nodes.length
      const spacing = Math.max(nodeSpacing, 120)
      const totalWidth = (nodeCount - 1) * spacing
      const startX = centerX - totalWidth / 2

      nodes.forEach((node, index) => {
        const x = nodeCount === 1 ? centerX : startX + (index * spacing)
        const y = level * levelHeight + 100

        positions.set(node.id, { x, y, level })
      })
    }

    // Position all levels
    for (let level = 0; level < levelInfo.size; level++) {
      positionLevel(level)
    }

    return positions
  }

  // Filter employees based on search and department
  const filterEmployee = (employee) => {
    const matchesSearch = !searchTerm ||
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.primaryDepartment.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDepartment = selectedDepartment === 'All' ||
      employee.departments.includes(selectedDepartment)

    return matchesSearch && matchesDepartment
  }

  // Get all visible employees
  const getVisibleEmployees = (nodes, positions) => {
    const visible = []

    const traverse = (nodeList) => {
      nodeList.forEach(node => {
        if (filterEmployee(node)) {
          visible.push({
            ...node,
            position: positions.get(node.id)
          })
        }
        if (node.directReports) {
          traverse(node.directReports)
        }
      })
    }

    traverse(nodes)
    return visible
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const positions = calculatePositions(data.hierarchy)
  const visibleEmployees = getVisibleEmployees(data.hierarchy, positions)

  // Calculate SVG dimensions
  const maxX = Math.max(...Array.from(positions.values()).map(p => p.x)) + 100
  const maxY = Math.max(...Array.from(positions.values()).map(p => p.y)) + 100
  const svgWidth = Math.max(800, maxX)
  const svgHeight = Math.max(600, maxY)

  // Generate connection lines
  const generateConnections = () => {
    const connections = []

    const traverse = (nodes) => {
      nodes.forEach(node => {
        if (node.directReports) {
          node.directReports.forEach(child => {
            const parentPos = positions.get(node.id)
            const childPos = positions.get(child.id)

            if (parentPos && childPos && filterEmployee(node) && filterEmployee(child)) {
              connections.push({
                x1: parentPos.x,
                y1: parentPos.y + 60,
                x2: childPos.x,
                y2: childPos.y - 60,
                id: `${node.id}-${child.id}`
              })
            }
          })
          traverse(node.directReports)
        }
      })
    }

    traverse(data.hierarchy)
    return connections
  }

  const connections = generateConnections()

  // Enhanced control functions
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.3))
  const handleReset = () => {
    setZoom(1)
    setTransform({ x: 0, y: 0 })
  }

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (!isFullscreen) {
      // Reset view when entering fullscreen
      setZoom(0.8)
      setTransform({ x: 0, y: 0 })
    }
  }

  const contractNodes = () => setNodeSpacing(prev => Math.max(prev - 20, 80))
  const expandNodes = () => setNodeSpacing(prev => Math.min(prev + 20, 300))

  // Mouse drag functionality
  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      setTransform({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
      if (e.key === '+' || e.key === '=') {
        handleZoomIn()
      }
      if (e.key === '-') {
        handleZoomOut()
      }
      if (e.key === '0') {
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isFullscreen])

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Header with Search and Controls */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Network</h2>
            <p className="text-gray-600">
              {data.totalEmployees} employees across {data.departmentStats.length} departments
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>

            {/* Department Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary w-full sm:w-48"
              >
                <option value="All">All Departments</option>
                {data.departmentStats.map(dept => (
                  <option key={dept.name} value={dept.name}>
                    {dept.name} ({dept.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Enhanced Controls */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={contractNodes} title="Contract nodes">
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={expandNodes} title="Expand nodes">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant={isFullscreen ? "default" : "outline"}
            size="sm"
            onClick={handleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-4 w-4 mr-1" /> : <Maximize className="h-4 w-4 mr-1" />}
            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
          </Button>

          <div className="flex gap-4 text-sm text-gray-500">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <span>Spacing: {nodeSpacing}px</span>
          </div>

          <div className="text-xs text-gray-400 hidden sm:block">
            <Move className="h-3 w-3 inline mr-1" />
            Drag to pan • +/- to zoom • ESC to exit fullscreen
          </div>
        </div>

        {/* Department Legend */}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.departmentStats.map(dept => (
            <div
              key={dept.name}
              className="flex items-center gap-2 bg-white rounded-full px-3 py-1 border shadow-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dept.color }}
              ></div>
              <span className="text-sm font-medium">{dept.name}</span>
              <Badge variant="secondary" className="text-xs">
                {dept.count}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Network Chart */}
      <div className={`bg-white rounded-lg border p-6 overflow-hidden ${isFullscreen ? 'flex-1' : ''}`}>
        {visibleEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`relative w-full border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 ${
              isFullscreen ? 'h-full' : 'h-[600px]'
            } overflow-hidden cursor-${isDragging ? 'grabbing' : 'grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              className="absolute top-0 left-0"
              style={{
                transform: `scale(${zoom}) translate(${transform.x}px, ${transform.y}px)`,
                transformOrigin: 'top left'
              }}
            >
              {/* Connection Lines */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#94a3b8"
                  />
                </marker>
              </defs>

              {connections.map(conn => (
                <line
                  key={conn.id}
                  x1={conn.x1}
                  y1={conn.y1}
                  x2={conn.x2}
                  y2={conn.y2}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  markerEnd="url(#arrowhead)"
                />
              ))}
            </svg>

            {/* Employee Nodes */}
            {visibleEmployees.map(employee => (
              <div
                key={employee.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{
                  left: employee.position.x * zoom + transform.x,
                  top: employee.position.y * zoom + transform.y,
                  transform: `scale(${zoom})`
                }}
              >
                <div className="relative">
                  {/* Node Circle */}
                  <div
                    className="w-24 h-24 rounded-full border-4 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200 cursor-pointer"
                    style={{
                      borderColor: employee.departmentColor,
                      backgroundColor: 'white'
                    }}
                  >
                    <Avatar className="h-16 w-16">
                      <AvatarFallback
                        className="text-lg font-bold text-white"
                        style={{ backgroundColor: employee.departmentColor }}
                      >
                        {employee.avatar}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Role Icon */}
                  <div
                    className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md border-2"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    {getRoleIcon(employee.primaryRole)}
                  </div>

                  {/* Employee Info Card */}
                  <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <Card className="w-64 shadow-xl border-2" style={{ borderColor: employee.departmentColor }}>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <h3 className="font-bold text-gray-900 mb-1">
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <Badge
                            variant="outline"
                            className="mb-2"
                            style={{
                              borderColor: employee.departmentColor,
                              color: employee.departmentColor
                            }}
                          >
                            {employee.primaryRole}
                          </Badge>
                          <p className="text-sm text-gray-600 mb-1">
                            {employee.primaryDepartment}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {employee.email}
                          </p>
                          {employee.directReports?.length > 0 && (
                            <p className="text-xs text-blue-600 mt-2">
                              {employee.directReports.length} Direct Report{employee.directReports.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Name Label */}
                  <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 text-center group-hover:hidden">
                    <div className="bg-white px-2 py-1 rounded shadow-md border text-xs font-medium whitespace-nowrap">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {employee.primaryRole}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NetworkOrgChart