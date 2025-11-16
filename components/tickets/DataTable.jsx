'use client'

import { useState, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function DataTable({
  columns,
  data,
  searchPlaceholder = 'Search...',
  onRowClick,
  isLoading = false,
  emptyMessage = 'No results found.',
  enableColumnVisibility = true,
  enableGlobalFilter = true,
  rowHeight = 56,
  className,
}) {
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')

  const tableContainerRef = useRef(null)

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSorting: true,
    enableFilters: true,
  })

  const { rows } = table.getRowModel()

  // Virtualization for performance with large datasets
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    getScrollElement: () => tableContainerRef.current,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between py-4 px-4 bg-white border-b">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          {enableGlobalFilter && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id.replace(/([A-Z])/g, ' $1').trim()}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="text-sm text-gray-500">
            {rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}
          </div>
        </div>
      </div>

      {/* Table Container with Virtualization */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto bg-white"
        style={{ contain: 'strict' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="text-sm text-gray-500">Loading tickets...</span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-500">{emptyMessage}</p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium text-gray-600 text-sm border-b bg-gray-50"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            header.column.getCanSort() &&
                              'cursor-pointer select-none hover:text-gray-900'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <span className="ml-1">
                              {{
                                asc: <ChevronUp className="h-4 w-4" />,
                                desc: <ChevronDown className="h-4 w-4" />,
                              }[header.column.getIsSorted()] ?? (
                                <ChevronsUpDown className="h-4 w-4 text-gray-400" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]
                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={(node) => rowVirtualizer.measureElement(node)}
                    className={cn(
                      'border-b transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-blue-50',
                      virtualRow.index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    )}
                    onClick={() => onRowClick?.(row.original)}
                    style={{ height: `${rowHeight}px` }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 align-middle text-sm"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
