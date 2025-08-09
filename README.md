# Uptime Monitor

A Node.js uptime monitoring script that checks domain availability and sends Slack alerts for failures.

## Features

- Monitors multiple domains using curl HEAD requests
- Configurable check intervals using cron scheduling
- Logs 200/301/302 status codes as OK
- Sends Slack webhook alerts for 404/500+ errors and connection failures
- Timestamped logging for all checks
- Graceful shutdown handling

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your domains and Slack webhook in `config.json`

3. Start the monitor:
```bash
npm start
```

## Configuration

Edit `config.json`:

```json
{
  "domains": [
    "https://your-domain.com",
    "https://another-domain.com"
  ],
  "checkInterval": 5,
  "slackWebhookUrl": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
}
```

- `domains`: Array of URLs to monitor
- `checkInterval`: Check frequency in minutes
- `slackWebhookUrl`: Slack incoming webhook URL for alerts

## Status Codes

- ✅ **OK**: HTTP 200, 301, 302
- ❌ **ERROR**: HTTP 404, 500+, connection failures
- ⚠️ **Unexpected**: Other HTTP status codes

## Usage

The monitor runs continuously and:
1. Performs an initial check on startup
2. Schedules recurring checks based on `checkInterval`
3. Logs all results with timestamps
4. Sends Slack alerts only for errors

Stop with Ctrl+C for graceful shutdown.