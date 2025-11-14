'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('tickets', {
      fields: ['companyId', 'type'],
      name: 'tickets_company_id_strikeoff_open_unique',
      unique: true,
      where: {
        type: 'strikeOff',
        status: 'open'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('tickets', 'tickets_company_id_strikeoff_open_unique');
  }
};