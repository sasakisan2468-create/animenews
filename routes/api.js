import express from 'express';
import { Op } from 'sequelize';
import News from '../models/News.js';

const router = express.Router();

// GET /api/news - paginated, filterable news list
router.get('/news', async (req, res) => {
  try {
    const {
      category,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (category) {
      where.category = { [Op.contains]: [category] };
    }

    if (search) {
      where[Op.or] = [
        { title_my: { [Op.iLike]: `%${search}%` } },
        { original_title: { [Op.iLike]: `%${search}%` } },
        { summary_my: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (startDate || endDate) {
      where.published_at = {};
      if (startDate) where.published_at[Op.gte] = new Date(startDate);
      if (endDate) where.published_at[Op.lte] = new Date(endDate);
    }

    const { rows, count } = await News.findAndCountAll({
      where,
      order: [
        ['is_breaking', 'DESC'],
        ['published_at', 'DESC']
      ],
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
        totalPages: Math.ceil(count / limitNum),
        hasMore: offset + rows.length < count
      }
    });
  } catch (error) {
    console.error('GET /api/news error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch news' });
  }
});

// GET /api/news/:id - single news item
router.get('/news/:id', async (req, res) => {
  try {
    const news = await News.findByPk(req.params.id);
    if (!news) {
      return res.status(404).json({ success: false, error: 'News not found' });
    }
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('GET /api/news/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch news item' });
  }
});

export default router;
