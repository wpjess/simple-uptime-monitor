#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');

class UptimeMonitor {
  constructor() {
    this.config = this.loadConfig();
    this.isRunning = false;
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Error loading config:', error.message);
      process.exit(1);
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async checkDomain(domain) {
    return new Promise((resolve) => {
      const command = `curl -I -s -o /dev/null -w "%{http_code}" --max-time 30 "${domain}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.log(`Error checking ${domain}: ${error.message}`);
          resolve({ domain, status: null, error: error.message });
          return;
        }

        const statusCode = parseInt(stdout.trim());
        resolve({ domain, status: statusCode, error: null });
      });
    });
  }

  async sendSlackAlert(domain, status, error) {
    if (!this.config.slackWebhookUrl || this.config.slackWebhookUrl.includes('YOUR/SLACK/WEBHOOK')) {
      this.log('Slack webhook not configured, skipping notification');
      return;
    }

    const message = {
      text: `🚨 Uptime Alert`,
      attachments: [
        {
          color: 'danger',
          fields: [
            {
              title: 'Domain',
              value: domain,
              short: true
            },
            {
              title: 'Status',
              value: status ? `HTTP ${status}` : 'Connection Error',
              short: true
            },
            {
              title: 'Time',
              value: new Date().toISOString(),
              short: true
            }
          ]
        }
      ]
    };

    if (error) {
      message.attachments[0].fields.push({
        title: 'Error',
        value: error,
        short: false
      });
    }

    try {
      await axios.post(this.config.slackWebhookUrl, message);
      this.log(`Slack alert sent for ${domain}`);
    } catch (error) {
      this.log(`Failed to send Slack alert: ${error.message}`);
    }
  }

  isStatusOk(status) {
    return status === 200 || status === 301 || status === 302;
  }

  isStatusError(status) {
    return (status >= 400 && status < 600); // 4xx and 5xx codes
  }

  async checkAllDomains() {
    if (this.isRunning) {
      this.log('Check already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.log(`Starting uptime check for ${this.config.domains.length} domains...`);

    const promises = this.config.domains.map(domain => this.checkDomain(domain));
    const results = await Promise.all(promises);

    for (const result of results) {
      const { domain, status, error } = result;

      if (error || status === null) {
        this.log(`❌ ${domain} - Connection Error: ${error}`);
        await this.sendSlackAlert(domain, null, error);
      } else if (this.isStatusOk(status)) {
        this.log(`✅ ${domain} - OK (${status})`);
      } else if (this.isStatusError(status)) {
        this.log(`❌ ${domain} - ERROR (${status})`);
        await this.sendSlackAlert(domain, status);
      } else {
        this.log(`⚠️  ${domain} - Unexpected status (${status})`);
      }
    }

    this.log('Uptime check completed');
    this.isRunning = false;
  }

  start() {
    this.log(`Starting uptime monitor...`);
    this.log(`Checking ${this.config.domains.length} domains every ${this.config.checkInterval} minutes`);
    
    // Run initial check
    this.checkAllDomains();
    
    // Schedule recurring checks
    const cronExpression = `*/${this.config.checkInterval} * * * *`;
    cron.schedule(cronExpression, () => {
      this.checkAllDomains();
    });

    this.log(`Monitor started with cron expression: ${cronExpression}`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down uptime monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down uptime monitor...');
  process.exit(0);
});

// Start the monitor
const monitor = new UptimeMonitor();
monitor.start();