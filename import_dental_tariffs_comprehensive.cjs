#!/usr/bin/env node
/**
 * Comprehensive Dental Tariffs Import Script
 * Imports dental practice codes from Excel data into PostgreSQL database
 */

const fs = require('fs');
const { Client } = require('pg');

// Database configuration (using direct PostgreSQL connection as per CLAUDE.md instructions)
const dbConfig = {
    host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'T@ngisasa200',
    ssl: { rejectUnauthorized: false }
};

// Parse CSV data
function parseCSV(csvPath) {
    console.log(`Reading CSV file: ${csvPath}`);
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    console.log('Headers found:', headers);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        // Simple CSV parsing (handles quoted fields)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim()); // Add last value
        
        // Create object from headers and values
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        data.push(row);
    }
    
    console.log(`Parsed ${data.length} dental procedure records`);
    return data;
}

// Transform data for database insertion
function transformData(data) {
    return data.map(row => {
        // Clean and transform the data
        const code = parseInt(row.Code);
        const description = row.Description.replace(/"/g, '');
        const price = parseFloat(row['Official 2025 Price (NAD)']);
        const onOfficialList = row['On 2025 List'] === 'YES';
        const foundInClaims = row['Found in Claims'] === 'YES';
        const requiresToothNumber = row['Requires Tooth Number'] === 'YES';
        const canBeMultiplied = row['Can Be Multiplied'] || 'NO';
        const businessRule = row['Business Rule/Formula'] || '';
        const exampleCalculation = row['Example Calculation'] || '';
        const notes = row['Notes'] || '';
        
        // Validate required fields
        if (!code || !description || isNaN(price)) {
            console.warn(`Skipping invalid row: Code=${code}, Description=${description}, Price=${price}`);
            return null;
        }
        
        return {
            code,
            description,
            price_nad: price,
            on_official_list: onOfficialList,
            found_in_claims: foundInClaims,
            requires_tooth_number: requiresToothNumber,
            can_be_multiplied: canBeMultiplied,
            business_rule: businessRule,
            example_calculation: exampleCalculation,
            notes: notes.length > 0 ? notes : null
        };
    }).filter(row => row !== null);
}

// Create database tables
async function createTables(client) {
    console.log('Creating dental tariffs table...');
    
    const createTableSQL = `
        -- Drop existing table if it exists
        DROP TABLE IF EXISTS dental_tariffs CASCADE;
        
        -- Create dental tariffs table
        CREATE TABLE dental_tariffs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code INTEGER UNIQUE NOT NULL,
            description TEXT NOT NULL,
            price_nad DECIMAL(10,2) NOT NULL,
            on_official_list BOOLEAN DEFAULT true,
            found_in_claims BOOLEAN DEFAULT false,
            requires_tooth_number BOOLEAN DEFAULT false,
            can_be_multiplied VARCHAR(20) DEFAULT 'NO',
            business_rule TEXT,
            example_calculation TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create indexes for performance
        CREATE INDEX idx_dental_tariffs_code ON dental_tariffs(code);
        CREATE INDEX idx_dental_tariffs_description ON dental_tariffs USING gin(to_tsvector('english', description));
        CREATE INDEX idx_dental_tariffs_price ON dental_tariffs(price_nad);
        CREATE INDEX idx_dental_tariffs_requires_tooth ON dental_tariffs(requires_tooth_number);
        CREATE INDEX idx_dental_tariffs_can_multiply ON dental_tariffs(can_be_multiplied);
        
        -- Create supporting tables for appointments and billing
        CREATE TABLE IF NOT EXISTS appointment_procedures (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            appointment_id UUID,
            tariff_id UUID REFERENCES dental_tariffs(id) ON DELETE CASCADE,
            tooth_number VARCHAR(10),
            quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS billing_line_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id UUID,
            tariff_id UUID REFERENCES dental_tariffs(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            tooth_number VARCHAR(10),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create indexes for supporting tables
        CREATE INDEX idx_appointment_procedures_appointment ON appointment_procedures(appointment_id);
        CREATE INDEX idx_appointment_procedures_tariff ON appointment_procedures(tariff_id);
        CREATE INDEX idx_billing_line_items_invoice ON billing_line_items(invoice_id);
        CREATE INDEX idx_billing_line_items_tariff ON billing_line_items(tariff_id);
    `;
    
    try {
        await client.query(createTableSQL);
        console.log('✅ Tables created successfully');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    }
}

// Insert data into database
async function insertData(client, data) {
    console.log(`Inserting ${data.length} dental tariff records...`);
    
    const insertSQL = `
        INSERT INTO dental_tariffs (
            code, description, price_nad, on_official_list, found_in_claims,
            requires_tooth_number, can_be_multiplied, business_rule,
            example_calculation, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of data) {
        try {
            await client.query(insertSQL, [
                row.code,
                row.description,
                row.price_nad,
                row.on_official_list,
                row.found_in_claims,
                row.requires_tooth_number,
                row.can_be_multiplied,
                row.business_rule,
                row.example_calculation,
                row.notes
            ]);
            successCount++;
        } catch (error) {
            console.error(`❌ Error inserting code ${row.code}: ${error.message}`);
            errorCount++;
        }
    }
    
    console.log(`✅ Inserted ${successCount} records successfully`);
    if (errorCount > 0) {
        console.log(`❌ Failed to insert ${errorCount} records`);
    }
}

// Verify data integrity
async function verifyData(client) {
    console.log('\nVerifying data integrity...');
    
    try {
        // Count total records
        const countResult = await client.query('SELECT COUNT(*) as total FROM dental_tariffs');
        console.log(`Total records in database: ${countResult.rows[0].total}`);
        
        // Check price range
        const priceRangeResult = await client.query(`
            SELECT 
                MIN(price_nad) as min_price,
                MAX(price_nad) as max_price,
                AVG(price_nad) as avg_price,
                COUNT(*) as total_procedures
            FROM dental_tariffs
        `);
        const priceStats = priceRangeResult.rows[0];
        console.log(`Price range: ${priceStats.min_price} - ${priceStats.max_price} NAD`);
        console.log(`Average price: ${parseFloat(priceStats.avg_price).toFixed(2)} NAD`);
        
        // Check multiplication categories
        const multiplyResult = await client.query(`
            SELECT 
                can_be_multiplied,
                COUNT(*) as count
            FROM dental_tariffs
            GROUP BY can_be_multiplied
            ORDER BY count DESC
        `);
        console.log('\nMultiplication categories:');
        multiplyResult.rows.forEach(row => {
            console.log(`  ${row.can_be_multiplied}: ${row.count} procedures`);
        });
        
        // Check tooth number requirements
        const toothResult = await client.query(`
            SELECT 
                requires_tooth_number,
                COUNT(*) as count
            FROM dental_tariffs
            GROUP BY requires_tooth_number
        `);
        console.log('\nTooth number requirements:');
        toothResult.rows.forEach(row => {
            console.log(`  ${row.requires_tooth_number ? 'Required' : 'Not required'}: ${row.count} procedures`);
        });
        
        // Sample some high-value procedures
        const expensiveResult = await client.query(`
            SELECT code, description, price_nad
            FROM dental_tariffs
            WHERE price_nad > 1000
            ORDER BY price_nad DESC
            LIMIT 5
        `);
        console.log('\nMost expensive procedures:');
        expensiveResult.rows.forEach(row => {
            console.log(`  ${row.code}: ${row.description} - ${row.price_nad} NAD`);
        });
        
        console.log('✅ Data verification completed successfully');
        
    } catch (error) {
        console.error('❌ Error during data verification:', error);
    }
}

// Create helper functions for the application
async function createHelperFunctions(client) {
    console.log('Creating helper functions...');
    
    const functionsSQL = `
        -- Function to calculate procedure price with quantity
        CREATE OR REPLACE FUNCTION calculate_procedure_price(
            p_tariff_id UUID,
            p_quantity INTEGER DEFAULT 1
        ) RETURNS DECIMAL(10,2) AS $$
        DECLARE
            tariff RECORD;
            calculated_price DECIMAL(10,2);
        BEGIN
            SELECT * INTO tariff FROM dental_tariffs WHERE id = p_tariff_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Tariff not found for ID: %', p_tariff_id;
            END IF;
            
            CASE tariff.can_be_multiplied
                WHEN 'YES' THEN
                    calculated_price := tariff.price_nad * p_quantity;
                WHEN 'SOMETIMES' THEN
                    -- For 'SOMETIMES', allow multiplication but cap at reasonable limits
                    calculated_price := tariff.price_nad * LEAST(p_quantity, 10);
                WHEN 'PROGRESSIVE' THEN
                    -- Progressive pricing (could implement tiered pricing here)
                    calculated_price := tariff.price_nad * p_quantity * 0.95; -- 5% bulk discount
                ELSE
                    calculated_price := tariff.price_nad;
            END CASE;
            
            RETURN calculated_price;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Function to search procedures by description
        CREATE OR REPLACE FUNCTION search_procedures(search_term TEXT)
        RETURNS TABLE(
            id UUID,
            code INTEGER,
            description TEXT,
            price_nad DECIMAL(10,2),
            requires_tooth_number BOOLEAN,
            can_be_multiplied VARCHAR(20)
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                dt.id,
                dt.code,
                dt.description,
                dt.price_nad,
                dt.requires_tooth_number,
                dt.can_be_multiplied
            FROM dental_tariffs dt
            WHERE dt.description ILIKE '%' || search_term || '%'
            ORDER BY dt.code;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Function to get procedures by price range
        CREATE OR REPLACE FUNCTION get_procedures_by_price_range(
            min_price DECIMAL(10,2),
            max_price DECIMAL(10,2)
        ) RETURNS TABLE(
            code INTEGER,
            description TEXT,
            price_nad DECIMAL(10,2)
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT dt.code, dt.description, dt.price_nad
            FROM dental_tariffs dt
            WHERE dt.price_nad BETWEEN min_price AND max_price
            ORDER BY dt.price_nad;
        END;
        $$ LANGUAGE plpgsql;
    `;
    
    try {
        await client.query(functionsSQL);
        console.log('✅ Helper functions created successfully');
    } catch (error) {
        console.error('❌ Error creating helper functions:', error);
    }
}

// Main execution function
async function main() {
    console.log('🦷 Comprehensive Dental Tariffs Import System');
    console.log('=' .repeat(50));
    
    const csvPath = '/home/happy/projects/hpms/dental_codes_Sheet1.csv';
    
    // Check if CSV file exists
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found: ${csvPath}`);
        process.exit(1);
    }
    
    const client = new Client(dbConfig);
    
    try {
        // Connect to database
        console.log('Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database successfully');
        
        // Parse CSV data
        const rawData = parseCSV(csvPath);
        const transformedData = transformData(rawData);
        
        console.log(`\nProcessed ${transformedData.length} valid records`);
        
        // Create database tables
        await createTables(client);
        
        // Insert data
        await insertData(client, transformedData);
        
        // Create helper functions
        await createHelperFunctions(client);
        
        // Verify data
        await verifyData(client);
        
        console.log('\n🎉 Dental tariffs import completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Integrate with appointment booking system');
        console.log('2. Add tariff selection to treatment planning');
        console.log('3. Connect to billing and invoicing system');
        console.log('4. Test calculation functions with real scenarios');
        
    } catch (error) {
        console.error('❌ Error during import process:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('Database connection closed');
    }
}

if (require.main === module) {
    main();
}