import type { Brand } from '@prisma/client';
import { IBrandCreateEntity } from '@/interfaces';

export const BrandsAction = {
  api(id?: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/brands';
    if (id) return `${baseUrl}/${id}`;
    return baseUrl;
  },

  async create(brand: IBrandCreateEntity): Promise<Response> {
    return await fetch(this.api(), {
      method: 'POST',
      body: JSON.stringify(brand),
    });
  },

  async getAll(): Promise<Response> {
    return await fetch(this.api());
  },
  //TODO:get brand by id
  async getById(id: string): Promise<Response> {
    return await fetch(this.api(id));
  },
  //TODO:update brand
  async update(id: string, payload: Brand): Promise<Response> {
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
