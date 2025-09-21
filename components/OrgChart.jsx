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
  Mail,
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter
} from 'lucide-react'
import { Input } from '@/components/ui/input'

const OrgChart = ({ data }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All')

  useEffect(() => {
    // Auto-expand first two levels
    if (data?.hierarchy) {
      const autoExpand = new Set()
      data.hierarchy.forEach(root => {
        autoExpand.add(root.id)
        root.directReports.forEach(child => {
          autoExpand.add(child.id)
        })
      })
      setExpandedNodes(autoExpand)
    }
  }, [data])

  const toggleExpanded = (nodeId) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Admin': return <Crown className="h-4 w-4 text-yellow-500" />
      case 'Manager': return <Shield className="h-4 w-4 text-blue-500" />
      case 'Staff': return <Users className="h-4 w-4 text-green-500" />
      default: return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const EmployeeCard = ({ employee, level = 0 }) => {
    const hasDirectReports = employee.directReports && employee.directReports.length > 0
    const isExpanded = expandedNodes.has(employee.id)

    // Filter logic
    const matchesSearch = !searchTerm ||
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.primaryDepartment.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDepartment = selectedDepartment === 'All' ||
      employee.departments.includes(selectedDepartment)

    if (!matchesSearch || !matchesDepartment) {
      return null
    }

    return (
      <div className="relative">
        {/* Employee Card */}
        <div
          className={`relative mb-4 transition-all duration-300 hover:scale-105 ${
            level > 0 ? 'ml-8' : ''
          }`}
          style={{
            marginLeft: level > 0 ? `${level * 2}rem` : '0',
            animationDelay: `${level * 100}ms`
          }}
        >
          {/* Connection Lines */}
          {level > 0 && (
            <div className="absolute -left-8 top-1/2 w-8 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
          )}

          <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-white to-gray-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                {/* Avatar */}
                <div className="relative">
                  <Avatar
                    className="h-16 w-16 border-4 shadow-lg"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    <AvatarFallback
                      className="text-xl font-bold text-white"
                      style={{ backgroundColor: employee.departmentColor }}
                    >
                      {employee.avatar}
                    </AvatarFallback>
                  </Avatar>

                  {/* Role Badge */}
                  <div
                    className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md border-2"
                    style={{ borderColor: employee.departmentColor }}
                  >
                    {getRoleIcon(employee.primaryRole)}
                  </div>
                </div>

                {/* Employee Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-gray-900 truncate">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    {employee.isManager && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Manager
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Badge
                      variant="outline"
                      className="border-2"
                      style={{
                        borderColor: employee.departmentColor,
                        color: employee.departmentColor
                      }}
                    >
                      {employee.primaryRole}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{employee.primaryDepartment}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{employee.email}</span>
                  </div>

                  {/* Direct Reports Count */}
                  {hasDirectReports && (
                    <div className="mt-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600">
                        {employee.directReports.length} Direct Report{employee.directReports.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expand/Collapse Button */}
                {hasDirectReports && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpanded(employee.id)}
                    className="ml-4 hover:bg-primary hover:text-white transition-all"
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
        </div>

        {/* Direct Reports */}
        {hasDirectReports && isExpanded && (
          <div className="relative">
            {/* Vertical connection line */}
            {level === 0 && (
              <div
                className="absolute left-8 w-px bg-gradient-to-b from-gray-300 to-transparent"
                style={{
                  height: `${employee.directReports.length * 120}px`,
                  top: '-1rem'
                }}
              ></div>
            )}

            <div className="space-y-4 animate-in fade-in-50 duration-500">
              {employee.directReports.map((report, index) => (
                <div key={report.id} className="relative">
                  {/* Horizontal connection line for direct reports */}
                  {level === 0 && (
                    <div
                      className="absolute left-8 w-6 h-px bg-gray-300"
                      style={{ top: '3rem' }}
                    ></div>
                  )}
                  <EmployeeCard employee={report} level={level + 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const filteredHierarchy = data.hierarchy.filter(root => {
    const matchesSearch = !searchTerm ||
      `${root.firstName} ${root.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      root.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      root.primaryDepartment.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDepartment = selectedDepartment === 'All' ||
      root.departments.includes(selectedDepartment)

    return matchesSearch || matchesDepartment
  })

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
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

      {/* Organization Chart */}
      <div className="bg-white rounded-lg border p-6">
        {filteredHierarchy.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredHierarchy.map(rootEmployee => (
              <EmployeeCard key={rootEmployee.id} employee={rootEmployee} level={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default OrgChart