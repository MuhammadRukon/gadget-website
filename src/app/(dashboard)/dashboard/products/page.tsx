'use client';

import { useState } from 'react';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ProductStatusOptions } from '@/constants';

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
import { useProductMutation } from '@/hooks/product/useProduct.mutation';
import { defaultProductFormValues, productFormSchema } from '@/shared/schemas/product-form';
import { useBrandQuery } from '@/hooks/brand/useBrand.query';
import { useBrandStore } from '@/stores/useBrand.store';
import { useProductStore } from '@/stores/useProduct.store';
import { useProductQuery } from '@/hooks/product/useProduct.query';

export default function Page() {
  const { categories } = useCategoryStore();
  const { brands } = useBrandStore();
  const { products, setEditProduct, editProduct } = useProductStore();
  // NOTE: these unused vars are used to refetch the brands, categories, products data when the page is mounted.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { getCategories } = useCategoryQuery();
  const { getBrands } = useBrandQuery();
  const { getProducts } = useProductQuery();
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const { createProduct, updateProduct, removeProduct } = useProductMutation();

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultProductFormValues,
  });

  const [showModal, setShowModal] = useState<boolean>(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);

  function OpenModal(id?: string) {
    if (id) {
      //TODO: Products are not limited so fix this ASAP.
      const productToEdit = products.find((c) => c.id === id);
      if (!productToEdit) return;

      form.reset(productToEdit);
      setEditProduct(productToEdit);
    } else {
      form.reset(defaultProductFormValues);
    }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    if (editProduct != null) {
      setEditProduct(null);
    }
    form.reset(defaultProductFormValues);
  }

  async function onSubmit(values: z.infer<typeof productFormSchema>) {
    let response: Response;
    if (editProduct != null) {
      response = await updateProduct.mutateAsync({
        id: editProduct.id,
        payload: {
          name: values.name,
          slug: values.slug,
          status: values.status,
          description: values.description,
          priceCents: values.priceCents,
          discountCents: values.discountCents,
          discountPercentage: values.discountPercentage,
          imageUrls: values.imageUrls,
          stock: values.stock,
          brandId: values.brandId,
        },
      });
    } else {
      response = await createProduct.mutateAsync({ product: values });
    }

    if (response.ok) {
      closeModal();
    }
  }

  function handleDelete(id: string) {
    const product = products.find((p) => p.id === id);
    if (product) {
      setProductToDelete({ id: product.id, name: product.name });
      setShowDeleteAlert(true);
    }
  }

  async function confirmDelete() {
    if (!productToDelete) return;

    try {
      await removeProduct.mutateAsync(productToDelete.id);
      setShowDeleteAlert(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  }

  function cancelDelete() {
    setShowDeleteAlert(false);
    setProductToDelete(null);
  }
  return (
    <>
      <DataTable
        OpenModal={OpenModal}
        data={products}
        AddButtonText="Add Product"
        columns={columns(OpenModal, handleDelete)}
      />

      <Modal
        title={editProduct != null ? 'Edit Product' : 'Add Product'}
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
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Product Name"
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
            <div className="flex flex-row gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <SelectAtom
                        field={field}
                        options={ProductStatusOptions}
                        placeholder="Select Status"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Stock</FormLabel>

                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Stock"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue('stock', Number(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-row gap-4">
              <FormField
                control={form.control}
                name="priceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Price in cents"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue('priceCents', Number(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Discount in cents"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue('discountCents', Number(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Discount in percentage"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue('discountPercentage', Number(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <SelectAtom
                        field={field}
                        options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
                        placeholder="Select Brand"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* TODO: Fix this type issue ASAP. */}
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <SelectAtom
                        field={field}
                        options={categories.map((category) => ({
                          value: category.id,
                          label: category.name,
                        }))}
                        placeholder="Select Category"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit">{editProduct != null ? 'Edit Product' : 'Add Product'}</Button>
          </form>
        </Form>
      </Modal>
      {/* NOTE: Delete should be done by super admin only */}
      <Alert
        onConfirm={confirmDelete}
        open={showDeleteAlert}
        setOpen={cancelDelete}
        title="Delete Product"
        description={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone and will remove the product from your system.`}
        confirmText="Delete Product"
        cancelText="Cancel"
        isLoading={removeProduct.isPending}
      />
    </>
  );
}
