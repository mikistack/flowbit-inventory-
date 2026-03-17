const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PasswordReset = sequelize.define('PasswordReset', {
    token: { type: DataTypes.STRING, unique: true },
    expiresAt: DataTypes.DATE,
    usedAt: DataTypes.DATE,
  });
  PasswordReset.associate = (models) => {
    PasswordReset.belongsTo(models.User, { foreignKey: 'userId' });
  };
  return PasswordReset;
};
