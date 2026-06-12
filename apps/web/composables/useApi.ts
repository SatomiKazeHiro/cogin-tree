export const useApi = () => {
  const config = useRuntimeConfig();
  const token = useCookie('skill-token');

  async function api<T = unknown>(
    path: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`;
    }

    const response = await $fetch<{ code: number; data: T; message?: string } | T>(
      `${config.public.apiBaseUrl}${path}`,
      {
        ...options,
        headers,
      },
    );

    if (response && typeof response === 'object' && 'data' in response) {
      return response.data as T;
    }

    return response as T;
  }

  return { api };
};
