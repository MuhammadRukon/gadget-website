'use client';

import { useEffect, useState } from 'react';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { StatusOptions } from '@/constants';

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
import SelectAtom from '@/app/components/select/select';
import { useBrandQuery } from '@/hooks/brand/useBrand.query';
import { Brand, Status } from '@prisma/client';
import { useBrandMutation } from '@/hooks/brand/useBrand.mutation';

export default function Page() {
  const [showModal, setShowModal] = useState<boolean>(false);

  //TODO: get brands from zustand store instead of hook.
  const { getBrands } = useBrandQuery();
  const [brands, setBrands] = useState<Brand[]>([]);
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = getBrands.data;
        if (!res) return;
        setBrands(res || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchBrands();
  }, [getBrands]);
  //

  const { createBrand } = useBrandMutation();

  function OpenModal() {
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    form.reset();
  }

  const formSchema = z.object({
    name: z.string().min(2).max(50),
    slug: z.string().min(2).max(50),
    status: z.enum(Status),
    imageUrl: z.string(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      status: Status.ACTIVE,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    //TODO: this is workaround to avoid image upload.
    //      Implement image upload later.
    values.imageUrl = '/banner.webp';
    const response = await createBrand.mutateAsync({ brand: values });

    if (response.ok) {
      closeModal();
    }
  }

  return (
    <>
      {brands?.length > 0 && (
        <DataTable OpenModal={OpenModal} data={brands} AddButtonText="Add Brand" />
      )}
      <Modal
        title="Add Brand"
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
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormLabel className="m-0">Image URL</FormLabel>
                  <FormControl>
                    <Input id="picture" type="file" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Add Brand</Button>
          </form>
        </Form>
      </Modal>
    </>
  );
}
