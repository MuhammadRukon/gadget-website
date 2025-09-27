// Example: How to use the generic DataTable component for different entities

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import {
  BrandTableData,
  CategoryTableData,
  ProductTableData,
  UserTableData,
} from '@/types/table.types';
import { Status } from '@prisma/client';

// Example 1: Brand Table
export function BrandTableExample({
  brands,
  onEdit,
}: {
  brands: BrandTableData[];
  onEdit: (id?: string) => void;
}) {
  const brandColumns: ColumnDef<BrandTableData>[] = [
    {
      accessorKey: 'name',
      header: 'Brand Name',
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    // ... other columns
  ];

  return (
    <DataTable data={brands} columns={brandColumns} OpenModal={onEdit} AddButtonText="Add Brand" />
  );
}

// Example 2: Category Table
export function CategoryTableExample({
  categories,
  onEdit,
}: {
  categories: CategoryTableData[];
  onEdit: (id?: string) => void;
}) {
  const categoryColumns: ColumnDef<CategoryTableData>[] = [
    {
      accessorKey: 'name',
      header: 'Category Name',
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    // ... other columns
  ];

  return (
    <DataTable
      data={categories}
      columns={categoryColumns}
      OpenModal={onEdit}
      AddButtonText="Add Category"
    />
  );
}

// Example 3: Product Table
export function ProductTableExample({
  products,
  onEdit,
}: {
  products: ProductTableData[];
  onEdit: (id?: string) => void;
}) {
  const productColumns: ColumnDef<ProductTableData>[] = [
    {
      accessorKey: 'name',
      header: 'Product Name',
    },
    {
      accessorKey: 'priceCents',
      header: 'Price',
      cell: ({ row }) => `$${(row.original.priceCents / 100).toFixed(2)}`,
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
    },
    // ... other columns
  ];

  return (
    <DataTable
      data={products}
      columns={productColumns}
      OpenModal={onEdit}
      AddButtonText="Add Product"
    />
  );
}

// Example 4: User Table
export function UserTableExample({
  users,
  onEdit,
}: {
  users: UserTableData[];
  onEdit: (id?: string) => void;
}) {
  const userColumns: ColumnDef<UserTableData>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'firstName',
      header: 'First Name',
    },
    {
      accessorKey: 'lastName',
      header: 'Last Name',
    },
    // ... other columns
  ];

  return (
    <DataTable data={users} columns={userColumns} OpenModal={onEdit} AddButtonText="Add User" />
  );
}

// Example 5: Generic Table Factory
export function createGenericTable<T extends { id: string }>(
  columns: ColumnDef<T>[],
  addButtonText: string,
) {
  return function GenericTable({ data, onEdit }: { data: T[]; onEdit: (id?: string) => void }) {
    return (
      <DataTable data={data} columns={columns} OpenModal={onEdit} AddButtonText={addButtonText} />
    );
  };
}

// Usage of the factory:
// const MyCustomTable = createGenericTable(myColumns, "Add Custom Item");
