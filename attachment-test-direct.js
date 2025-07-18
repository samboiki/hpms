// Direct test to confirm the issue
console.log('Testing attachment issue directly...');

// Test if File objects can be passed correctly
const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
console.log('Created test file:', testFile);
console.log('File name:', testFile.name);
console.log('File size:', testFile.size);
console.log('File type:', testFile.type);

// Test array with file
const testArray = [testFile];
console.log('Test array:', testArray);
console.log('Array length:', testArray.length);

// Test function call with file parameter
function testFunction(email, subject, message, attachments) {
    console.log('Function called with:');
    console.log('- email:', email);
    console.log('- subject:', subject);
    console.log('- message:', message);
    console.log('- attachments:', attachments);
    console.log('- attachments length:', attachments?.length || 0);
    
    if (attachments && attachments.length > 0) {
        attachments.forEach((file, index) => {
            console.log(`File ${index + 1}:`, {
                name: file.name,
                size: file.size,
                type: file.type,
                constructor: file.constructor.name
            });
        });
    }
}

// Test the function call
testFunction('test@example.com', 'Test Subject', 'Test message', testArray);

console.log('Test complete. Check logs above.');