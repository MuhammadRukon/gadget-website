import { ICategoryCreateOrUpdateEntity } from '@/interfaces';

export const CategoryAction = {
  api(id?: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/categories';
    if (id) return `${baseUrl}/${id}`;
    return baseUrl;
  },

  async create(category: ICategoryCreateOrUpdateEntity): Promise<Response> {
    return await fetch(this.api(), {
      method: 'POST',
      body: JSON.stringify(category),
    });
  },

  async getAll(): Promise<Response> {
    return await fetch(this.api());
  },
  //TODO:get category by id
  //NOTE: not used for now
  // async getById(id: string): Promise<Response> {
  //   return await fetch(this.api(id));
  // },

  async update(id: string, payload: ICategoryCreateOrUpdateEntity): Promise<Response> {
    return await fetch(this.api(id), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  //TODO:delete category (soft delete/status = archive)
  async remove(id: string): Promise<Response> {
    return await fetch(this.api(id), {
      method: 'DELETE',
    });
  },
};
