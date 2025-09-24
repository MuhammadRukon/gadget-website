'use client';

import { DataTable } from '@/components/data-table';
import { data } from '../../../../../public/data';
import { useState } from 'react';
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
import { useForm } from 'react-hook-form';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Status } from '@/generated/prisma';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Page() {
  const [showModal, setShowModal] = useState<boolean>(false);

  function OpenModal() {
    setShowModal(true);
  }

  const slugify = (value: string) => value.trim().replace(/\s+/g, '-');

  const formSchema = z.object({
    name: z.string().min(2).max(50),
    slug: z.string().min(2).max(50),
    isPopular: z.boolean(),
    status: z.enum(Status),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      isPopular: false,
      status: Status.ACTIVE,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // form.reset();
  }

  return (
    <>
      <DataTable OpenModal={OpenModal} data={data} AddButtonText="Add Brand" />
      <Modal
        title="Add Brand"
        isOpen={showModal}
        onChange={(value) => {
          setShowModal(value);
          if (!value) form.reset();
        }}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <>
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
                </>
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
              name="isPopular"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormLabel className="m-0">Is Popular</FormLabel>
                  <FormControl>
                    {/* TODO: fix this input mismatch*/}
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={Status.ACTIVE}>Active</SelectItem>
                        <SelectItem value={Status.INACTIVE}>Inactive</SelectItem>
                        <SelectItem value={Status.ARCHIVED}>Archived</SelectItem>
                      </SelectContent>
                    </Select>
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
