import { IProductCreateOrUpdateEntity } from '@/interfaces';

export const ProductAction = {
  api(id?: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/products';
    if (id) return `${baseUrl}/${id}`;
    return baseUrl;
  },

  async create(product: IProductCreateOrUpdateEntity): Promise<Response> {
    return await fetch(this.api(), {
      method: 'POST',
      body: JSON.stringify(product),
    });
  },

  async getAll(): Promise<Response> {
    return await fetch(this.api());
  },
  //TODO:get product by id
  //NOTE: not used for now
  // async getById(id: string): Promise<Response> {
  //   return await fetch(this.api(id));
  // },

  async update(id: string, payload: IProductCreateOrUpdateEntity): Promise<Response> {
    return await fetch(this.api(id), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  //TODO:delete product (soft delete/status = archive)
  async remove(id: string): Promise<Response> {
    return await fetch(this.api(id), {
      method: 'DELETE',
    });
  },
};
