import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startBackgroundGeneration', () => {
    let mockSetImmediate: jest.Mock;
    let originalSetImmediate: typeof global.setImmediate;
    let originalDateNow: typeof Date.now;

    beforeEach(() => {
      // Store original functions
      originalSetImmediate = global.setImmediate;
      originalDateNow = Date.now;

      // Mock setImmediate to control async execution
      mockSetImmediate = jest.fn((fn: Function) => {
        // Use setTimeout to simulate setImmediate behavior but make it testable
        setTimeout(fn, 0);
      });
      global.setImmediate = mockSetImmediate as any;

      // Mock Date.now for consistent job IDs
      const mockDateNow = jest.fn(() => 1704067200000); // Fixed timestamp
      Date.now = mockDateNow;
    });

    afterEach(() => {
      // Restore original functions
      global.setImmediate = originalSetImmediate;
      Date.now = originalDateNow;
      jest.clearAllMocks();
    });

    it('should return unique job IDs for all report types', () => {
      const jobIds = service.startBackgroundGeneration();

      expect(jobIds).toHaveProperty('accounts');
      expect(jobIds).toHaveProperty('yearly');
      expect(jobIds).toHaveProperty('fs');

      expect(jobIds.accounts).toBe('job_1704067200000_accounts');
      expect(jobIds.yearly).toBe('job_1704067200000_yearly');
      expect(jobIds.fs).toBe('job_1704067200000_fs');

      // Verify setImmediate was called three times
      expect(mockSetImmediate).toHaveBeenCalledTimes(3);
    });

    it('should start all three report generation tasks in background', async () => {
      // Mock the report generation methods to prevent actual file operations
      const accountsSpy = jest.spyOn(service as any, 'accounts').mockResolvedValue(1000);
      const yearlySpy = jest.spyOn(service as any, 'yearly').mockResolvedValue(1500);
      const fsSpy = jest.spyOn(service as any, 'fs').mockResolvedValue(2000);

      // Mock updateReportState to track state changes
      const updateStateSpy = jest.spyOn(service as any, 'updateReportState');

      const jobIds = service.startBackgroundGeneration();

      // Verify immediate return with job IDs
      expect(jobIds).toHaveProperty('accounts');
      expect(jobIds).toHaveProperty('yearly');
      expect(jobIds).toHaveProperty('fs');

      // Buffer to wait for setImmediate callbacks to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all report generation methods were called
      expect(accountsSpy).toHaveBeenCalled();
      expect(yearlySpy).toHaveBeenCalled();
      expect(fsSpy).toHaveBeenCalled();

      // Verify state updates for successful completion
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'completed', 1000);
      expect(updateStateSpy).toHaveBeenCalledWith('yearly', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('yearly', 'completed', 1500);
      expect(updateStateSpy).toHaveBeenCalledWith('fs', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('fs', 'completed', 2000);
    });

    it('should handle individual report failures gracefully', async () => {
      // Mock report generation methods with mixed success/failure
      const accountsSpy = jest.spyOn(service as any, 'accounts').mockResolvedValue(1000);
      const yearlySpy = jest.spyOn(service as any, 'yearly').mockRejectedValue(new Error('Yearly generation failed'));
      const fsSpy = jest.spyOn(service as any, 'fs').mockResolvedValue(2000);

      // Mock updateReportState to track state changes
      const updateStateSpy = jest.spyOn(service as any, 'updateReportState');

      const jobIds = service.startBackgroundGeneration();

      // Buffer to wait for setImmediate callbacks to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify state updates with success and failure
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'completed', 1000);
      expect(updateStateSpy).toHaveBeenCalledWith('yearly', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('yearly', 'failed', 0, 'Yearly generation failed');
      expect(updateStateSpy).toHaveBeenCalledWith('fs', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('fs', 'completed', 2000);

      // Verify all methods were still called despite failures
      expect(accountsSpy).toHaveBeenCalled();
      expect(yearlySpy).toHaveBeenCalled();
      expect(fsSpy).toHaveBeenCalled();
    });

    it('should handle all report failures gracefully', async () => {
      // Mock all report generation methods to fail
      const accountsSpy = jest.spyOn(service as any, 'accounts').mockRejectedValue(new Error('Accounts failed'));
      const yearlySpy = jest.spyOn(service as any, 'yearly').mockRejectedValue(new Error('Yearly failed'));
      const fsSpy = jest.spyOn(service as any, 'fs').mockRejectedValue(new Error('FS failed'));

      // Mock updateReportState to track state changes
      const updateStateSpy = jest.spyOn(service as any, 'updateReportState');

      const jobIds = service.startBackgroundGeneration();

      // Buffer to wait for setImmediate callbacks to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all reports failed but were still processed
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'failed', 0, 'Accounts failed');
      expect(updateStateSpy).toHaveBeenCalledWith('yearly', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('yearly', 'failed', 0, 'Yearly failed');
      expect(updateStateSpy).toHaveBeenCalledWith('fs', 'processing');
      expect(updateStateSpy).toHaveBeenCalledWith('fs', 'failed', 0, 'FS failed');

      // Verify all methods were called
      expect(accountsSpy).toHaveBeenCalled();
      expect(yearlySpy).toHaveBeenCalled();
      expect(fsSpy).toHaveBeenCalled();
    });

    it('should not perform any actual file system operations', async () => {
      // Mock the report generation methods to prevent actual file operations
      const accountsSpy = jest.spyOn(service as any, 'accounts').mockResolvedValue(1000);
      const yearlySpy = jest.spyOn(service as any, 'yearly').mockResolvedValue(1500);
      const fsSpy = jest.spyOn(service as any, 'fs').mockResolvedValue(2000);

      const jobIds = service.startBackgroundGeneration();

      // Buffer to wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 50));

      // Since we mocked the report generation methods, no actual file operations should occur
      // The methods themselves would normally perform file operations, but we've prevented that
      expect(accountsSpy).toHaveBeenCalled();
      expect(yearlySpy).toHaveBeenCalled();
      expect(fsSpy).toHaveBeenCalled();
    });

    it('should handle unknown error types properly', async () => {
      // Mock a report to throw a non-Error object
      jest.spyOn(service as any, 'accounts').mockRejectedValue('String error');
      jest.spyOn(service as any, 'yearly').mockResolvedValue(1500);
      jest.spyOn(service as any, 'fs').mockResolvedValue(2000);

      const updateStateSpy = jest.spyOn(service as any, 'updateReportState');

      service.startBackgroundGeneration();

      // Buffer to wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify unknown error is handled properly
      expect(updateStateSpy).toHaveBeenCalledWith('accounts', 'failed', 0, 'Unknown error');
    });

    it('should update report states correctly through the full lifecycle', async () => {
      // Mock report generation methods
      jest.spyOn(service as any, 'accounts').mockResolvedValue(1000);
      jest.spyOn(service as any, 'yearly').mockResolvedValue(1500);
      jest.spyOn(service as any, 'fs').mockResolvedValue(2000);

      // Check initial states
      expect(service.getStatus('accounts').status).toBe('idle');
      expect(service.getStatus('yearly').status).toBe('idle');
      expect(service.getStatus('fs').status).toBe('idle');

      service.startBackgroundGeneration();

      // Buffer to wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify final states
      expect(service.getStatus('accounts').status).toBe('completed');
      expect(service.getStatus('yearly').status).toBe('completed');
      expect(service.getStatus('fs').status).toBe('completed');

      expect(service.getStatus('accounts').lastDuration).toBe(1000);
      expect(service.getStatus('yearly').lastDuration).toBe(1500);
      expect(service.getStatus('fs').lastDuration).toBe(2000);
    });
  });
});