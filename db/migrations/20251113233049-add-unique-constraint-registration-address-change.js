'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create partial unique index for registrationAddressChange tickets with open status per company
    await queryInterface.addIndex('tickets', {
      fields: ['companyId', 'type'],
      name: 'tickets_company_id_registration_open_unique',
      unique: true,
      where: {
        type: 'registrationAddressChange',
        status: 'open'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the partial unique index
    await queryInterface.removeIndex('tickets', 'tickets_company_id_registration_open_unique');
  }
};