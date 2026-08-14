import axios from 'axios';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

// AniList doesn't have a "news" feed, so we use recently updated /
// trending anime & manga entries as news-worthy items (new episodes,
// new releases, status changes) with their cover images.
const QUERY = `
query {
  trending: Page(page: 1, perPage: 10) {
    media(sort: TRENDING_DESC, type: ANIME) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large color }
      bannerImage
      siteUrl
      status
      format
      startDate { year month day }
      updatedAt
      genres
    }
  }
}
`;

export async function fetchAniListNews() {
  try {
    const response = await axios.post(
      ANILIST_ENDPOINT,
      { query: QUERY },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    const media = response.data?.data?.trending?.media || [];

    return media.map((item) => {
      const title = item.title.english || item.title.romaji || item.title.native;
      const publishedAt = item.updatedAt
        ? new Date(item.updatedAt * 1000)
        : new Date();

      return {
        source_name: 'AniList',
        original_title: `${title} — ${item.status?.replace(/_/g, ' ') || 'Update'}`,
        summary: item.description
          ? item.description.replace(/<[^>]*>/g, '').slice(0, 500)
          : '',
        content: item.description ? item.description.replace(/<[^>]*>/g, '') : '',
        image_url: item.coverImage?.extraLarge || item.coverImage?.large || item.bannerImage || null,
        source_url: item.siteUrl,
        published_at: publishedAt,
        raw_genres: item.genres || []
      };
    });
  } catch (error) {
    console.error('❌ AniList fetch error:', error.message);
    return [];
  }
}
