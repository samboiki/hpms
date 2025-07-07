#!/usr/bin/env node
/**
 * Generate SQL script for dental tariffs import
 * Creates SQL file that can be executed directly in Supabase
 */

const fs = require('fs');

function parseCSV(csvPath) {
    console.log(`Reading CSV: ${csvPath}`);
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV with proper quote handling
        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim());
        
        if (parts.length >= 10) {
            const code = parseInt(parts[0]);
            const description = parts[1].replace(/"/g, '').replace(/'/g, "''"); // Escape single quotes
            const price = parseFloat(parts[2]);
            const foundInClaims = parts[4] === 'YES';
            const requiresToothNumber = parts[5] === 'YES';
            const canBeMultiplied = parts[6] || 'NO';
            const businessRule = (parts[7] || '').replace(/'/g, "''");
            const exampleCalc = (parts[8] || '').replace(/'/g, "''");
            const notes = (parts[9] || '').replace(/'/g, "''");
            
            if (code && description && !isNaN(price)) {
                data.push({
                    code,
                    description,
                    price_nad: price,
                    found_in_claims: foundInClaims,
                    requires_tooth_number: requiresToothNumber,
                    can_be_multiplied: canBeMultiplied,
                    business_rule: businessRule,
                    example_calculation: exampleCalc,
                    notes: notes.length > 0 ? notes : null
                });
            }
        }
    }
    
    return data;
}

function generateSQL(data) {
    let sql = `-- Dental Tariffs Import SQL
-- Generated from dentalpractice_codes_2025.xlsx
-- Total procedures: ${data.length}

-- Drop existing table if it exists
DROP TABLE IF EXISTS dental_tariffs CASCADE;

-- Create dental tariffs table
CREATE TABLE dental_tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code INTEGER UNIQUE NOT NULL,
    description TEXT NOT NULL,
    price_nad DECIMAL(10,2) NOT NULL,
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

-- Insert dental tariff data
INSERT INTO dental_tariffs (
    code, description, price_nad, found_in_claims, requires_tooth_number, 
    can_be_multiplied, business_rule, example_calculation, notes
) VALUES
`;

    const values = data.map(row => {
        const notes = row.notes && row.notes.length > 0 ? `'${row.notes}'` : 'NULL';
        return `(${row.code}, '${row.description}', ${row.price_nad}, ${row.found_in_claims}, ${row.requires_tooth_number}, '${row.can_be_multiplied}', '${row.business_rule}', '${row.example_calculation}', ${notes})`;
    });

    sql += values.join(',\n');
    sql += ';\n\n';

    // Add helper functions
    sql += `-- Helper function to calculate procedure price with quantity
CREATE OR REPLACE FUNCTION calculate_procedure_price(
    p_code INTEGER,
    p_quantity INTEGER DEFAULT 1
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    tariff RECORD;
    calculated_price DECIMAL(10,2);
BEGIN
    SELECT * INTO tariff FROM dental_tariffs WHERE code = p_code;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tariff not found for code: %', p_code;
    END IF;
    
    CASE tariff.can_be_multiplied
        WHEN 'YES' THEN
            calculated_price := tariff.price_nad * p_quantity;
        WHEN 'SOMETIMES' THEN
            -- For 'SOMETIMES', allow multiplication but cap at reasonable limits
            calculated_price := tariff.price_nad * LEAST(p_quantity, 10);
        WHEN 'PROGRESSIVE' THEN
            -- Progressive pricing with bulk discount
            calculated_price := tariff.price_nad * p_quantity * 
                CASE 
                    WHEN p_quantity >= 5 THEN 0.9  -- 10% discount for 5+
                    WHEN p_quantity >= 3 THEN 0.95 -- 5% discount for 3+
                    ELSE 1.0 
                END;
        ELSE
            calculated_price := tariff.price_nad;
    END CASE;
    
    RETURN calculated_price;
END;
$$ LANGUAGE plpgsql;

-- Function to search procedures by description
CREATE OR REPLACE FUNCTION search_dental_procedures(search_term TEXT)
RETURNS TABLE(
    code INTEGER,
    description TEXT,
    price_nad DECIMAL(10,2),
    requires_tooth_number BOOLEAN,
    can_be_multiplied VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
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

-- Create supporting tables for billing integration
CREATE TABLE IF NOT EXISTS appointment_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID,
    tariff_code INTEGER REFERENCES dental_tariffs(code),
    tooth_number VARCHAR(10),
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointment_procedures_appointment ON appointment_procedures(appointment_id);
CREATE INDEX idx_appointment_procedures_tariff ON appointment_procedures(tariff_code);

-- Verification queries
SELECT 'Total dental procedures imported:' as info, COUNT(*) as count FROM dental_tariffs;
SELECT 'Price range:' as info, MIN(price_nad) as min_price, MAX(price_nad) as max_price FROM dental_tariffs;
SELECT 'Procedures requiring tooth number:' as info, COUNT(*) as count FROM dental_tariffs WHERE requires_tooth_number = true;
SELECT 'Procedures that can be multiplied:' as info, COUNT(*) as count FROM dental_tariffs WHERE can_be_multiplied != 'NO';

-- Sample expensive procedures
SELECT code, description, price_nad 
FROM dental_tariffs 
WHERE price_nad > 1000 
ORDER BY price_nad DESC 
LIMIT 5;
`;

    return sql;
}

function main() {
    console.log('🦷 Dental Tariffs SQL Generator');
    console.log('=' .repeat(40));
    
    try {
        const data = parseCSV('/home/happy/projects/hpms/dental_codes_Sheet1.csv');
        console.log(`Parsed ${data.length} dental procedures`);
        
        const sql = generateSQL(data);
        
        const outputPath = '/home/happy/projects/hpms/import_dental_tariffs.sql';
        fs.writeFileSync(outputPath, sql);
        
        console.log(`✅ SQL script generated: ${outputPath}`);
        console.log('\nTo import the data:');
        console.log('1. Copy the SQL script content');
        console.log('2. Go to Supabase SQL Editor');
        console.log('3. Paste and execute the script');
        console.log('\nOr use the execute-migrations-like-bolt.js script');
        
        // Show summary
        console.log(`\n📊 Summary:`);
        console.log(`- Total procedures: ${data.length}`);
        
        const priceRanges = {
            under100: data.filter(d => d.price_nad < 100).length,
            under500: data.filter(d => d.price_nad >= 100 && d.price_nad < 500).length,
            under1000: data.filter(d => d.price_nad >= 500 && d.price_nad < 1000).length,
            over1000: data.filter(d => d.price_nad >= 1000).length
        };
        
        console.log(`- Under 100 NAD: ${priceRanges.under100}`);
        console.log(`- 100-500 NAD: ${priceRanges.under500}`);
        console.log(`- 500-1000 NAD: ${priceRanges.under1000}`);
        console.log(`- Over 1000 NAD: ${priceRanges.over1000}`);
        
        const multiplyTypes = {};
        data.forEach(d => {
            multiplyTypes[d.can_be_multiplied] = (multiplyTypes[d.can_be_multiplied] || 0) + 1;
        });
        
        console.log(`\n🔢 Multiplication rules:`);
        Object.entries(multiplyTypes).forEach(([type, count]) => {
            console.log(`- ${type}: ${count} procedures`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main();