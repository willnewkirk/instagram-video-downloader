import { apiClient } from "@/lib/api-client";

import { GraphQLResponse } from "@//features/instagram/types";
import { encodeGraphqlRequestData } from "@/features/instagram/utils";

import { InstagramEndpoints } from "./constants";

const DEFAULT_HEADERS = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

export async function getPostPageHTML({
  postId,
}: {
  postId: string;
}): Promise<string> {
  const res = await apiClient.get(`${InstagramEndpoints.GetByPost}/${postId}`, {
    baseURL: "https://www.instagram.com",
    headers: {
      ...DEFAULT_HEADERS,
      'host': 'www.instagram.com',
      'referer': 'https://www.instagram.com/',
    },
  });

  const data = await res.text();
  return data;
}

export async function getPostGraphqlData({
  postId,
}: {
  postId: string;
}): Promise<GraphQLResponse> {
  const encodedData = encodeGraphqlRequestData(postId);

  const res = await apiClient.post(InstagramEndpoints.GetByGraphQL, {
    baseURL: "https://www.instagram.com",
    body: encodedData,
    headers: {
      ...DEFAULT_HEADERS,
      'content-type': 'application/x-www-form-urlencoded',
      'x-fb-friendly-name': 'PolarisPostActionLoadPostQueryQuery',
      'x-csrftoken': 'missing',
      'x-ig-app-id': '936619743392459',
      'x-requested-with': 'XMLHttpRequest',
      'origin': 'https://www.instagram.com',
      'referer': `https://www.instagram.com/p/${postId}/`,
    },
  });

  const data = await res.json();
  return data;
}
