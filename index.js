import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { sequelize, connectDatabase } from './services/database.js';
import News from './models/News.js';
import AdminSettings from './models/AdminSettings.js';
import { fetchAniListNews } from './services/anilist.js';
import { fetchANNNews } from './services/ann.js';
import { fetchRedditNews } from './services/reddit.js';
import { translateAndCategorize } from './services/translate.js';

import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
const allowedOrigins = (process.env.FRONTEND_URL || '*')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// --- Routes ---
app.get('/', (req, res) => {
  res.json({ name: 'Neko Anime News API', status: 'running', time: new Date().toISOString() });
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// --- Core aggregation workflow ---
async function runAggregationCycle() {
  console.log(`\n🔄 [${new Date().toISOString()}] Starting news aggregation cycle...`);

  try {
    const [aniListItems, annItems, redditItems] = await Promise.all([
      fetchAniListNews(),
      fetchANNNews(),
      fetchRedditNews()
    ]);

    const allItems = [...aniListItems, ...annItems, ...redditItems];
    console.log(`📥 Fetched ${allItems.length} items (AniList: ${aniListItems.length}, ANN: ${annItems.length}, Reddit: ${redditItems.length})`);

    let created = 0;
    let skipped = 0;

    for (const item of allItems) {
      if (!item.source_url || !item.original_title) {
        skipped++;
        continue;
      }

      // Deduplicate by source_url (unique constraint in DB as a safety net too)
      const exists = await News.findOne({ where: { source_url: item.source_url } });
      if (exists) {
        skipped++;
        continue;
      }

      try {
        const aiResult = await translateAndCategorize(item);

        await News.create({
          title_my: aiResult.title_my,
          original_title: item.original_title,
          summary_my: aiResult.summary_my,
          content_my: aiResult.content_my,
          image_url: item.image_url,
          source_url: item.source_url,
          source_name: item.source_name,
          category: aiResult.category,
          is_breaking: aiResult.is_breaking,
          is_trending: aiResult.is_trending,
          is_edited_by_admin: false,
          published_at: item.published_at
        });

        created++;
      } catch (itemError) {
        // Unique constraint race conditions land here too - safe to skip
        if (itemError.name === 'SequelizeUniqueConstraintError') {
          skipped++;
        } else {
          console.error(`❌ Failed to process item "${item.original_title}":`, itemError.message);
        }
      }
    }

    console.log(`✅ Cycle complete. Created: ${created}, Skipped (duplicates/invalid): ${skipped}`);
  } catch (error) {
    console.error('❌ Aggregation cycle failed:', error);
  }
}

// --- Startup ---
async function start() {
  await connectDatabase();

  // Sync schema (creates tables if they don't exist).
  // Use migrations instead of alter in real production long-term,
  // but sync is fine to get this running end-to-end quickly.
  await sequelize.sync();
  console.log('✅ Database schema synced.');

  // Ensure admin_settings row exists
  const existingSettings = await AdminSettings.findOne();
  if (!existingSettings) {
    const bcrypt = (await import('bcryptjs')).default;
    await AdminSettings.create({
      site_name: 'Neko Anime News',
      admin_password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)
    });
    console.log('✅ Initial admin_settings row created.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Neko Anime News API running on port ${PORT}`);
  });

  // Schedule the cron job (default: every 10 minutes)
  const schedule = process.env.CRON_SCHEDULE || '*/10 * * * *';
  cron.schedule(schedule, runAggregationCycle);
  console.log(`⏰ Cron scheduled: "${schedule}"`);

  // Run once immediately on startup
  runAggregationCycle();
}

start().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
