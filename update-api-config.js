// Script to update API configuration for deployment
// Run this script before deploying to Vercel

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.VITE_API_URL || 'https://savings-calendar-api.onrender.com';

// Files to update
const filesToUpdate = [
    'script.js',
    'signin.js',
    'signup.js',
    'analysis.js',
    'admin.js'
];

// Function to update API URLs in a file
function updateApiUrls(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace hardcoded localhost URLs with environment variable
        content = content.replace(
            /const\s+API_BASE_URL\s*=\s*['"`][^'"`]*['"`]/g,
            `const API_BASE_URL = '${API_BASE_URL}'`
        );
        
        // Add API_BASE_URL constant if it doesn't exist
        if (!content.includes('const API_BASE_URL')) {
            content = `const API_BASE_URL = '${API_BASE_URL}';\n\n` + content;
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated ${filePath}`);
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
    }
}

// Update all files
console.log('🚀 Updating API configuration for deployment...');
console.log(`📡 API Base URL: ${API_BASE_URL}`);

filesToUpdate.forEach(file => {
    if (fs.existsSync(file)) {
        updateApiUrls(file);
    } else {
        console.log(`⚠️  File not found: ${file}`);
    }
});

console.log('✨ API configuration update complete!');
console.log('📝 Remember to set VITE_API_URL environment variable in Vercel');
