/**
 * Network Diagnostics Utility
 *
 * Helps diagnose and fix slow Supabase connections
 */

import { supabase } from '../lib/supabase';

export async function runNetworkDiagnostics() {
  console.log('🔍 Running Network Diagnostics...');
  console.log('=====================================');

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Basic connectivity
  console.log('\n📡 Test 1: Basic Connectivity');
  const connectStart = performance.now();
  try {
    const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/', {
      method: 'HEAD'
    });
    const connectTime = performance.now() - connectStart;

    results.tests.push({
      name: 'Basic Connectivity',
      status: response.ok ? '✅ PASS' : '❌ FAIL',
      time: connectTime,
      message: `Connection time: ${connectTime.toFixed(0)}ms`
    });

    console.log(`✅ Connected in ${connectTime.toFixed(0)}ms`);
  } catch (error) {
    results.tests.push({
      name: 'Basic Connectivity',
      status: '❌ FAIL',
      error: error.message
    });
    console.error('❌ Connection failed:', error);
  }

  // Test 2: Simple query performance
  console.log('\n🗄️ Test 2: Simple Query Performance');
  const queryStart = performance.now();
  try {
    const { data, error } = await supabase
      .from('practices')
      .select('id')
      .limit(1);

    const queryTime = performance.now() - queryStart;

    if (error) throw error;

    results.tests.push({
      name: 'Simple Query',
      status: '✅ PASS',
      time: queryTime,
      message: `Query time: ${queryTime.toFixed(0)}ms`
    });

    console.log(`✅ Query completed in ${queryTime.toFixed(0)}ms`);

    // Analyze performance
    if (queryTime > 3000) {
      console.log('⚠️ SEVERE: Query took over 3 seconds!');
      console.log('   Likely causes:');
      console.log('   - Supabase region is far from your location');
      console.log('   - Network connectivity issues');
      console.log('   - Database performance problems');
    } else if (queryTime > 1000) {
      console.log('⚠️ WARNING: Query took over 1 second');
    } else {
      console.log('✅ Query performance is acceptable');
    }
  } catch (error) {
    results.tests.push({
      name: 'Simple Query',
      status: '❌ FAIL',
      error: error.message
    });
    console.error('❌ Query failed:', error);
  }

  // Test 3: Auth performance
  console.log('\n🔐 Test 3: Auth Performance');
  const authStart = performance.now();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const authTime = performance.now() - authStart;

    results.tests.push({
      name: 'Auth Check',
      status: user ? '✅ PASS' : '⚠️ No User',
      time: authTime,
      message: `Auth time: ${authTime.toFixed(0)}ms`
    });

    console.log(`✅ Auth check in ${authTime.toFixed(0)}ms`);
  } catch (error) {
    results.tests.push({
      name: 'Auth Check',
      status: '❌ FAIL',
      error: error.message
    });
    console.error('❌ Auth check failed:', error);
  }

  // Test 4: Parallel query performance
  console.log('\n🚀 Test 4: Parallel Query Performance');
  const parallelStart = performance.now();
  try {
    const [r1, r2, r3] = await Promise.all([
      supabase.from('users').select('id').limit(1),
      supabase.from('practices').select('id').limit(1),
      supabase.from('patients').select('id').limit(1)
    ]);

    const parallelTime = performance.now() - parallelStart;

    results.tests.push({
      name: 'Parallel Queries',
      status: '✅ PASS',
      time: parallelTime,
      message: `3 parallel queries in ${parallelTime.toFixed(0)}ms`
    });

    console.log(`✅ 3 parallel queries in ${parallelTime.toFixed(0)}ms`);
    console.log(`   Average per query: ${(parallelTime / 3).toFixed(0)}ms`);
  } catch (error) {
    results.tests.push({
      name: 'Parallel Queries',
      status: '❌ FAIL',
      error: error.message
    });
    console.error('❌ Parallel queries failed:', error);
  }

  // Summary
  console.log('\n=====================================');
  console.log('📊 DIAGNOSTICS SUMMARY:');
  console.log('=====================================');

  const avgTime = results.tests
    .filter(t => t.time)
    .reduce((sum, t) => sum + t.time, 0) / results.tests.filter(t => t.time).length;

  console.log(`Average response time: ${avgTime.toFixed(0)}ms`);

  if (avgTime > 2000) {
    console.log('\n🚨 CRITICAL PERFORMANCE ISSUES DETECTED!');
    console.log('\n📍 RECOMMENDED SOLUTIONS:');
    console.log('1. Check your Supabase project region:');
    console.log('   https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/settings/general');
    console.log('\n2. Consider migrating to a closer region');
    console.log('\n3. Enable connection pooling:');
    console.log('   https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/settings/database');
    console.log('\n4. Use the local cache system (already implemented!)');
    console.log('\n5. Check your internet connection speed');
  }

  // Store results in localStorage for debugging
  localStorage.setItem('network_diagnostics', JSON.stringify(results));

  return results;
}

// Auto-run diagnostics if performance is poor
export function autoRunDiagnosticsOnSlowQuery(queryName: string, duration: number) {
  if (duration > 3000) {
    console.log(`\n⚠️ ALERT: ${queryName} took ${duration.toFixed(0)}ms!`);
    console.log('Running diagnostics automatically...');

    // Don't run diagnostics too often
    const lastRun = localStorage.getItem('last_diagnostics_run');
    const now = Date.now();

    if (!lastRun || now - parseInt(lastRun) > 60000) { // Run max once per minute
      localStorage.setItem('last_diagnostics_run', String(now));
      runNetworkDiagnostics();
    }
  }
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).runNetworkDiagnostics = runNetworkDiagnostics;
}