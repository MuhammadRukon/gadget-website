import { IHeaderButton } from '@/app/interface';

export type HeaderSearchProps = {
  search: string;
  setSearch: (search: string) => void;
};

export type HeaderButtonsProps = {
  headerButtons: IHeaderButton[];
};
