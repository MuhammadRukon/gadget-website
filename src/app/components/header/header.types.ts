import { IHeaderButton } from '@/interfaces';

export type HeaderSearchProps = {
  search: string;
  setSearch: (search: string) => void;
};

export type HeaderButtonsProps = {
  headerButtons: IHeaderButton[];
};
