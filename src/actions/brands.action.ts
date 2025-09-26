import { Brand } from '@prisma/client';
import { IBrandCreateEntity } from '@/interfaces';

export const BrandsAction = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
  async create(brand: IBrandCreateEntity): Promise<Response> {
    return await fetch(`${this.baseUrl}/api/brands`, {
      method: 'POST',
      body: JSON.stringify(brand),
    });
  },

  async getAll(): Promise<Response> {
    return await fetch(`${this.baseUrl}/api/brands`);
  },
  //TODO:get brand by id
  async getById(id: string): Promise<Response> {
    return await fetch(`${this.baseUrl}/api/brands/${id}`);
  },
  //TODO:update brand
  async update(id: string, payload: Brand) {
    return await fetch(`${this.baseUrl}/api/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  //TODO:delete brand (soft delete/status = archive)
  async remove(id: string): Promise<Response> {
    return await fetch(`${this.baseUrl}/api/brands/${id}`, {
      method: 'DELETE',
    });
  },
};
