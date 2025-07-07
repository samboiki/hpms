// Test script to check appointment form issues
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('Browser console:', msg.type(), msg.text());
  });
  
  // Log errors
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });
  
  try {
    // Navigate to login
    await page.goto('http://localhost:5002/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Login
    await page.type('input[type="email"]', 'admin@onehealth.local');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForNavigation();
    await page.waitForSelector('button:has-text("New")', { timeout: 10000 });
    
    // Click New Appointment button
    await page.click('button:has-text("New")');
    
    // Wait for modal
    await page.waitForSelector('input[placeholder="Search patients..."]', { timeout: 10000 });
    
    // Test patient search
    console.log('\n=== Testing Patient Search ===');
    const patientInput = await page.$('input[placeholder="Search patients..."]');
    await patientInput.click();
    await patientInput.type('John');
    
    // Check for dropdown
    await page.waitForSelector('[class*="absolute z-20"]', { timeout: 5000 });
    console.log('✓ Patient dropdown appeared');
    
    // Clear patient search
    await patientInput.click({ clickCount: 3 });
    await patientInput.press('Backspace');
    
    // Check selectors performance
    console.log('\n=== Checking Selector Performance ===');
    const startTime = Date.now();
    
    // Doctor select
    const doctorSelect = await page.$('select');
    if (doctorSelect) {
      await doctorSelect.click();
      console.log(`✓ Doctor select found in ${Date.now() - startTime}ms`);
    }
    
    // Date picker
    const dateButton = await page.$('button:has([class*="calendar-date"])');
    if (dateButton) {
      await dateButton.click();
      await page.waitForSelector('[class*="Calendar Grid"]', { timeout: 5000 });
      console.log('✓ Date picker modal opened');
      
      // Close date picker
      await page.keyboard.press('Escape');
    }
    
    // Time slots
    const timeSlots = await page.$$('button:has-text("am")');
    console.log(`✓ Found ${timeSlots.length} time slots`);
    
    // Performance metrics
    const metrics = await page.metrics();
    console.log('\n=== Performance Metrics ===');
    console.log(`JS Heap Used: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`DOM Nodes: ${metrics.Nodes}`);
    console.log(`Listeners: ${metrics.JSEventListeners}`);
    
    // Take screenshot
    await page.screenshot({ path: 'appointment_form_test.png', fullPage: true });
    console.log('\n✓ Screenshot saved as appointment_form_test.png');
    
  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: 'appointment_form_error.png', fullPage: true });
  }
  
  // Keep browser open for manual inspection
  console.log('\n=== Browser will remain open for inspection ===');
  console.log('Press Ctrl+C to exit');
})();