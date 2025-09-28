'use client';

import { useState } from 'react';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { StatusOptions } from '@/constants';
import { Status } from '@prisma/client';
import { slugify } from '@/app/utils/helper';

import { useBrandMutation } from '@/hooks/brand/useBrand.mutation';
import { useBrandStore } from '@/stores/useBrand.store';

import { DataTable } from '@/components/data-table';
import { Modal } from '@/app/components/modal/modal';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import SelectAtom from '@/app/components/select/select';
import { useBrandQuery } from '@/hooks/brand/useBrand.query';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import Image from 'next/image';
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
import { ColumnDef } from '@tanstack/react-table';
import { Alert } from '@/app/components/alert/alert';

export default function Page() {
  const defaultValues = { name: '', slug: '', status: Status.ACTIVE, imageUrl: '' };

  const { brands, setEditBrand, editBrand } = useBrandStore();
  // NOTE: this is used to refetch the brands data when the page is mounted.
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getBrands } = useBrandQuery();
  const { createBrand, updateBrand, removeBrand } = useBrandMutation();

  const formSchema = z.object({
    name: z.string().min(2).max(50),
    slug: z.string().min(2).max(50),
    status: z.enum(Status),
    imageUrl: z.string().min(1), // NOTE: this is required as we are using typical Input component.
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const [showModal, setShowModal] = useState<boolean>(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState<boolean>(false);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string; name: string } | null>(null);

  function OpenModal(id?: string) {
    if (id) {
      //NOTE: Brands are limited comparatively very less. so can avoid an api call for now.
      const brandToEdit = brands.find((b) => b.id === id);
      if (!brandToEdit) return;

      form.reset(brandToEdit);
      setEditBrand(brandToEdit);
    } else {
      form.reset(defaultValues);
    }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    if (editBrand != null) {
      setEditBrand(null);
    }
    form.reset(defaultValues);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // console.log('values', values);
    // TODO: this is workaround to avoid image upload.
    //      Implement image upload later.
    values.imageUrl = '/banner.webp';

    let response: Response;
    if (editBrand != null) {
      response = await updateBrand.mutateAsync({
        id: editBrand.id,
        payload: {
          imageUrl: values.imageUrl,
          name: values.name,
          slug: values.slug,
          status: values.status,
        },
      });
    } else {
      response = await createBrand.mutateAsync({ brand: values });
    }

    if (response.ok) {
      closeModal();
    }
  }

  function handleDelete(id: string) {
    const brand = brands.find((b) => b.id === id);
    if (brand) {
      setBrandToDelete({ id: brand.id, name: brand.name });
      setShowDeleteAlert(true);
    }
  }

  async function confirmDelete() {
    if (!brandToDelete) return;

    try {
      await removeBrand.mutateAsync(brandToDelete.id);
      setShowDeleteAlert(false);
      setBrandToDelete(null);
    } catch (error) {
      console.error('Failed to delete brand:', error);
    }
  }

  function cancelDelete() {
    setShowDeleteAlert(false);
    setBrandToDelete(null);
  }

  ////NOTE: Table column, data, and schema. Need to think of better way to do this.

  type BrandTableData = {
    id: string;
    slug: string;
    imageUrl: string;
    name: string;
    isPopular: boolean;
    status: Status;
    createdAt: Date;
    updatedAt: Date;
  };

  const columns: ColumnDef<BrandTableData>[] = [
    {
      accessorKey: 'imageUrl',
      header: 'Image URL',
      cell: ({ row }) => (
        <div className="w-20 h-10">
          <Image src={row.original.imageUrl} alt={row.original.name} width={100} height={100} />
        </div>
      ),
    },
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

  return (
    <>
      {brands?.length > 0 && (
        <DataTable
          OpenModal={OpenModal}
          data={brands}
          AddButtonText="Add Brand"
          columns={columns}
        />
      )}
      <Modal
        title={editBrand != null ? 'Edit Brand' : 'Add Brand'}
        isOpen={showModal}
        onChange={(bool) => {
          if (!bool) closeModal();
        }}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brand Name"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        form.setValue('slug', slugify(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="slug" {...field} disabled={true} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormLabel className="m-0">Status</FormLabel>
                  <FormControl>
                    <SelectAtom field={field} options={StatusOptions} placeholder="Select Status" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUpload
                      value={field.value}
                      onChange={field.onChange}
                      label="Brand Image"
                      maxSize={5}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit"> {editBrand != null ? 'Edit Brand' : 'Add Brand'}</Button>
          </form>
        </Form>
      </Modal>
      {/* NOTE: Delete should be done by super admin only */}
      <Alert
        onConfirm={confirmDelete}
        open={showDeleteAlert}
        setOpen={cancelDelete}
        title="Delete Brand"
        description={`Are you sure you want to delete "${brandToDelete?.name}"? This action cannot be undone and will remove the brand from your system.`}
        confirmText="Delete Brand"
        cancelText="Cancel"
        isLoading={removeBrand.isPending}
      />
    </>
  );
}
