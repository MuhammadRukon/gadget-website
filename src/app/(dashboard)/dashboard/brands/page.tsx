'use client';

import { useState } from 'react';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { StatusOptions } from '@/constants';

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
import { ImageUpload } from '@/components/ui/image-upload';
import { Alert } from '@/app/components/alert/alert';
import { columns } from './table';
import { brandFormSchema, defaultBrandFormValues } from '@/shared/schemas/brand-form';

export default function Page() {
  const { brands, setEditBrand, editBrand } = useBrandStore();
  // NOTE: this is used to refetch the brands data when the page is mounted.
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getBrands } = useBrandQuery();
  const { createBrand, updateBrand, removeBrand } = useBrandMutation();

  const form = useForm<z.infer<typeof brandFormSchema>>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: defaultBrandFormValues,
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
      form.reset(defaultBrandFormValues);
    }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    if (editBrand != null) {
      setEditBrand(null);
    }
    form.reset(defaultBrandFormValues);
  }

  async function onSubmit(values: z.infer<typeof brandFormSchema>) {
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

  return (
    <>
      {brands?.length > 0 && (
        <DataTable
          OpenModal={OpenModal}
          data={brands}
          AddButtonText="Add Brand"
          columns={columns(OpenModal, handleDelete)}
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
