// File: gongcha-adminnew/functions/src/monitoringBot.ts
// Just copy-paste this entire file

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Load from process.env — set via .env file (deployed) or .env.local (emulator)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Debug logging
console.log('[CONFIG] BOT_TOKEN loaded:', TELEGRAM_BOT_TOKEN ? '✅ YES' : '❌ NO');
console.log('[CONFIG] CHAT_ID loaded:', TELEGRAM_CHAT_ID ? '✅ YES' : '❌ NO');
const FIREBASE_PROJECT = 'gongcha-app-4691f';
const HEALTH_CHECK_URL = 'https://us-central1-gongcha-app-4691f.cloudfunctions.net/health';

const getDb = () => admin.firestore();

interface MonitoringReport {
  timestamp: string;
  cloudFunctionsStatus: string;
  errorRate: number;
  errorCount: number;
  totalRequests: number;
  apiHealth: number;
  apiResponseTime: number;
  recentErrors: string[];
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  message: string;
}

// Main monitoring function
export const monitorProductionBot = functions
  .region('us-central1')
  .pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    console.log('[MONITOR] Starting production monitoring at', new Date().toISOString());

    try {
      const report = await gatherMonitoringData();
      await sendTelegramReport(report);
      console.log('[MONITOR] Report sent successfully');
      return null;
    } catch (error) {
      console.error('[MONITOR] Error:', error);
      await sendTelegramAlert(`⚠️ MONITORING ERROR\n\n${error}`);
      throw error;
    }
  });

// Gather all monitoring data
async function gatherMonitoringData(): Promise<MonitoringReport> {
  const timestamp = new Date().toISOString();
  let errorCount = 0;
  let totalRequests = 0;
  let recentErrors: string[] = [];

  // 1. Check activity logs for errors
  try {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const logsSnapshot = await getDb()
      .collection('activity_logs')
      .where('createdAt', '>=', oneHourAgo)
      .limit(100)
      .get();

    totalRequests = logsSnapshot.size;
    logsSnapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      if (data.error || data.status === 'ERROR') {
        errorCount++;
        recentErrors.push(
          `${data.type}: ${data.error || data.message || 'Unknown'}`
        );
      }
    });
  } catch (error) {
    console.error('Error reading activity logs:', error);
  }

  // 2. Check API health
  let apiHealth = 0;
  let apiResponseTime = 0;
  try {
    const startTime = Date.now();
    const response = await axios.get(HEALTH_CHECK_URL, { timeout: 5000 });
    apiResponseTime = Date.now() - startTime;
    apiHealth = response.status;
  } catch (error) {
    apiHealth = 500;
    apiResponseTime = 0;
    console.error('Health check failed:', error);
  }

  // 3. Calculate error rate
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

  // 4. Determine overall status
  let overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (apiHealth !== 200) overallStatus = 'CRITICAL';
  else if (errorRate > 5) overallStatus = 'CRITICAL';
  else if (errorRate > 1) overallStatus = 'WARNING';

  const statusEmoji = {
    HEALTHY: '🟢',
    WARNING: '🟡',
    CRITICAL: '🔴',
  }[overallStatus];

  const message = `${statusEmoji} PRODUCTION STATUS [${timestamp.split('T')[1].split('.')[0]} UTC]

Cloud Functions: ${apiHealth === 200 ? '✅ OPERATIONAL' : '❌ ERROR ' + apiHealth}
Error Rate: ${errorRate.toFixed(2)}% (threshold: < 1%) ${errorRate < 1 ? '✅' : '⚠️'}
API Health: ${apiHealth === 200 ? '200 OK ✅' : apiHealth + ' ❌'}
Response Time: ${apiResponseTime}ms ${apiResponseTime < 500 ? '✅' : '⚠️'}

Requests (1h): ${totalRequests}
Errors: ${errorCount}

${recentErrors.length > 0 ? `Recent Errors:\n${recentErrors.slice(0, 3).join('\n')}` : 'Last Errors: None'}

Status: ${overallStatus === 'HEALTHY' ? '✅ All systems healthy' : '⚠️ Check logs immediately'}`;

  return {
    timestamp,
    cloudFunctionsStatus: apiHealth === 200 ? 'OPERATIONAL' : 'ERROR',
    errorRate,
    errorCount,
    totalRequests,
    apiHealth,
    apiResponseTime,
    recentErrors: recentErrors.slice(0, 5),
    overallStatus,
    message,
  };
}

// Send report to Telegram
async function sendTelegramReport(report: MonitoringReport): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram credentials not configured');
    return;
  }

  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await axios.post(telegramUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: report.message,
    });

    console.log('Telegram message sent:', response.data.ok);
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    throw error;
  }
}

// Send alert (for critical issues)
async function sendTelegramAlert(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram credentials not configured');
    return;
  }

  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(telegramUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `🚨 ALERT\n\n${message}`,
    });
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}