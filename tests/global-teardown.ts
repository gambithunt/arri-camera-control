/**
 * Global Test Teardown
 * Cleans up test environment after running tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function cleanupMockCameraServer(): Promise<void> {
  console.log('Cleaning up mock CAP server...');
  
  try {
    const mockServerProcess = (global as any).mockCameraServerProcess;
    
    if (mockServerProcess) {
      mockServerProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        mockServerProcess.on('exit', resolve);
        
        // Force kill after timeout
        setTimeout(() => {
          mockServerProcess.kill('SIGKILL');
          resolve(undefined);
        }, 5000);
      });
      
      console.log('Mock CAP server stopped');
    }
    
  } catch (error) {
    console.warn('Failed to cleanup mock CAP server:', error);
  }
}

async function cleanupTestDatabase(): Promise<void> {
  console.log('Cleaning up test database...');
  
  try {
    await execAsync('npm run db:test:cleanup');
    console.log('Test database cleaned up');
  } catch (error) {
    console.warn('Failed to cleanup test database:', error);
  }
}

async function generateTestReport(): Promise<void> {
  console.log('Generating test report...');
  
  try {
    const testResultsDir = path.join(process.cwd(), 'test-results');
    
    // Check if test results exist
    try {
      await fs.access(testResultsDir);
    } catch {
      console.log('No test results to process');
      return;
    }
    
    // Generate performance report
    await generatePerformanceReport();
    
    // Generate coverage report
    await generateCoverageReport();
    
    console.log('Test reports generated');
    
  } catch (error) {
    console.warn('Failed to generate test reports:', error);
  }
}

async function generatePerformanceReport(): Promise<void> {
  try {
    const performanceDir = path.join(process.cwd(), 'test-results', 'performance');
    
    // Check if performance results exist
    try {
      await fs.access(performanceDir);
    } catch {
      console.log('No performance results to process');
      return;
    }
    
    // Read performance test results
    const files = await fs.readdir(performanceDir);
    const performanceData: any[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(performanceDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          performanceData.push(data);
        } catch (error) {
          console.warn(`Failed to read performance file ${file}:`, error);
        }
      }
    }
    
    // Generate performance summary
    const performanceSummary = {
      timestamp: new Date().toISOString(),
      totalTests: performanceData.length,
      summary: {
        touchResponseTime: {
          average: 0,
          min: Infinity,
          max: 0,
          threshold: 100
        },
        scrollPerformance: {
          averageFPS: 0,
          minFPS: Infinity,
          maxFPS: 0,
          threshold: 60
        },
        animationPerformance: {
          averageFrameTime: 0,
          frameDrops: 0,
          threshold: 16.67
        }
      },
      details: performanceData
    };
    
    // Calculate averages (simplified)
    if (performanceData.length > 0) {
      // This would contain actual performance metric calculations
      console.log(`Processed ${performanceData.length} performance test results`);
    }
    
    // Write performance summary
    const summaryPath = path.join(performanceDir, 'performance-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(performanceSummary, null, 2));
    
    console.log('Performance report generated');
    
  } catch (error) {
    console.warn('Failed to generate performance report:', error);
  }
}

async function generateCoverageReport(): Promise<void> {
  try {
    // Generate coverage report if coverage data exists
    await execAsync('npm run test:coverage:report');
    console.log('Coverage report generated');
  } catch (error) {
    console.warn('Failed to generate coverage report:', error);
  }
}

async function cleanupTempFiles(): Promise<void> {
  console.log('Cleaning up temporary files...');
  
  try {
    const tempDirs = [
      'tmp',
      '.tmp',
      'temp',
      'test-temp'
    ];
    
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, ignore
      }
    }
    
    console.log('Temporary files cleaned up');
    
  } catch (error) {
    console.warn('Failed to cleanup temporary files:', error);
  }
}

async function archiveTestResults(): Promise<void> {
  console.log('Archiving test results...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(process.cwd(), 'test-archives', timestamp);
    
    // Create archive directory
    await fs.mkdir(archiveDir, { recursive: true });
    
    // Copy test results
    const testResultsDir = path.join(process.cwd(), 'test-results');
    
    try {
      await fs.access(testResultsDir);
      await execAsync(`cp -r ${testResultsDir}/* ${archiveDir}/`);
      console.log(`Test results archived to ${archiveDir}`);
    } catch {
      console.log('No test results to archive');
    }
    
  } catch (error) {
    console.warn('Failed to archive test results:', error);
  }
}

async function printTestSummary(): Promise<void> {
  console.log('📊 Test Summary:');
  
  try {
    const testResultsDir = path.join(process.cwd(), 'test-results');
    
    // Read test results
    const resultsFile = path.join(testResultsDir, 'results.json');
    
    try {
      const content = await fs.readFile(resultsFile, 'utf-8');
      const results = JSON.parse(content);
      
      console.log(`   Total Tests: ${results.stats?.total || 'N/A'}`);
      console.log(`   Passed: ${results.stats?.passed || 'N/A'}`);
      console.log(`   Failed: ${results.stats?.failed || 'N/A'}`);
      console.log(`   Skipped: ${results.stats?.skipped || 'N/A'}`);
      console.log(`   Duration: ${results.stats?.duration || 'N/A'}ms`);
      
    } catch {
      console.log('   Test results not available');
    }
    
  } catch (error) {
    console.warn('Failed to print test summary:', error);
  }
}

async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting global test teardown...');
  
  try {
    // Cleanup mock services
    await cleanupMockCameraServer();
    
    // Cleanup test database
    await cleanupTestDatabase();
    
    // Generate test reports
    await generateTestReport();
    
    // Archive test results
    if (process.env.ARCHIVE_TEST_RESULTS === 'true') {
      await archiveTestResults();
    }
    
    // Cleanup temporary files
    await cleanupTempFiles();
    
    // Print test summary
    await printTestSummary();
    
    console.log('✅ Global test teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

export default globalTeardown;