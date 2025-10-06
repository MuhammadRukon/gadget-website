'use client';

import { useState } from 'react';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { IconOptions, StatusOptions } from '@/constants';

import { slugify } from '@/app/utils/helper';

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
import { SelectAtom } from '@/app/components/select/select';

import { Alert } from '@/app/components/alert/alert';

import { columns } from './table';
import { useCategoryStore } from '@/stores/useCategory.store';
import { useCategoryQuery } from '@/hooks/category/useCategory.query';
import { useCategoryMutation } from '@/hooks/category/useCategory.mutation';
import { categoryFormSchema, defaultCategoryFormValues } from '@/shared/schemas/category-form';

export default function Page() {
  const { categories, setEditCategory, editCategory } = useCategoryStore();
  // NOTE: this is used to refetch the brands data when the page is mounted.
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getCategories } = useCategoryQuery();
  const { createCategory, updateCategory, removeCategory } = useCategoryMutation();

  const form = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaultCategoryFormValues,
  });

  const [showModal, setShowModal] = useState<boolean>(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState<boolean>(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(
    null,
  );

  function OpenModal(id?: string) {
    if (id) {
      //NOTE: categories are limited comparatively very less. so can avoid an api call for now.
      const categoryToEdit = categories.find((c) => c.id === id);
      if (!categoryToEdit) return;

      form.reset(categoryToEdit);
      setEditCategory(categoryToEdit);
    } else {
      form.reset(defaultCategoryFormValues);
    }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    if (editCategory != null) {
      setEditCategory(null);
    }
    form.reset(defaultCategoryFormValues);
  }

  async function onSubmit(values: z.infer<typeof categoryFormSchema>) {
    let response: Response;
    if (editCategory != null) {
      response = await updateCategory.mutateAsync({
        id: editCategory.id,
        payload: {
          name: values.name,
          slug: values.slug,
          status: values.status,
          icon: values.icon,
        },
      });
    } else {
      response = await createCategory.mutateAsync({ category: values });
    }

    if (response.ok) {
      closeModal();
    }
  }

  function handleDelete(id: string) {
    const category = categories.find((c) => c.id === id);
    if (category) {
      setCategoryToDelete({ id: category.id, name: category.name });
      setShowDeleteAlert(true);
    }
  }

  async function confirmDelete() {
    if (!categoryToDelete) return;

    try {
      await removeCategory.mutateAsync(categoryToDelete.id);
      setShowDeleteAlert(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  }

  function cancelDelete() {
    setShowDeleteAlert(false);
    setCategoryToDelete(null);
  }
  return (
    <>
      <DataTable
        OpenModal={OpenModal}
        data={categories}
        AddButtonText="Add Category"
        columns={columns(OpenModal, handleDelete)}
      />

      <Modal
        title={editCategory != null ? 'Edit Category' : 'Add Category'}
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
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Category Name"
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
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <SelectAtom
                      field={field}
                      type="icon"
                      options={IconOptions}
                      placeholder="Select Icon"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">{editCategory != null ? 'Edit Category' : 'Add Category'}</Button>
          </form>
        </Form>
      </Modal>
      {/* NOTE: Delete should be done by super admin only */}
      <Alert
        onConfirm={confirmDelete}
        open={showDeleteAlert}
        setOpen={cancelDelete}
        title="Delete Category"
        description={`Are you sure you want to delete "${categoryToDelete?.name}"? This action cannot be undone and will remove the category from your system.`}
        confirmText="Delete Category"
        cancelText="Cancel"
        isLoading={removeCategory.isPending}
      />
    </>
  );
}
