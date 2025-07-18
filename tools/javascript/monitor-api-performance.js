#!/usr/bin/env node

/**
 * API Performance Monitor
 * 
 * This script monitors the quiz options API performance and logs metrics.
 * Run with: node tools/performance/monitor-api-performance.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const MONITOR_INTERVAL = 30000; // 30 seconds
const LOG_FILE = path.join(__dirname, '../../logs/api-performance.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0
    };
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          resolve({
            statusCode: res.statusCode,
            responseTime,
            data: data,
            headers: res.headers
          });
        });
      });
      
      req.on('error', (error) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        reject({
          error,
          responseTime
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  updateMetrics(responseTime, success) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    this.metrics.responseTimes.push(responseTime);
    
    // Keep only last 100 response times for percentile calculation
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-100);
    }
    
    // Calculate averages and percentiles
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = Math.round(sum / this.metrics.responseTimes.length);
    this.metrics.p95ResponseTime = this.calculatePercentile(this.metrics.responseTimes, 95);
    this.metrics.p99ResponseTime = this.calculatePercentile(this.metrics.responseTimes, 99);
  }

  async testQuizOptionsAPI() {
    try {
      console.log('Testing Quiz Options API...');
      
      const response = await this.makeRequest(`${API_URL}/api/quiz/options`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Performance-Monitor/1.0'
        }
      });
      
      const success = response.statusCode === 200;
      this.updateMetrics(response.responseTime, success);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        endpoint: '/api/quiz/options',
        statusCode: response.statusCode,
        responseTime: response.responseTime,
        success,
        metrics: { ...this.metrics }
      };
      
      // Log to file
      fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
      
      // Console output
      console.log(`✅ Response: ${response.statusCode} | Time: ${response.responseTime}ms | Avg: ${this.metrics.averageResponseTime}ms | P95: ${this.metrics.p95ResponseTime}ms`);
      
      return logEntry;
      
    } catch (error) {
      const responseTime = error.responseTime || 10000;
      this.updateMetrics(responseTime, false);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        endpoint: '/api/quiz/options',
        error: error.message || error.error?.message || 'Unknown error',
        responseTime,
        success: false,
        metrics: { ...this.metrics }
      };
      
      fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
      console.log(`❌ Error: ${logEntry.error} | Time: ${responseTime}ms`);
      
      return logEntry;
    }
  }

  printSummary() {
    console.log('\n📊 Performance Summary:');
    console.log(`Total Requests: ${this.metrics.totalRequests}`);
    console.log(`Success Rate: ${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`Average Response Time: ${this.metrics.averageResponseTime}ms`);
    console.log(`95th Percentile: ${this.metrics.p95ResponseTime}ms`);
    console.log(`99th Percentile: ${this.metrics.p99ResponseTime}ms`);
    
    // Performance assessment
    if (this.metrics.p95ResponseTime < 500) {
      console.log('🟢 Performance: Excellent');
    } else if (this.metrics.p95ResponseTime < 1000) {
      console.log('🟡 Performance: Good');
    } else if (this.metrics.p95ResponseTime < 2000) {
      console.log('🟠 Performance: Fair');
    } else {
      console.log('🔴 Performance: Poor');
    }
    
    console.log(`\nLog file: ${LOG_FILE}\n`);
  }

  async start() {
    console.log('🚀 Starting API Performance Monitor...');
    console.log(`Monitoring: ${API_URL}/api/quiz/options`);
    console.log(`Interval: ${MONITOR_INTERVAL / 1000} seconds\n`);
    
    // Initial test
    await this.testQuizOptionsAPI();
    
    // Set up interval monitoring
    const interval = setInterval(async () => {
      await this.testQuizOptionsAPI();
    }, MONITOR_INTERVAL);
    
    // Print summary every 10 requests
    let requestCount = 0;
    const summaryInterval = setInterval(() => {
      requestCount++;
      if (requestCount % 10 === 0) {
        this.printSummary();
      }
    }, MONITOR_INTERVAL);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitor...');
      clearInterval(interval);
      clearInterval(summaryInterval);
      this.printSummary();
      process.exit(0);
    });
    
    // Keep the process running
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
}

// Start monitoring if this script is run directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.start().catch(console.error);
}

module.exports = PerformanceMonitor;
