import { apiClient } from "@/lib/api-client";

import { GraphQLResponse } from "@//features/instagram/types";
import { encodeGraphqlRequestData } from "@/features/instagram/utils";

import { InstagramEndpoints } from "./constants";

const DEFAULT_HEADERS = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'max-age=0',
  'sec-ch-prefers-color-scheme': 'dark',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
  'sec-ch-ua-full-version-list': '"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.130"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-platform-version': '"10.0.0"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function getInitialCookies() {
  const res = await apiClient.get('/', {
    baseURL: "https://www.instagram.com",
    headers: DEFAULT_HEADERS
  });

  const setCookieHeader = res.headers.get('set-cookie');
  if (!setCookieHeader) return null;

  const cookies = setCookieHeader.split(', ');
  const csrfMatch = cookies.find(cookie => cookie.startsWith('csrftoken='));
  const csrfToken = csrfMatch ? csrfMatch.split('=')[1].split(';')[0] : null;

  return {
    cookies: setCookieHeader,
    csrfToken
  };
}

export async function getPostPageHTML({
  postId,
}: {
  postId: string;
}): Promise<string> {
  // Get initial cookies first
  const initialAuth = await getInitialCookies();
  
  const res = await apiClient.get(`${InstagramEndpoints.GetByPost}/${postId}`, {
    baseURL: "https://www.instagram.com",
    headers: {
      ...DEFAULT_HEADERS,
      'cookie': initialAuth?.cookies || '',
      'referer': 'https://www.instagram.com/',
    },
  });

  const data = await res.text();

  // Try to extract shared data
  const sharedDataMatch = data.match(/<script type="text\/javascript">window\._sharedData = (.+?);<\/script>/);
  if (!sharedDataMatch) {
    throw new Error('Could not find shared data in Instagram response');
  }

  return data;
}

export async function getPostGraphqlData({
  postId,
}: {
  postId: string;
}): Promise<GraphQLResponse> {
  // Get initial cookies first
  const initialAuth = await getInitialCookies();
  
  const encodedData = encodeGraphqlRequestData(postId);

  const res = await apiClient.post(InstagramEndpoints.GetByGraphQL, {
    baseURL: "https://www.instagram.com",
    body: encodedData,
    headers: {
      ...DEFAULT_HEADERS,
      'content-type': 'application/x-www-form-urlencoded',
      'x-asbd-id': '129477',
      'x-fb-friendly-name': 'PolarisPostActionLoadPostQueryQuery',
      'x-fb-lsd': 'AVqbxe3J_YA',
      'x-csrftoken': initialAuth?.csrfToken || 'missing',
      'x-ig-app-id': '936619743392459',
      'x-instagram-ajax': '1',
      'x-requested-with': 'XMLHttpRequest',
      'origin': 'https://www.instagram.com',
      'referer': `https://www.instagram.com/p/${postId}/`,
      'cookie': initialAuth?.cookies || '',
    },
  });

  const text = await res.text();
  
  try {
    // First try parsing as is
    return JSON.parse(text);
  } catch {
    // If that fails, try removing any prefix
    const jsonText = text.replace(/^[^{]*/g, '');
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse Instagram response:', error);
      console.debug('Response text:', text);
      throw new Error('Failed to parse Instagram response');
    }
  }
}
