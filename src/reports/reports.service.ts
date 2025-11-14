import { Injectable } from '@nestjs/common';
import fsPromises from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

export interface ReportState {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  lastUpdated: Date | null;
  lastDuration: number | null;
  error?: string;
  startTime?: Date;
}

@Injectable()
export class ReportsService {
  private reportStates: Map<string, ReportState> = new Map([
    ['accounts', { status: 'idle', lastUpdated: null, lastDuration: null }],
    ['yearly', { status: 'idle', lastUpdated: null, lastDuration: null }],
    ['fs', { status: 'idle', lastUpdated: null, lastDuration: null }],
  ]);

  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  state(scope: string): string {
    return this.states[scope as keyof typeof this.states];
  }

  getStatus(reportType: string): ReportState {
    return (
      this.reportStates.get(reportType) || {
        status: 'idle',
        lastUpdated: null,
        lastDuration: null,
      }
    );
  }

  private updateReportState(
    type: string,
    status: ReportState['status'],
    duration?: number,
    error?: string,
  ): void {
    const currentState = this.reportStates.get(type) || {
      status: 'idle',
      lastUpdated: null,
      lastDuration: null,
    };

    const updatedState: ReportState = {
      ...currentState,
      status,
      error: error || undefined,
      lastDuration: duration || null,
      lastUpdated:
        status === 'completed' ? new Date() : currentState.lastUpdated,
      startTime: status === 'processing' ? new Date() : currentState.startTime,
    };

    this.reportStates.set(type, updatedState);

    if (status === 'completed' && duration) {
      this.states[type] = `finished in ${(duration / 1000).toFixed(2)}`;
    } else if (status === 'failed') {
      this.states[type] = `failed: ${error}`;
    }
  }

  isAnyReportProcessing(): boolean {
    for (const state of this.reportStates.values()) {
      if (state.status === 'processing') {
        return true;
      }
    }
    return false;
  }

  async accounts() {
    this.states.accounts = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};
    const files = await fsPromises.readdir(tmpDir);

    for (const file of files) {
      if (file.endsWith('.csv')) {
        const content = await fsPromises.readFile(
          path.join(tmpDir, file),
          'utf-8',
        );
        const lines = content.trim().split('\n');
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          if (!accountBalances[account]) {
            accountBalances[account] = 0;
          }
          accountBalances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      }
    }

    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }

    await fsPromises.writeFile(outputFile, output.join('\n'));
    const duration = performance.now() - start;
    this.states.accounts = `finished in ${(duration / 1000).toFixed(2)}`;
    return duration;
  }

  async yearly() {
    this.states.yearly = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};
    const files = await fsPromises.readdir(tmpDir);

    for (const file of files) {
      if (file.endsWith('.csv') && file !== 'yearly.csv') {
        const content = await fsPromises.readFile(
          path.join(tmpDir, file),
          'utf-8',
        );
        const lines = content.trim().split('\n');
        for (const line of lines) {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    }

    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });

    await fsPromises.writeFile(outputFile, output.join('\n'));
    const duration = performance.now() - start;
    this.states.yearly = `finished in ${(duration / 1000).toFixed(2)}`;
    return duration;
  }

  async fs() {
    this.states.fs = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };
    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }

    const files = await fsPromises.readdir(tmpDir);
    for (const file of files) {
      if (file.endsWith('.csv') && file !== 'fs.csv') {
        const content = await fsPromises.readFile(
          path.join(tmpDir, file),
          'utf-8',
        );
        const lines = content.trim().split('\n');

        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');

          if (Object.prototype.hasOwnProperty.call(balances, account)) {
            balances[account] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    }

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    await fsPromises.writeFile(outputFile, output.join('\n'));
    const duration = performance.now() - start;
    this.states.fs = `finished in ${(duration / 1000).toFixed(2)}`;
    return duration;
  }

  startBackgroundGeneration(): { [key: string]: string } {
    const jobIds = {
      accounts: `job_${Date.now()}_accounts`,
      yearly: `job_${Date.now()}_yearly`,
      fs: `job_${Date.now()}_fs`,
    };

    setImmediate(() => {
      void (async () => {
        try {
          this.updateReportState('accounts', 'processing');
          const duration = await this.accounts();
          this.updateReportState('accounts', 'completed', duration);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.updateReportState('accounts', 'failed', 0, errorMessage);
        }
      })();
    });

    setImmediate(() => {
      void (async () => {
        try {
          this.updateReportState('yearly', 'processing');
          const duration = await this.yearly();
          this.updateReportState('yearly', 'completed', duration);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.updateReportState('yearly', 'failed', 0, errorMessage);
        }
      })();
    });

    setImmediate(() => {
      void (async () => {
        try {
          this.updateReportState('fs', 'processing');
          const duration = await this.fs();
          this.updateReportState('fs', 'completed', duration);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.updateReportState('fs', 'failed', 0, errorMessage);
        }
      })();
    });

    return jobIds;
  }
}
