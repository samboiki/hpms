#!/usr/bin/env node
/**
 * Simple Dental Tariffs Import Script
 * Using the working database connection pattern from execute-migrations-like-bolt.js
 */

const fs = require('fs');
const { Client } = require('pg');

// Use exact connection pattern that works in other scripts
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
    connectionString,
    ssl: { rejectUnauthorized: false }
};

// Parse simple CSV (just for the dental codes)
function parseSimpleCSV(csvPath) {
    console.log(`Reading CSV: ${csvPath}`);
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header, parse data
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Very basic CSV parsing for our known structure
        const parts = line.split(',');
        if (parts.length >= 10) {
            const code = parseInt(parts[0]);
            const description = parts[1].replace(/"/g, '');
            const price = parseFloat(parts[2]);
            
            if (code && description && !isNaN(price)) {
                data.push({
                    code,
                    description,
                    price_nad: price,
                    requires_tooth_number: parts[5] === 'YES',
                    can_be_multiplied: parts[6] || 'NO',
                    business_rule: parts[7] || '',
                    notes: parts[9] || ''
                });
            }
        }
    }
    
    return data;
}

async function main() {
    console.log('🦷 Simple Dental Tariffs Import');
    console.log('=' .repeat(40));
    
    const client = new Client(DB_CONFIG);
    
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        // Create table
        console.log('Creating dental_tariffs table...');
        await client.query(`
            DROP TABLE IF EXISTS dental_tariffs CASCADE;
            
            CREATE TABLE dental_tariffs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code INTEGER UNIQUE NOT NULL,
                description TEXT NOT NULL,
                price_nad DECIMAL(10,2) NOT NULL,
                requires_tooth_number BOOLEAN DEFAULT false,
                can_be_multiplied VARCHAR(20) DEFAULT 'NO',
                business_rule TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE INDEX idx_dental_tariffs_code ON dental_tariffs(code);
        `);
        console.log('✅ Table created');
        
        // Parse and insert data
        const data = parseSimpleCSV('/home/happy/projects/hpms/dental_codes_Sheet1.csv');
        console.log(`Parsed ${data.length} records`);
        
        for (const row of data) {
            await client.query(`
                INSERT INTO dental_tariffs (code, description, price_nad, requires_tooth_number, can_be_multiplied, business_rule, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                row.code,
                row.description,
                row.price_nad,
                row.requires_tooth_number,
                row.can_be_multiplied,
                row.business_rule,
                row.notes
            ]);
        }
        
        console.log('✅ Data inserted');
        
        // Verify
        const result = await client.query('SELECT COUNT(*) as count FROM dental_tariffs');
        console.log(`Total records: ${result.rows[0].count}`);
        
        // Show sample data
        const sample = await client.query(`
            SELECT code, description, price_nad 
            FROM dental_tariffs 
            ORDER BY price_nad DESC 
            LIMIT 5
        `);
        
        console.log('\nMost expensive procedures:');
        sample.rows.forEach(row => {
            console.log(`${row.code}: ${row.description} - ${row.price_nad} NAD`);
        });
        
        console.log('\n🎉 Import completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

main();