'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import SidebarLayout from '../../components/SidebarLayout'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  BarChart3,
  Filter,
  Download,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Target,
  Shield,
  Smile,
  Star
} from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ReportsPage() {
  const { user, makeAuthenticatedRequest } = useAuth()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [timePeriod, setTimePeriod] = useState('daily')
  const [timeRange, setTimeRange] = useState('30')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    priority: 'all',
    status: 'all',
    agent: 'all',
    category: 'all'
  })
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    pending: 0,
    solved: 0
  })
  const [satisfactionMetrics, setSatisfactionMetrics] = useState(null)
  const [satisfactionPeriod, setSatisfactionPeriod] = useState('7d')

  // Only agents and admins can access reports
  const userRoleNames = user?.roles?.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || []
  const hasAccess = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

  useEffect(() => {
    if (hasAccess) {
      fetchAnalyticsData()
      fetchStats()
      fetchSatisfactionMetrics()
    }
  }, [hasAccess, timePeriod, timeRange])

  useEffect(() => {
    if (hasAccess) {
      fetchSatisfactionMetrics()
    }
  }, [satisfactionPeriod, hasAccess])

  const fetchAnalyticsData = async () => {
    if (!hasAccess) return

    try {
      setLoading(true)

      // Convert "all" values to empty strings for backend
      const backendFilters = {
        period: timePeriod,
        range: timeRange,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        priority: filters.priority === 'all' ? '' : filters.priority,
        status: filters.status === 'all' ? '' : filters.status,
        agent: filters.agent === 'all' ? '' : filters.agent,
        category: filters.category === 'all' ? '' : filters.category
      }

      const queryParams = new URLSearchParams(backendFilters).toString()
      const response = await makeAuthenticatedRequest(`/api/reports/analytics?${queryParams}`)

      if (response.ok) {
        const data = await response.json()
        // console.log('Analytics data received:', data)
        // console.log('Priority breakdown:', data.priorityBreakdown)
        // console.log('Priority breakdown length:', data.priorityBreakdown?.length)
        setAnalytics(data)
      } else {
        // console.error('Analytics request failed:', response.status, response.statusText)
      }
    } catch (error) {
      // console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      // console.error('Failed to fetch stats:', error)
    }
  }

  const fetchSatisfactionMetrics = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/satisfaction-metrics?period=${satisfactionPeriod}`)
      if (response.ok) {
        const data = await response.json()
        setSatisfactionMetrics(data)
      }
    } catch (error) {
      // console.error('Failed to fetch satisfaction metrics:', error)
    }
  }

  const exportToExcel = () => {
    if (!analytics) {
      toast.error("No analytics data available to export. Please wait for the report to load.")
      return
    }

    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new()

      // Summary Sheet
      const summaryData = [
        ['Helpdesk Analytics Report'],
        ['Generated:', new Date().toLocaleString()],
        ['Period:', timePeriod],
        ['Range:', timeRange],
        [''],
        ['Summary Statistics'],
        ['Total Tickets:', stats.total],
        ['Open Tickets:', stats.open],
        ['Pending Tickets:', stats.pending],
        ['Solved Tickets:', stats.solved]
      ]
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary')

      // Ticket Trends Sheet
      if (analytics.ticketTrends && analytics.ticketTrends.length > 0) {
        const trendsData = [
          ['Date', 'Period', 'Created Tickets', 'Resolved Tickets']
        ]
        analytics.ticketTrends.forEach(trend => {
          trendsData.push([
            trend.date,
            trend.displayLabel || trend.date,
            trend.created,
            trend.resolved
          ])
        })
        const trendsWS = XLSX.utils.aoa_to_sheet(trendsData)
        XLSX.utils.book_append_sheet(wb, trendsWS, 'Ticket Trends')
      }

      // Agent Performance Sheet
      if (analytics.agentPerformance && analytics.agentPerformance.length > 0) {
        const performanceData = [
          ['Agent Name', 'Assigned Tickets', 'Resolved Tickets', 'Resolution Rate %']
        ]
        analytics.agentPerformance.forEach(agent => {
          const resolutionRate = agent.assigned > 0 ? ((agent.resolved / agent.assigned) * 100).toFixed(1) : '0'
          performanceData.push([
            agent.name,
            agent.assigned,
            agent.resolved,
            resolutionRate
          ])
        })
        const performanceWS = XLSX.utils.aoa_to_sheet(performanceData)
        XLSX.utils.book_append_sheet(wb, performanceWS, 'Agent Performance')
      }

      // Priority Distribution Sheet
      if (analytics.priorityBreakdown && analytics.priorityBreakdown.length > 0) {
        const priorityData = [
          ['Priority Level', 'Number of Tickets', 'Percentage']
        ]
        const total = analytics.priorityBreakdown.reduce((sum, p) => sum + p.count, 0)
        analytics.priorityBreakdown.forEach(priority => {
          const percentage = total > 0 ? ((priority.count / total) * 100).toFixed(1) : '0'
          priorityData.push([
            priority.priority,
            priority.count,
            percentage + '%'
          ])
        })
        const priorityWS = XLSX.utils.aoa_to_sheet(priorityData)
        XLSX.utils.book_append_sheet(wb, priorityWS, 'Priority Distribution')
      }

      // Category Breakdown Sheet
      if (analytics.categoryBreakdown && analytics.categoryBreakdown.length > 0) {
        const categoryData = [
          ['Category', 'Number of Tickets', 'Percentage']
        ]
        const total = analytics.categoryBreakdown.reduce((sum, c) => sum + c.count, 0)
        analytics.categoryBreakdown.forEach(category => {
          const percentage = total > 0 ? ((category.count / total) * 100).toFixed(1) : '0'
          categoryData.push([
            category.category,
            category.count,
            percentage + '%'
          ])
        })
        const categoryWS = XLSX.utils.aoa_to_sheet(categoryData)
        XLSX.utils.book_append_sheet(wb, categoryWS, 'Category Breakdown')
      }

      // SLA Compliance Sheet
      if (analytics.slaCompliance && analytics.slaCompliance.length > 0) {
        const slaData = [
          ['Date', 'SLA Compliance %']
        ]
        analytics.slaCompliance.forEach(sla => {
          slaData.push([
            sla.date,
            sla.compliance + '%'
          ])
        })
        const slaWS = XLSX.utils.aoa_to_sheet(slaData)
        XLSX.utils.book_append_sheet(wb, slaWS, 'SLA Compliance')
      }

      // Response Times Sheet
      if (analytics.responseTimes && analytics.responseTimes.length > 0) {
        const responseData = [
          ['Date', 'Average Resolution Time (Hours)', 'Ticket Count']
        ]
        analytics.responseTimes.forEach(response => {
          responseData.push([
            response.date,
            response.avgHours,
            response.ticketCount
          ])
        })
        const responseWS = XLSX.utils.aoa_to_sheet(responseData)
        XLSX.utils.book_append_sheet(wb, responseWS, 'Response Times')
      }

      // Export the file
      const fileName = `helpdesk-analytics-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

      toast.success(`Analytics data exported to ${fileName}. You can now create charts in Excel using this data.`)
    } catch (error) {
      // console.error('Export error:', error)
      toast.error("Failed to export analytics data. Please try again.")
    }
  }

  if (!hasAccess) {
    return (
      <SidebarLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <Card className="w-full max-w-md">
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
                  You need Staff privileges or higher to access reports.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarLayout>
    )
  }

  // Color schemes for charts
  const COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // green
    '#8b5cf6', // purple
    '#f97316', // orange
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f43f5e', // rose
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#a855f7', // violet
    '#eab308', // yellow
    '#22c55e', // emerald
    '#64748b'  // slate
  ]
  const priorityColors = {
    'URGENT': '#ef4444',
    'HIGH': '#f59e0b',
    'NORMAL': '#3b82f6',
    'LOW': '#10b981'
  }

  // Debug logging
  // console.log('Reports page render:', {
  //   hasAccess,
  //   loading,
  //   analytics: analytics ? 'exists' : 'null',
  //   priorityBreakdown: analytics?.priorityBreakdown,
  //   user: user ? `${user.firstName} ${user.lastName}` : 'null'
  // })

  return (
    <SidebarLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              Reports
            </h1>
            <p className="text-muted-foreground mt-1">Analytics and insights for your helpdesk</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowFilters(true)}>
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{loading ? '...' : stats.total}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">↗ All time</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{loading ? '...' : stats.open}</div>
              <p className="text-xs text-muted-foreground">
                Needs attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{loading ? '...' : stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Waiting for response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{loading ? '...' : stats.solved}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">↗ Resolution rate</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Ticket Trends */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Ticket Trends
                    </CardTitle>
                    <CardDescription>
                      Created vs Resolved tickets - {timePeriod === 'daily' ? 'Daily' : timePeriod === 'weekly' ? 'Weekly' : timePeriod === 'monthly' ? 'Monthly' : 'Yearly'} view
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7</SelectItem>
                        <SelectItem value="14">14</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="60">60</SelectItem>
                        <SelectItem value="90">90</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics?.ticketTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="displayLabel"
                      tick={{ fontSize: 11 }}
                      angle={timePeriod === 'weekly' ? -45 : 0}
                      textAnchor={timePeriod === 'weekly' ? 'end' : 'middle'}
                      height={timePeriod === 'weekly' ? 60 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Number of Tickets', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      labelFormatter={(value) => `${analytics?.ticketTrends?.[0]?.period || 'Period'}: ${value}`}
                      formatter={(value, name) => [value, `${name} Tickets`]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="created"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      name="Created"
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="resolved"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Resolved"
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Agent Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Agent Performance
                </CardTitle>
                <CardDescription>Tickets assigned vs resolved (last 7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.agentPerformance?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.agentPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="assigned" fill="#3b82f6" name="Assigned" />
                      <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Performance metrics coming soon</p>
                      <p className="text-sm">Data will appear once agents start resolving tickets</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Response Times (MTTR) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Response Times (MTTR)
                </CardTitle>
                <CardDescription>Mean Time to Resolution over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics?.responseTimes || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value, name) => [`${value}h`, 'Avg Resolution Time']}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgHours"
                      stroke="#f59e0b"
                      fill="#fbbf24"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Category Breakdown
                </CardTitle>
                <CardDescription>Distribution of tickets by category (last 30 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="category"
                        >
                          {analytics.categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} tickets`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No category data available</p>
                      <p className="text-sm">
                        {analytics ?
                          `Analytics loaded but no categories (${analytics.categoryBreakdown?.length || 0} items)` :
                          'Analytics data not loaded yet'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Priority Distribution
                </CardTitle>
                <CardDescription>Tickets by priority level (last 30 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : analytics?.priorityBreakdown?.length > 0 ? (
                  <div>
                    <div className="mb-4 text-sm text-gray-600">
                      Found {analytics.priorityBreakdown.length} priority levels: {
                        analytics.priorityBreakdown.map(p => `${p.priority}(${p.count})`).join(', ')
                      }
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.priorityBreakdown} layout="vertical" margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="priority" type="category" tick={{ fontSize: 12 }} width={80} />
                        <Tooltip formatter={(value, name) => [`${value} tickets`, name]} />
                        <Bar
                          dataKey="count"
                          radius={[0, 4, 4, 0]}
                        >
                          {analytics.priorityBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={priorityColors[entry.priority] || '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No priority data available</p>
                      <p className="text-sm">
                        {analytics ?
                          `Analytics loaded but no priority breakdown (${analytics.priorityBreakdown?.length || 0} items)` :
                          'Analytics data not loaded yet'
                        }
                      </p>
                      {analytics && (
                        <div className="mt-2 text-xs text-left bg-gray-100 p-2 rounded">
                          <pre>{JSON.stringify(analytics.priorityBreakdown, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SLA Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  SLA Compliance
                </CardTitle>
                <CardDescription>Service Level Agreement compliance rate (last 7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.slaCompliance?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.slaCompliance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        domain={[0, 100]}
                        label={{ value: 'Compliance %', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value) => [`${value}%`, 'SLA Compliance']}
                      />
                      <Line
                        type="monotone"
                        dataKey="compliance"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>SLA compliance tracking coming soon</p>
                      <p className="text-sm">Data will appear once tickets are resolved</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overall Satisfaction Trend */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Smile className="w-5 h-5" />
                      Customer Satisfaction
                    </CardTitle>
                    <CardDescription>Average satisfaction rating over time</CardDescription>
                  </div>
                  <Select value={satisfactionPeriod} onValueChange={setSatisfactionPeriod}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem value="90d">90 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {satisfactionMetrics?.overall?.totalRatings > 0 ? (
                  <div>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {satisfactionMetrics.overall.averageRating.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600">Average Rating</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {satisfactionMetrics.overall.satisfactionPercentage.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-600">Satisfied (4-5★)</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {satisfactionMetrics.overall.totalRatings}
                        </div>
                        <div className="text-xs text-gray-600">Total Ratings</div>
                      </div>
                    </div>

                    {/* Daily Trend Chart */}
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={satisfactionMetrics.dailyMetrics.filter(d => d.averageRating !== null)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          domain={[0, 5]}
                          label={{ value: 'Rating (1-5)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          formatter={(value, name) => {
                            if (name === 'averageRating') return [`${value?.toFixed(2)} stars`, 'Average Rating']
                            return [value, name]
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="averageRating"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Smile className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No satisfaction data available yet</p>
                      <p className="text-sm">Ratings will appear once customers rate resolved tickets</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Staff Satisfaction Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Staff Performance Ratings
                </CardTitle>
                <CardDescription>
                  Average satisfaction rating per staff member ({satisfactionPeriod === '7d' ? 'last 7 days' : satisfactionPeriod === '30d' ? 'last 30 days' : satisfactionPeriod === '90d' ? 'last 90 days' : 'all time'})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {satisfactionMetrics?.staff?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={satisfactionMetrics.staff}
                      layout="vertical"
                      margin={{top: 20, right: 30, left: 20, bottom: 5}}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        domain={[0, 5]}
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Average Rating (1-5)', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis
                        dataKey="staffName"
                        type="category"
                        tick={{ fontSize: 12 }}
                        width={120}
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'averageRating') return [`${value?.toFixed(2)} stars`, 'Average Rating']
                          if (name === 'totalRatings') return [value, 'Total Ratings']
                          return [value, name]
                        }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white p-3 border rounded shadow-lg">
                                <p className="font-semibold">{data.staffName}</p>
                                <p className="text-sm text-gray-600">{data.staffEmail}</p>
                                <div className="mt-2 space-y-1">
                                  <p className="text-sm">
                                    <span className="font-medium">Rating:</span> {data.averageRating.toFixed(2)} ⭐
                                  </p>
                                  <p className="text-sm">
                                    <span className="font-medium">Total Ratings:</span> {data.totalRatings}
                                  </p>
                                  <div className="text-xs mt-2 pt-2 border-t">
                                    <div className="font-medium mb-1">Distribution:</div>
                                    {[5, 4, 3, 2, 1].map(rating => (
                                      data.distribution[rating] > 0 && (
                                        <div key={rating} className="flex justify-between">
                                          <span>{rating}★:</span>
                                          <span>{data.distribution[rating]}</span>
                                        </div>
                                      )
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar
                        dataKey="averageRating"
                        radius={[0, 4, 4, 0]}
                      >
                        {satisfactionMetrics.staff.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.averageRating >= 4.5 ? '#10b981' :
                              entry.averageRating >= 4.0 ? '#3b82f6' :
                              entry.averageRating >= 3.5 ? '#f59e0b' :
                              entry.averageRating >= 3.0 ? '#f97316' :
                              '#ef4444'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No staff ratings available yet</p>
                      <p className="text-sm">
                        {satisfactionMetrics?.overall?.totalRatings > 0
                          ? 'Staff ratings will appear once assigned tickets are rated'
                          : 'Data will appear once customers rate resolved tickets'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filter Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filter Analytics Data</DialogTitle>
            <DialogDescription>
              Apply filters to customize your analytics view
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={filters.priority} onValueChange={(value) => setFilters({...filters, priority: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                    <SelectItem value="SOLVED">Solved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="agent">Agent</Label>
                <Select value={filters.agent} onValueChange={(value) => setFilters({...filters, agent: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {analytics?.agentPerformance?.map((agent, index) => (
                      <SelectItem key={index} value={agent.name}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {analytics?.categoryBreakdown?.map((category, index) => (
                      <SelectItem key={index} value={category.category}>{category.category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    dateFrom: '',
                    dateTo: '',
                    priority: 'all',
                    status: 'all',
                    agent: 'all',
                    category: 'all'
                  })
                }}
              >
                Clear Filters
              </Button>
              <div className="text-sm text-muted-foreground">
                {Object.entries(filters).filter(([key, value]) =>
                  value && value !== 'all'
                ).length} filters active
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilters(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowFilters(false)
              // Trigger analytics refresh with filters
              fetchAnalyticsData()
              toast.success("Analytics data has been updated with your filters.")
            }}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  )
}