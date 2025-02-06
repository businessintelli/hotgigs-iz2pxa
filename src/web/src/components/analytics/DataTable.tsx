import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MetricsData, MetricDimension } from '../../types/analytics';
import { useAnalytics } from '../../lib/hooks/useAnalytics';
import { PAGINATION_DEFAULTS } from '../../config/constants';

// Component Props Interface
interface DataTableProps {
  data: MetricsData[];
  config: {
    enableSorting?: boolean;
    enableFiltering?: boolean;
    enableVirtualization?: boolean;
    enableSelection?: boolean;
    enableExport?: boolean;
    pageSize?: number;
    height?: string;
  };
  onSort?: (sortState: SortingState) => void;
  onFilter?: (columnId: string, value: string) => void;
  onExport?: (selectedRows: MetricsData[]) => void;
  'aria-label'?: string;
}

// Utility function for metric value formatting
const formatMetricValue = (value: number, dimension: MetricDimension): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: dimension === MetricDimension.SOURCE ? 'percent' : 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
};

export const DataTable: React.FC<DataTableProps> = ({
  data,
  config = {},
  onSort,
  onFilter,
  onExport,
  'aria-label': ariaLabel,
}) => {
  // Default configuration
  const {
    enableSorting = true,
    enableFiltering = true,
    enableVirtualization = true,
    enableSelection = false,
    enableExport = true,
    pageSize = PAGINATION_DEFAULTS.PAGE_SIZE,
    height = '600px',
  } = config;

  // State management
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Define table columns
  const columns = useMemo<ColumnDef<MetricsData>[]>(() => [
    enableSelection && {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Select row ${row.index}`}
        />
      ),
      size: 40,
    },
    {
      accessorKey: 'metric_name',
      header: 'Metric',
      cell: info => info.getValue(),
      sortingFn: 'alphanumeric',
      filterFn: 'includesString',
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: info => formatMetricValue(info.getValue() as number, info.row.original.dimension),
      sortingFn: 'basic',
    },
    {
      accessorKey: 'dimension',
      header: 'Dimension',
      cell: info => info.getValue(),
      sortingFn: 'alphanumeric',
      filterFn: 'includesString',
    },
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: info => new Date(info.getValue() as string).toLocaleString(),
      sortingFn: 'datetime',
    },
  ].filter(Boolean) as ColumnDef<MetricsData>[], [enableSelection]);

  // Initialize table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection: enableSelection ? rowSelection : {},
    },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Setup virtualization
  const { rows } = table.getRowModel();
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: enableVirtualization ? rows.length : Math.min(rows.length, pageSize),
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 48, []),
    overscan: 10,
  });

  // Handle sorting changes
  useEffect(() => {
    if (onSort) {
      onSort(sorting);
    }
  }, [sorting, onSort]);

  // Handle filter changes
  const handleFilterChange = useCallback((columnId: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [columnId]: value }));
    if (onFilter) {
      onFilter(columnId, value);
    }
  }, [onFilter]);

  // Handle export
  const handleExport = useCallback(() => {
    if (onExport && enableSelection) {
      const selectedRows = rows.filter((row, index) => rowSelection[index]);
      onExport(selectedRows.map(row => row.original));
    }
  }, [rows, rowSelection, onExport, enableSelection]);

  return (
    <div className="w-full" role="region" aria-label={ariaLabel || "Analytics data table"}>
      {/* Table Controls */}
      <div className="flex justify-between items-center mb-4">
        {enableFiltering && (
          <div className="flex gap-4">
            {table.getAllColumns()
              .filter(column => column.getCanFilter())
              .map(column => (
                <input
                  key={column.id}
                  type="text"
                  value={columnFilters[column.id] || ''}
                  onChange={e => handleFilterChange(column.id, e.target.value)}
                  placeholder={`Filter ${column.id}...`}
                  className="px-2 py-1 border rounded"
                  aria-label={`Filter by ${column.id}`}
                />
              ))}
          </div>
        )}
        {enableExport && (
          <button
            onClick={handleExport}
            disabled={!Object.keys(rowSelection).length}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            aria-label="Export selected rows"
          >
            Export Selected
          </button>
        )}
      </div>

      {/* Table Container */}
      <div
        ref={parentRef}
        className="border rounded overflow-auto"
        style={{ height }}
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left border-b"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-2 ${
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() && (
                          <span>
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
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
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className={`
                    ${virtualRow.index % 2 ? 'bg-gray-50' : 'bg-white'}
                    ${row.getIsSelected() ? 'bg-blue-100' : ''}
                  `}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 border-b"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;