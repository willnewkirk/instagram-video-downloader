import { load } from "cheerio";

import {
  getPostPageHTML,
  getPostGraphqlData,
} from "@/services/instagram/requests";

import { VideoInfo } from "@/types";
import { HTTPError } from "@/lib/errors";

import { INSTAGRAM_CONFIGS } from "./constants";
import { formatGraphqlJson, formatPageJson, getPostIdFromUrl } from "./utils";

const getVideoJsonFromHTML = async (postId: string) => {
  try {
    const data = await getPostPageHTML({ postId });
    const postHtml = load(data);
    
    // Try multiple methods to find video info
    const methods = [
      // Method 1: Meta tags
      () => {
        const videoElement = postHtml("meta[property='og:video']");
        if (videoElement.length > 0) {
          return formatPageJson(postHtml);
        }
        return null;
      },
      
      // Method 2: Shared data script
      () => {
        const sharedDataScript = postHtml("#react-root + script").html();
        if (sharedDataScript) {
          const match = sharedDataScript.match(/window\._sharedData = (.+);/);
          if (match) {
            const sharedData = JSON.parse(match[1]);
            const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
            if (media?.is_video && media?.video_url) {
              return {
                filename: `instagram-${postId}.mp4`,
                width: media.dimensions?.width?.toString() || "",
                height: media.dimensions?.height?.toString() || "",
                videoUrl: media.video_url,
              };
            }
          }
        }
        return null;
      },
      
      // Method 3: Additional script data
      () => {
        const additionalData = postHtml('script[type="application/ld+json"]').html();
        if (additionalData) {
          try {
            const jsonData = JSON.parse(additionalData);
            if (jsonData?.video?.contentUrl) {
              return {
                filename: `instagram-${postId}.mp4`,
                width: jsonData.video?.width?.toString() || "",
                height: jsonData.video?.height?.toString() || "",
                videoUrl: jsonData.video.contentUrl,
              };
            }
          } catch {
            return null;
          }
        }
        return null;
      }
    ];

    // Try each method in sequence
    for (const method of methods) {
      try {
        const result = method();
        if (result) return result;
      } catch (error) {
        console.error('Error in extraction method:', error);
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting video from HTML:', error);
    return null;
  }
};

const getVideoJSONFromGraphQL = async (postId: string) => {
  try {
    const data = await getPostGraphqlData({ postId });

    const mediaData = data.data?.xdt_shortcode_media;
    if (!mediaData) {
      console.debug('No media data in GraphQL response');
      return null;
    }

    if (!mediaData.is_video) {
      throw new HTTPError("This post is not a video", 400);
    }

    const videoInfo = formatGraphqlJson(mediaData);
    if (!videoInfo?.videoUrl) {
      console.debug('No video URL in GraphQL data');
      return null;
    }

    return videoInfo;
  } catch (error) {
    console.error('Error extracting video from GraphQL:', error);
    return null;
  }
};

export const getVideoInfo = async (postId: string) => {
  let videoInfo: VideoInfo | null = null;
  let errors: Error[] = [];

  console.log('Attempting to get video info for post:', postId);

  // Try HTML method first
  if (INSTAGRAM_CONFIGS.enableWebpage) {
    try {
      console.log('Trying HTML extraction method...');
      videoInfo = await getVideoJsonFromHTML(postId);
      if (videoInfo?.videoUrl) {
        console.log('Successfully extracted video info from HTML');
        return videoInfo;
      }
    } catch (error) {
      console.error('HTML extraction failed:', error);
      errors.push(error as Error);
    }
  }

  // Try GraphQL method second
  if (INSTAGRAM_CONFIGS.enableGraphQL) {
    try {
      console.log('Trying GraphQL extraction method...');
      videoInfo = await getVideoJSONFromGraphQL(postId);
      if (videoInfo?.videoUrl) {
        console.log('Successfully extracted video info from GraphQL');
        return videoInfo;
      }
    } catch (error) {
      console.error('GraphQL extraction failed:', error);
      errors.push(error as Error);
    }
  }

  if (errors.length > 0) {
    console.error('All video extraction methods failed:', errors);
  }

  throw new HTTPError(
    "Could not extract video information. Make sure the post is public and contains a video.",
    401
  );
};
