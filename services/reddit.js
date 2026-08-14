import axios from 'axios';

const REDDIT_URL = 'https://www.reddit.com/r/anime/new/.json?limit=15';

export async function fetchRedditNews() {
  try {
    const response = await axios.get(REDDIT_URL, {
      timeout: 15000,
      headers: { 'User-Agent': 'NekoAnimeNews/1.0 (by /u/neko-anime-news-bot)' }
    });

    const posts = response.data?.data?.children || [];

    return posts
      .filter((post) => !post.data.stickied) // skip pinned/meta posts
      .map((post) => {
        const d = post.data;

        let imageUrl = null;
        if (d.preview?.images?.[0]?.source?.url) {
          imageUrl = d.preview.images[0].source.url.replace(/&amp;/g, '&');
        } else if (d.thumbnail && d.thumbnail.startsWith('http')) {
          imageUrl = d.thumbnail;
        }

        return {
          source_name: 'Reddit',
          original_title: d.title,
          summary: d.selftext ? d.selftext.slice(0, 500) : d.title,
          content: d.selftext || d.title,
          image_url: imageUrl,
          source_url: `https://www.reddit.com${d.permalink}`,
          published_at: new Date(d.created_utc * 1000),
          raw_genres: [],
          reddit_score: d.score
        };
      });
  } catch (error) {
    console.error('❌ Reddit fetch error:', error.message);
    return [];
  }
}
