'use client'
import { useState, useEffect } from 'react'
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
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { Input } from '@/components/ui/input'

const HierarchicalOrgChart = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All')
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState(new Set())

  useEffect(() => {
    // Auto-expand first two levels
    if (data?.hierarchy) {
      const autoExpand = new Set()
      data.hierarchy.forEach(root => {
        autoExpand.add(root.id)
        if (root.directReports) {
          root.directReports.forEach(child => {
            autoExpand.add(child.id)
          })
        }
      })
      setExpandedNodes(autoExpand)
    }
  }, [data])

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Admin': return <Crown className="h-4 w-4 text-yellow-500" />
      case 'Manager': return <Shield className="h-4 w-4 text-blue-500" />
      case 'Staff': return <Users className="h-4 w-4 text-green-500" />
      default: return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const toggleExpanded = (nodeId) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
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

  const EmployeeBox = ({ employee, level = 0, isFirst = false, isLast = false, siblingCount = 1 }) => {
    const hasDirectReports = employee.directReports && employee.directReports.length > 0
    const isExpanded = expandedNodes.has(employee.id)
    const filteredReports = hasDirectReports ? employee.directReports.filter(filterEmployee) : []
    const hasFilteredReports = filteredReports.length > 0

    if (!filterEmployee(employee)) {
      return null
    }

    return (
      <div className="flex items-start">
        {/* Horizontal connector from parent */}
        {level > 0 && (
          <div className="flex items-center self-center">
            {/* Horizontal line to this node */}
            <div className="w-8 h-px bg-gray-400"></div>
          </div>
        )}

        {/* Employee Card */}
        <div className="relative flex items-center">
          <Card
            className="w-56 shadow-lg border-2 hover:shadow-xl transition-all duration-200 flex-shrink-0"
            style={{ borderColor: employee.departmentColor }}
          >
            <CardContent className="p-3">
              <div className="flex items-start space-x-2">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="h-10 w-10 border-2"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    <AvatarFallback
                      className="text-xs font-bold text-white"
                      style={{ backgroundColor: employee.departmentColor }}
                    >
                      {employee.avatar}
                    </AvatarFallback>
                  </Avatar>

                  {/* Role Icon */}
                  <div
                    className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow border"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    {getRoleIcon(employee.primaryRole)}
                  </div>
                </div>

                {/* Employee Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-xs leading-tight mb-0.5">
                    {employee.firstName} {employee.lastName}
                  </h3>

                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 mb-1"
                    style={{
                      borderColor: employee.departmentColor,
                      color: employee.departmentColor
                    }}
                  >
                    {employee.primaryRole}
                  </Badge>

                  <p className="text-[10px] text-gray-600 leading-tight">
                    {employee.primaryDepartment}
                  </p>

                  {hasDirectReports && (
                    <p className="text-[10px] text-blue-600 mt-1">
                      {employee.directReports.length} Report{employee.directReports.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Expand/Collapse Button */}
                {hasFilteredReports && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(employee.id)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronLeft className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Direct Reports - positioned to the right */}
        {hasFilteredReports && isExpanded && (
          <div className="flex items-center">
            {/* Horizontal connector to children */}
            <div className="w-8 h-px bg-gray-400"></div>

            {/* Children container with vertical line */}
            <div className="relative">
              {/* Vertical line connecting children */}
              {filteredReports.length > 1 && (
                <div
                  className="absolute left-0 w-px bg-gray-400"
                  style={{
                    top: '50%',
                    height: `calc(100% - 40px)`,
                    transform: 'translateY(-50%)'
                  }}
                ></div>
              )}

              {/* Children stacked vertically */}
              <div className="flex flex-col space-y-4">
                {filteredReports.map((report, index) => (
                  <EmployeeBox
                    key={report.id}
                    employee={report}
                    level={level + 1}
                    isFirst={index === 0}
                    isLast={index === filteredReports.length - 1}
                    siblingCount={filteredReports.length}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3))
  const handleReset = () => setZoom(1)
  const handleFullscreen = () => setIsFullscreen(!isFullscreen)

  // Keyboard shortcuts
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

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const filteredHierarchy = data.hierarchy.filter(filterEmployee)

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-6' : ''}`}>
      {/* Header with Search and Controls */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Chart</h2>
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

        {/* Controls */}
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
          </div>

          <div className="text-xs text-gray-400 hidden sm:block">
            +/- to zoom • ESC to exit fullscreen • Click arrows to expand/collapse
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

      {/* Hierarchical Chart - Horizontal Layout */}
      <div className={`bg-white rounded-lg border p-6 overflow-auto ${isFullscreen ? 'flex-1' : ''}`}>
        {filteredHierarchy.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className={`${isFullscreen ? 'min-h-full' : 'min-h-[600px]'} bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-8 overflow-auto`}>
            <div
              className="inline-flex flex-col space-y-8 transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            >
              {filteredHierarchy.map(rootEmployee => (
                <EmployeeBox key={rootEmployee.id} employee={rootEmployee} level={0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HierarchicalOrgChart
