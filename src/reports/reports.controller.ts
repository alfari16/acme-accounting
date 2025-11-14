import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @HttpCode(200)
  report() {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
      // detailed status information
      accounts: this.reportsService.getStatus('accounts'),
      yearly: this.reportsService.getStatus('yearly'),
      fs: this.reportsService.getStatus('fs'),
    };
  }

  @Post()
  @HttpCode(202)
  generate() {
    const jobIds = this.reportsService.startBackgroundGeneration();

    return {
      message: 'Reports generation started in background',
      jobIds,
      estimatedTime: '10-15 seconds',
      isAnyProcessing: this.reportsService.isAnyReportProcessing(),
    };
  }
}
