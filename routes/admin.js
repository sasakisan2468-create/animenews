import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import News from '../models/News.js';
import AdminSettings from '../models/AdminSettings.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-secret-change-me';

// --- Middleware: verify admin JWT ---
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    let settings = await AdminSettings.findOne();

    // Bootstrap admin_settings row on first login using ADMIN_PASSWORD env var
    if (!settings) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
      settings = await AdminSettings.create({
        site_name: 'Neko Anime News',
        admin_password: hashed
      });
    }

    const isValid = await bcrypt.compare(password, settings.admin_password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }

    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, site_name: settings.site_name });
  } catch (error) {
    console.error('POST /api/admin/login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/admin/news - all news for admin, paginated
router.get('/news', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await News.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    console.error('GET /api/admin/news error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch news' });
  }
});

// PUT /api/admin/news/:id - edit a news item
router.put('/news/:id', requireAuth, async (req, res) => {
  try {
    const news = await News.findByPk(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }

    const editableFields = [
      'title_my', 'summary_my', 'content_my',
      'category', 'is_breaking', 'is_trending', 'image_url'
    ];

    const updates = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    updates.is_edited_by_admin = true;

    await news.update(updates);
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('PUT /api/admin/news/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to update news' });
  }
});

// DELETE /api/admin/news/:id
router.delete('/news/:id', requireAuth, async (req, res) => {
  try {
    const news = await News.findByPk(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }
    await news.destroy();
    res.json({ success: true, message: 'News deleted' });
  } catch (error) {
    console.error('DELETE /api/admin/news/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete news' });
  }
});

// PUT /api/admin/settings - update site name / admin password
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const { site_name, new_password } = req.body;
    let settings = await AdminSettings.findOne();

    if (!settings) {
      settings = await AdminSettings.create({
        site_name: 'Neko Anime News',
        admin_password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)
      });
    }

    const updates = {};
    if (site_name) updates.site_name = site_name;
    if (new_password) updates.admin_password = await bcrypt.hash(new_password, 10);

    await settings.update(updates);
    res.json({ success: true, site_name: settings.site_name });
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

export default router;
