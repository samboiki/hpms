const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting browser to check console logs...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Listen to console logs from the browser
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });
  
  // Listen to page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });
  
  // Listen to request failures
  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
  });
  
  try {
    console.log('📄 Navigating to localhost:5000...');
    await page.goto('http://localhost:5000', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting 5 seconds for React to load...');
    await page.waitForTimeout(5000);
    
    // Check if any React content loaded
    const dashboardTest = await page.$('.min-h-screen');
    if (dashboardTest) {
      console.log('✅ Found .min-h-screen element');
    } else {
      console.log('❌ No .min-h-screen element found');
    }
    
    // Check the page content
    const bodyContent = await page.evaluate(() => document.body.innerText);
    console.log('📝 Page content length:', bodyContent.length);
    
    if (bodyContent.includes('DASHBOARD TEST')) {
      console.log('✅ Dashboard test content found');
    } else {
      console.log('❌ No dashboard test content');
      console.log('📄 Current body content:', bodyContent.substring(0, 200));
    }
    
  } catch (error) {
    console.log('❌ Error loading page:', error.message);
  }
  
  await browser.close();
  console.log('🏁 Browser check complete');
})();