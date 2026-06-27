export interface PageHeader {
  title?: string;
  backTo?: string;
}

export function usePageHeader() {
  return useState<PageHeader>('page-header', () => ({}));
}
