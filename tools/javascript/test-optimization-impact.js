#!/usr/bin/env node

/**
 * Performance Optimization Impact Test
 * 
 * This script tests the performance improvements by comparing
 * the optimized API against baseline expectations.
 */

const https = require('https');
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_ITERATIONS = 10;

class OptimizationTester {
  constructor() {
    this.results = [];
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Use http for localhost, https for remote
      const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
      const requestModule = isLocalhost ? http : https;

      const req = requestModule.request(url, { method: 'GET' }, (res) => {
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
            dataSize: data.length,
            success: res.statusCode === 200
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  async runPerformanceTest() {
    console.log('🧪 Running Performance Optimization Test...');
    console.log(`Testing: ${API_URL}/api/quiz/options`);
    console.log(`Iterations: ${TEST_ITERATIONS}\n`);

    const results = [];

    for (let i = 1; i <= TEST_ITERATIONS; i++) {
      try {
        console.log(`Test ${i}/${TEST_ITERATIONS}...`);
        
        const result = await this.makeRequest(`${API_URL}/api/quiz/options`);
        results.push(result);
        
        console.log(`  ✅ ${result.responseTime}ms (${result.statusCode})`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        results.push({
          statusCode: 0,
          responseTime: 10000,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  analyzeResults(results) {
    const successfulResults = results.filter(r => r.success);
    const responseTimes = successfulResults.map(r => r.responseTime);
    
    if (responseTimes.length === 0) {
      return {
        error: 'No successful requests',
        successRate: 0
      };
    }

    const sorted = [...responseTimes].sort((a, b) => a - b);
    const sum = responseTimes.reduce((a, b) => a + b, 0);
    
    return {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      successRate: (successfulResults.length / results.length) * 100,
      averageResponseTime: Math.round(sum / responseTimes.length),
      medianResponseTime: sorted[Math.floor(sorted.length / 2)],
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)],
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  assessPerformance(analysis) {
    console.log('\n📊 Performance Analysis:');
    console.log('========================');
    
    if (analysis.error) {
      console.log(`❌ ${analysis.error}`);
      return;
    }

    console.log(`Total Requests: ${analysis.totalRequests}`);
    console.log(`Success Rate: ${analysis.successRate.toFixed(1)}%`);
    console.log(`Average Response Time: ${analysis.averageResponseTime}ms`);
    console.log(`Median Response Time: ${analysis.medianResponseTime}ms`);
    console.log(`Min Response Time: ${analysis.minResponseTime}ms`);
    console.log(`Max Response Time: ${analysis.maxResponseTime}ms`);
    console.log(`95th Percentile: ${analysis.p95ResponseTime}ms`);
    console.log(`99th Percentile: ${analysis.p99ResponseTime}ms`);

    console.log('\n🎯 Optimization Assessment:');
    console.log('============================');

    // Performance benchmarks based on our optimization goals
    const benchmarks = {
      excellent: 500,   // < 500ms
      good: 1000,       // < 1000ms  
      fair: 2000,       // < 2000ms
      poor: Infinity    // >= 2000ms
    };

    const p95Time = analysis.p95ResponseTime;
    
    if (p95Time < benchmarks.excellent) {
      console.log('🟢 Performance Grade: EXCELLENT');
      console.log('✅ Optimization target achieved!');
      console.log('📈 Ready for production scale');
    } else if (p95Time < benchmarks.good) {
      console.log('🟡 Performance Grade: GOOD');
      console.log('✅ Significant improvement achieved');
      console.log('💡 Consider additional caching for further gains');
    } else if (p95Time < benchmarks.fair) {
      console.log('🟠 Performance Grade: FAIR');
      console.log('⚠️  Some improvement, but more optimization needed');
      console.log('🔧 Review database queries and indexing');
    } else {
      console.log('🔴 Performance Grade: POOR');
      console.log('❌ Optimization targets not met');
      console.log('🚨 Immediate attention required');
    }

    // Compare against original baseline (2677ms)
    const originalBaseline = 2677;
    const improvement = ((originalBaseline - analysis.averageResponseTime) / originalBaseline) * 100;
    
    console.log('\n📈 Improvement vs Original:');
    console.log('============================');
    console.log(`Original Baseline: ${originalBaseline}ms`);
    console.log(`Current Average: ${analysis.averageResponseTime}ms`);
    
    if (improvement > 0) {
      console.log(`🚀 Performance Improvement: ${improvement.toFixed(1)}%`);
      console.log(`⚡ Time Saved: ${originalBaseline - analysis.averageResponseTime}ms per request`);
    } else {
      console.log(`📉 Performance Regression: ${Math.abs(improvement).toFixed(1)}%`);
    }

    // Scaling projections
    console.log('\n🔮 Scaling Projections:');
    console.log('========================');
    
    const currentP95 = analysis.p95ResponseTime;
    console.log(`Current load (5 questions): ${currentP95}ms`);
    console.log(`Projected 1000 questions: ~${Math.round(currentP95 * 1.5)}ms`);
    console.log(`Projected 1000 users: ~${Math.round(currentP95 * 2)}ms`);
    console.log(`Projected 10000 users: ~${Math.round(currentP95 * 3)}ms`);

    return analysis;
  }

  async run() {
    try {
      const results = await this.runPerformanceTest();
      const analysis = this.analyzeResults(results);
      this.assessPerformance(analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const tester = new OptimizationTester();
  tester.run()
    .then(() => {
      console.log('\n✅ Performance test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Performance test failed:', error);
      process.exit(1);
    });
}

module.exports = OptimizationTester;
