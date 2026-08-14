import { DataTypes } from 'sequelize';
import sequelize from '../services/database.js';

const News = sequelize.define('News', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title_my: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  original_title: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  summary_my: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  content_my: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source_url: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  source_name: {
    type: DataTypes.STRING,
    allowNull: true // 'AniList' | 'ANN' | 'Reddit'
  },
  category: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    defaultValue: []
  },
  is_breaking: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_trending: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_edited_by_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'news',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['source_url'] },
    { fields: ['published_at'] },
    { fields: ['is_breaking'] },
    { fields: ['is_trending'] }
  ]
});

export default News;
