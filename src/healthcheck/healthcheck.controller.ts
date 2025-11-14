import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Sequelize } from 'sequelize-typescript';

@Controller('api/v1/healthcheck')
export class HealthcheckController {
  constructor(private sequelize: Sequelize) {}

  @Get()
  async ping(@Res() res: Response) {
    try {
      await this.sequelize.authenticate();
      return res.status(HttpStatus.OK).json({
        OK: true,
        database: 'connected',
      });
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        OK: false,
        database: 'disconnected',
        error: error.message,
      });
    }
  }
}
