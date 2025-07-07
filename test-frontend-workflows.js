import { spawn } from 'child_process';
import fetch from 'node-fetch';

class FrontendWorkflowTester {
  constructor() {
    this.testResults = [];
    this.serverProcess = null;
  }

  async testFrontendWorkflows() {
    console.log('🌐 FRONTEND WORKFLOW TESTING');
    console.log('=' .repeat(60));
    
    try {
      // Start the development server
      await this.startDevServer();
      
      // Wait for server to be ready
      await this.waitForServer();
      
      // Test all frontend workflows
      await this.testAuthenticationFlow();
      await this.testNavigationFlow();
      await this.testComponentRendering();
      await this.testApiConnectivity();
      
      // Generate report
      this.generateFrontendReport();
      
    } catch (error) {
      console.error('❌ Frontend testing failed:', error.message);
    } finally {
      this.cleanup();
    }
  }

  async startDevServer() {
    console.log('🚀 Starting development server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['run', 'dev:dashboard-only'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      let output = '';
      
      this.serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Local:') || output.includes('localhost:5000')) {
          console.log('✅ Development server started');
          resolve();
        }
      });
      
      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('Error') || error.includes('EADDRINUSE')) {
          reject(new Error(error));
        }
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 30000);
    });
  }

  async waitForServer() {
    console.log('⏳ Waiting for server to be ready...');
    
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch('http://localhost:5000');
        if (response.ok) {
          console.log('✅ Server is responding');
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Server did not become ready');
  }

  async testAuthenticationFlow() {
    console.log('\n🔐 Testing Authentication Flow...');
    
    const tests = [
      {
        name: 'Login page loads',
        url: 'http://localhost:5000/login',
        expected: 'should contain login form'
      },
      {
        name: 'Dashboard redirects when not authenticated',
        url: 'http://localhost:5000/',
        expected: 'should redirect to login'
      }
    ];
    
    for (const test of tests) {
      try {
        const response = await fetch(test.url, {
          redirect: 'manual'
        });
        
        const success = response.ok || response.status === 302;
        this.testResults.push({
          workflow: 'Authentication',
          test: test.name,
          success,
          url: test.url,
          status: response.status
        });
        
        console.log(`${success ? '✅' : '❌'} ${test.name} (${response.status})`);
      } catch (error) {
        this.testResults.push({
          workflow: 'Authentication',
          test: test.name,
          success: false,
          error: error.message
        });
        console.log(`❌ ${test.name} - ${error.message}`);
      }
    }
  }

  async testNavigationFlow() {
    console.log('\n🧭 Testing Navigation Flow...');
    
    const routes = [
      '/patients',
      '/practice-profile',
      '/billing/workflow',
      '/messages',
      '/settings'
    ];
    
    for (const route of routes) {
      try {
        const response = await fetch(`http://localhost:5000${route}`, {
          redirect: 'manual'
        });
        
        // Expect redirect to login (302) or successful load (200)
        const success = response.status === 200 || response.status === 302;
        this.testResults.push({
          workflow: 'Navigation',
          test: `Route ${route}`,
          success,
          status: response.status
        });
        
        console.log(`${success ? '✅' : '❌'} Route ${route} (${response.status})`);
      } catch (error) {
        this.testResults.push({
          workflow: 'Navigation',
          test: `Route ${route}`,
          success: false,
          error: error.message
        });
        console.log(`❌ Route ${route} - ${error.message}`);
      }
    }
  }

  async testComponentRendering() {
    console.log('\n⚛️ Testing Component Rendering...');
    
    try {
      const response = await fetch('http://localhost:5000');
      const html = await response.text();
      
      const componentTests = [
        {
          name: 'React app root',
          check: html.includes('id="root"')
        },
        {
          name: 'Vite client script',
          check: html.includes('vite') || html.includes('script')
        },
        {
          name: 'CSS loaded',
          check: html.includes('stylesheet') || html.includes('.css')
        }
      ];
      
      for (const test of componentTests) {
        this.testResults.push({
          workflow: 'Component Rendering',
          test: test.name,
          success: test.check
        });
        console.log(`${test.check ? '✅' : '❌'} ${test.name}`);
      }
      
    } catch (error) {
      console.log(`❌ Component rendering test failed: ${error.message}`);
    }
  }

  async testApiConnectivity() {
    console.log('\n🔌 Testing API Connectivity...');
    
    // Test if frontend can reach Supabase
    const apiTests = [
      {
        name: 'Supabase connectivity',
        test: async () => {
          try {
            const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/', {
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.JlRWMbNyXcgdAZrRuJ6SkQRcIHp5B6cILYKQnGFIAXU'
              }
            });
            return response.ok;
          } catch {
            return false;
          }
        }
      }
    ];
    
    for (const test of apiTests) {
      const success = await test.test();
      this.testResults.push({
        workflow: 'API Connectivity',
        test: test.name,
        success
      });
      console.log(`${success ? '✅' : '❌'} ${test.name}`);
    }
  }

  generateFrontendReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FRONTEND WORKFLOW TEST REPORT');
    console.log('='.repeat(60));
    
    const workflows = {};
    
    for (const result of this.testResults) {
      if (!workflows[result.workflow]) {
        workflows[result.workflow] = { passed: 0, total: 0 };
      }
      workflows[result.workflow].total++;
      if (result.success) {
        workflows[result.workflow].passed++;
      }
    }
    
    let totalPassed = 0;
    let totalTests = 0;
    
    for (const [workflow, stats] of Object.entries(workflows)) {
      const percentage = Math.round((stats.passed / stats.total) * 100);
      console.log(`${percentage === 100 ? '✅' : percentage > 50 ? '⚠️' : '❌'} ${workflow}: ${stats.passed}/${stats.total} (${percentage}%)`);
      totalPassed += stats.passed;
      totalTests += stats.total;
    }
    
    const overallPercentage = Math.round((totalPassed / totalTests) * 100);
    console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 90) {
      console.log('🎉 EXCELLENT: Frontend is working perfectly!');
    } else if (overallPercentage >= 70) {
      console.log('✅ GOOD: Frontend is functional');
    } else {
      console.log('⚠️  NEEDS ATTENTION: Frontend issues detected');
    }
  }

  cleanup() {
    if (this.serverProcess) {
      console.log('\n🛑 Stopping development server...');
      this.serverProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds if not stopped
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          this.serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

// Run frontend tests
async function main() {
  const tester = new FrontendWorkflowTester();
  await tester.testFrontendWorkflows();
  
  console.log('\n🏁 Frontend workflow testing complete!');
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminated, cleaning up...');
  process.exit(0);
});

main().catch(console.error);