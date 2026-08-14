import { DataTypes } from 'sequelize';
import sequelize from '../services/database.js';

const AdminSettings = sequelize.define('AdminSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  site_name: {
    type: DataTypes.TEXT,
    defaultValue: 'Neko Anime News'
  },
  admin_password: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'admin_settings',
  underscored: true,
  timestamps: false
});

export default AdminSettings;
