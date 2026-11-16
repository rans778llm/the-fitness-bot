import axios from 'axios';

/**
 * Checks if a YouTube video exists and is public using YouTube's oEmbed API.
 * Returns true if the video is valid/available, false if deleted or private.
 */
export async function isYouTubeVideoValid(videoIdOrUrl: string): Promise<boolean> {
  try {
    const videoId = extractYouTubeId(videoIdOrUrl) || videoIdOrUrl;
    if (!videoId) return false;

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await axios.get(oembedUrl, { timeout: 4000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
