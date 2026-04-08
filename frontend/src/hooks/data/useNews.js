import { useQuery } from "@tanstack/react-query";
import { getNews } from "../../api/news.js";
import { queryKeys } from "../../lib/query.js";

export function useNews() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.news(),
    queryFn: ({ signal }) => getNews({ signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    articles: data?.articles ?? [],
    loading: isLoading,
    error: isError,
  };
}
