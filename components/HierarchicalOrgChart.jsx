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
  ChevronDown,
  ChevronUp
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

  const EmployeeBox = ({ employee, level = 0, isLast = false }) => {
    const hasDirectReports = employee.directReports && employee.directReports.length > 0
    const isExpanded = expandedNodes.has(employee.id)
    const filteredReports = hasDirectReports ? employee.directReports.filter(filterEmployee) : []
    const hasFilteredReports = filteredReports.length > 0

    if (!filterEmployee(employee)) {
      return null
    }

    return (
      <div className="flex flex-col items-center">
        {/* Employee Box */}
        <div className="relative mb-6">
          {/* Connection lines to parent */}
          {level > 0 && (
            <>
              {/* Vertical line from above */}
              <div className="absolute -top-6 left-1/2 w-px h-6 bg-gray-400 transform -translate-x-1/2"></div>
            </>
          )}

          {/* Employee Card */}
          <Card
            className="w-64 shadow-lg border-2 hover:shadow-xl transition-all duration-200"
            style={{ borderColor: employee.departmentColor }}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="h-12 w-12 border-2"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    <AvatarFallback
                      className="text-sm font-bold text-white"
                      style={{ backgroundColor: employee.departmentColor }}
                    >
                      {employee.avatar}
                    </AvatarFallback>
                  </Avatar>

                  {/* Role Icon */}
                  <div
                    className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow border"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    {getRoleIcon(employee.primaryRole)}
                  </div>
                </div>

                {/* Employee Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">
                    {employee.firstName} {employee.lastName}
                  </h3>

                  <Badge
                    variant="outline"
                    className="text-xs mb-2"
                    style={{
                      borderColor: employee.departmentColor,
                      color: employee.departmentColor
                    }}
                  >
                    {employee.primaryRole}
                  </Badge>

                  <p className="text-xs text-gray-600 mb-1">
                    {employee.primaryDepartment}
                  </p>

                  <p className="text-xs text-gray-500 truncate">
                    {employee.email}
                  </p>

                  {hasDirectReports && (
                    <p className="text-xs text-blue-600 mt-2">
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
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Connection line to children */}
          {hasFilteredReports && isExpanded && (
            <div className="absolute -bottom-6 left-1/2 w-px h-6 bg-gray-400 transform -translate-x-1/2"></div>
          )}
        </div>

        {/* Direct Reports */}
        {hasFilteredReports && isExpanded && (
          <div className="relative">
            {/* Horizontal line for multiple children */}
            {filteredReports.length > 1 && (
              <div
                className="absolute top-0 bg-gray-400 h-px"
                style={{
                  left: `${(64 * filteredReports.length) / -2 + 128}px`,
                  width: `${64 * filteredReports.length - 128}px`
                }}
              ></div>
            )}

            {/* Children */}
            <div className="flex justify-center items-start space-x-16">
              {filteredReports.map((report, index) => (
                <EmployeeBox
                  key={report.id}
                  employee={report}
                  level={level + 1}
                  isLast={index === filteredReports.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5))
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

      {/* Hierarchical Chart */}
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
              className="flex flex-col items-center space-y-8 transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
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