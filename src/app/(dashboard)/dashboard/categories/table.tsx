import { Status } from '@prisma/client';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import {
  IconArchiveFilled,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconDotsVertical,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export type CategoryTableData = {
  id: string;
  slug: string;
  name: string;
  isPopular: boolean;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
};

export function columns(
  OpenModal: (id: string) => void,
  handleDelete: (id: string) => void,
): ColumnDef<CategoryTableData>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name (with slug)',
      cell: ({ row }) => {
        return (
          <p className="flex flex-col gap-1">
            <span>{row.original.name}</span>
            <span className="text-muted-foreground">{row.original.slug}</span>
          </p>
        );
      },
      enableHiding: false,
    },
    {
      accessorKey: 'isPopular',
      header: 'Is Popular',
      cell: ({ row }) => {
        return (
          <span className="text-foreground">
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              {row.original.isPopular ? 'Yes' : 'No'}
            </Badge>
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {row.original.status === Status.ACTIVE ? (
            <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
          ) : row.original.status === Status.INACTIVE ? (
            <IconCircleXFilled className="fill-red-500 dark:fill-red-400" />
          ) : (
            <IconArchiveFilled className="fill-gray-500 dark:fill-gray-400" />
          )}
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </Badge>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated At',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {new Date(row.original.updatedAt).toLocaleDateString()}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
            >
              <IconDotsVertical />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => OpenModal(row.original.id)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => handleDelete(row.original.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
