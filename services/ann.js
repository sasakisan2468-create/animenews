import axios from 'axios';
import { parseStringPromise } from 'xml2js';

const ANN_RSS_URL = 'https://www.animenewsnetwork.com/news/rss.xml';

export async function fetchANNNews() {
  try {
    const response = await axios.get(ANN_RSS_URL, {
      timeout: 15000,
      headers: { 'User-Agent': 'NekoAnimeNews/1.0 (news aggregator bot)' }
    });

    const parsed = await parseStringPromise(response.data, {
      trim: true,
      explicitArray: true
    });

    const items = parsed?.rss?.channel?.[0]?.item || [];

    return items.map((item) => {
      const title = item.title?.[0] || 'Untitled';
      const link = item.link?.[0] || '';
      const description = item.description?.[0] || '';
      const pubDate = item.pubDate?.[0];

      // ANN sometimes embeds an <img> tag inside the description
      let imageUrl = null;
      const imgMatch = description.match(/<img[^>]+src="([^">]+)"/i);
      if (imgMatch) imageUrl = imgMatch[1];

      const cleanSummary = description.replace(/<[^>]*>/g, '').trim();

      return {
        source_name: 'ANN',
        original_title: title,
        summary: cleanSummary.slice(0, 500),
        content: cleanSummary,
        image_url: imageUrl,
        source_url: link,
        published_at: pubDate ? new Date(pubDate) : new Date(),
        raw_genres: []
      };
    });
  } catch (error) {
    console.error('❌ ANN RSS fetch error:', error.message);
    return [];
  }
}
