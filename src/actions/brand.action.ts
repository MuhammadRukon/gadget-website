import { IBrandCreateOrUpdateEntity } from '@/interfaces';

export const BrandAction = {
  api(id?: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/brands';
    if (id) return `${baseUrl}/${id}`;
    return baseUrl;
  },

  async create(brand: IBrandCreateOrUpdateEntity): Promise<Response> {
    return await fetch(this.api(), {
      method: 'POST',
      body: JSON.stringify(brand),
    });
  },

  async getAll(): Promise<Response> {
    return await fetch(this.api());
  },
  //TODO:get brand by id
  //NOTE: not used for now
  // async getById(id: string): Promise<Response> {
  //   return await fetch(this.api(id));
  // },

  async update(id: string, payload: IBrandCreateOrUpdateEntity): Promise<Response> {
    return await fetch(this.api(id), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  //TODO:delete brand (soft delete/status = archive)
  async remove(id: string): Promise<Response> {
    return await fetch(this.api(id), {
      method: 'DELETE',
    });
  },
};
