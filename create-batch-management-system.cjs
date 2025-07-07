const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function createBatchManagementSystem() {
  console.log('🏗️ Creating comprehensive batch management system for medical aid claims...\n');
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // First, let's create the core tables for medical aid claim batching
    console.log('\n📋 Creating batch management tables...');

    // 1. BATCH HEADERS TABLE
    console.log('Creating batch_headers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_headers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES practices(id),
        practice_number VARCHAR(15) NOT NULL, -- e.g., '0540001133241'
        system_identification INTEGER DEFAULT 1,
        transaction_type CHAR(1) DEFAULT 'D',
        batch_number INTEGER NOT NULL, -- Sequential batch number
        batch_date DATE NOT NULL, -- Date batch is confirmed and ready to send (CCYYMMDD format)
        source_software VARCHAR(50) DEFAULT 'OneHealth',
        source_software_version VARCHAR(10) DEFAULT '2.1',
        medical_aid_reference VARCHAR(10) NOT NULL, -- NAMM, NMC1, NHPM, MAG1, PROS
        total_invoices INTEGER DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'active', -- active, sent, completed, cancelled
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sent_at TIMESTAMP WITH TIME ZONE NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE NULL,
        
        -- Unique constraint to prevent duplicate batches per medical aid per day
        UNIQUE(practice_id, medical_aid_reference, batch_date, batch_number)
      );
    `);

    // 2. BATCH DETAILS TABLE (Line items per invoice)
    console.log('Creating batch_details table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_header_id UUID REFERENCES batch_headers(id) ON DELETE CASCADE,
        transaction_id CHAR(1) DEFAULT 'D', -- Always 'D' for detail
        transaction_number_in_batch INTEGER NOT NULL, -- Sequential number within batch
        system_transaction_number INTEGER,
        system_patient_reference_number VARCHAR(20),
        type_of_service CHAR(1) DEFAULT 'T', -- T for Treatment
        medical_aid_reference VARCHAR(10) NOT NULL,
        not_used_1 VARCHAR(10) DEFAULT '', -- Leave blank as per requirements
        medical_aid_membership_number VARCHAR(20),
        member_surname VARCHAR(50),
        member_initials VARCHAR(10),
        patient_name VARCHAR(100),
        patient_date_of_birth DATE,
        bhf_tariff_code VARCHAR(10) NOT NULL, -- e.g., '8101', '8110'
        service_amount DECIMAL(10,2) NOT NULL,
        diagnosis TEXT,
        discount_amount DECIMAL(10,2) DEFAULT 0.00,
        service_date DATE NOT NULL,
        number_of_services DECIMAL(5,2) DEFAULT 1.00,
        service_fee INTEGER DEFAULT 7, -- Default service fee
        modifier_1 VARCHAR(10) DEFAULT '', -- Blank for now
        modifier_2 VARCHAR(10) DEFAULT '',
        modifier_3 VARCHAR(10) DEFAULT '',
        modifier_4 VARCHAR(10) DEFAULT '',
        invoice_number VARCHAR(20) NOT NULL,
        referring_doctor VARCHAR(50) DEFAULT '',
        nappi_code VARCHAR(20) DEFAULT '',
        referred_to_practice_number VARCHAR(15) DEFAULT '',
        not_used_2 VARCHAR(10) DEFAULT '',
        practice_number VARCHAR(15) NOT NULL,
        hospital_indicator VARCHAR(10) DEFAULT '', -- Blank for now
        authorisation_number VARCHAR(20) DEFAULT '',
        resubmission_flag VARCHAR(10) DEFAULT '',
        diagnostic_code VARCHAR(20) DEFAULT '',
        diagnostic_code_type VARCHAR(10) DEFAULT '',
        dosage_description TEXT DEFAULT '',
        not_used_3 VARCHAR(10) DEFAULT '',
        treating_doctor_hpcsa_number VARCHAR(20),
        tooth_numbers VARCHAR(50) DEFAULT '', -- For dental procedures
        gender CHAR(1) NOT NULL, -- M or F
        tariff_code_type CHAR(1) DEFAULT 'T', -- T for Tariff
        cpt_cdt_code VARCHAR(20) DEFAULT '',
        free_text TEXT DEFAULT '',
        place_of_service VARCHAR(20) DEFAULT '',
        referring_doctor_2 VARCHAR(50) DEFAULT '',
        tracking_number VARCHAR(30) DEFAULT '',
        reading_additions VARCHAR(100) DEFAULT '',
        lens_prescription VARCHAR(100) DEFAULT '',
        density_of_tint VARCHAR(50) DEFAULT '',
        patient_id_number VARCHAR(20) NOT NULL,
        service_time TIME DEFAULT NULL,
        employer_name VARCHAR(100) DEFAULT '',
        employee_number VARCHAR(50) DEFAULT '',
        date_of_injury DATE DEFAULT NULL,
        iod_reference_number VARCHAR(30) DEFAULT '',
        
        -- Foreign keys to link to actual data
        patient_id UUID REFERENCES patients(id),
        visit_id UUID REFERENCES visits(id),
        visit_service_id UUID, -- Will reference visit_services when available
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. BATCH TRAILER TABLE
    console.log('Creating batch_trailer table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_trailer (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_header_id UUID REFERENCES batch_headers(id) ON DELETE CASCADE,
        trailer_identifier CHAR(1) DEFAULT 'Z',
        total_detail_transactions INTEGER NOT NULL,
        total_amount_detail_transactions DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Ensure one trailer per batch
        UNIQUE(batch_header_id)
      );
    `);

    // 4. Create indexes for performance
    console.log('Creating indexes for optimal performance...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_headers_practice_id ON batch_headers(practice_id);
      CREATE INDEX IF NOT EXISTS idx_batch_headers_medical_aid ON batch_headers(medical_aid_reference);
      CREATE INDEX IF NOT EXISTS idx_batch_headers_status ON batch_headers(status);
      CREATE INDEX IF NOT EXISTS idx_batch_headers_batch_date ON batch_headers(batch_date);
      
      CREATE INDEX IF NOT EXISTS idx_batch_details_batch_header_id ON batch_details(batch_header_id);
      CREATE INDEX IF NOT EXISTS idx_batch_details_patient_id ON batch_details(patient_id);
      CREATE INDEX IF NOT EXISTS idx_batch_details_visit_id ON batch_details(visit_id);
      CREATE INDEX IF NOT EXISTS idx_batch_details_invoice_number ON batch_details(invoice_number);
      
      CREATE INDEX IF NOT EXISTS idx_batch_trailer_batch_header_id ON batch_trailer(batch_header_id);
    `);

    // 5. Create triggers to automatically update totals
    console.log('Creating triggers for automatic batch total calculations...');
    
    // Function to update batch header totals
    await client.query(`
      CREATE OR REPLACE FUNCTION update_batch_header_totals()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update the batch header with current totals
        UPDATE batch_headers 
        SET 
          total_invoices = (
            SELECT COUNT(DISTINCT invoice_number) 
            FROM batch_details 
            WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)
          ),
          total_amount = (
            SELECT COALESCE(SUM(service_amount - discount_amount), 0) 
            FROM batch_details 
            WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)
          ),
          updated_at = NOW()
        WHERE id = COALESCE(NEW.batch_header_id, OLD.batch_header_id);
        
        -- Update or create the batch trailer
        INSERT INTO batch_trailer (
          batch_header_id, 
          total_detail_transactions, 
          total_amount_detail_transactions
        ) 
        VALUES (
          COALESCE(NEW.batch_header_id, OLD.batch_header_id),
          (SELECT COUNT(*) FROM batch_details WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)),
          (SELECT COALESCE(SUM(service_amount - discount_amount), 0) FROM batch_details WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id))
        )
        ON CONFLICT (batch_header_id) 
        DO UPDATE SET
          total_detail_transactions = (SELECT COUNT(*) FROM batch_details WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)),
          total_amount_detail_transactions = (SELECT COALESCE(SUM(service_amount - discount_amount), 0) FROM batch_details WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id));
        
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_batch_totals_insert ON batch_details;
      CREATE TRIGGER trigger_update_batch_totals_insert
        AFTER INSERT ON batch_details
        FOR EACH ROW EXECUTE FUNCTION update_batch_header_totals();
      
      DROP TRIGGER IF EXISTS trigger_update_batch_totals_update ON batch_details;
      CREATE TRIGGER trigger_update_batch_totals_update
        AFTER UPDATE ON batch_details
        FOR EACH ROW EXECUTE FUNCTION update_batch_header_totals();
      
      DROP TRIGGER IF EXISTS trigger_update_batch_totals_delete ON batch_details;
      CREATE TRIGGER trigger_update_batch_totals_delete
        AFTER DELETE ON batch_details
        FOR EACH ROW EXECUTE FUNCTION update_batch_header_totals();
    `);

    // 6. Create a comprehensive view for easy batch management
    console.log('Creating comprehensive batch management view...');
    await client.query(`
      CREATE OR REPLACE VIEW batch_management_view AS
      SELECT 
        bh.id as batch_id,
        bh.practice_number,
        bh.batch_number,
        bh.batch_date,
        bh.medical_aid_reference,
        bh.status,
        bh.total_invoices,
        bh.total_amount,
        bh.created_at,
        bh.sent_at,
        bh.confirmed_at,
        
        -- Medical aid provider details
        map.name as medical_aid_name,
        map.short_name as medical_aid_short_name,
        map.email as medical_aid_email,
        
        -- Practice details
        p.name as practice_name,
        p.contact_email as practice_email,
        
        -- Batch details count
        COALESCE(bd_count.detail_count, 0) as detail_transactions,
        
        -- Trailer information
        bt.total_detail_transactions,
        bt.total_amount_detail_transactions,
        
        -- Generate filename for .dat file
        CONCAT(
          bh.practice_number, '_', 
          bh.batch_number, '_', 
          bh.medical_aid_reference
        ) as dat_filename
      FROM batch_headers bh
      LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
      LEFT JOIN practices p ON p.id = bh.practice_id
      LEFT JOIN batch_trailer bt ON bt.batch_header_id = bh.id
      LEFT JOIN (
        SELECT batch_header_id, COUNT(*) as detail_count
        FROM batch_details 
        GROUP BY batch_header_id
      ) bd_count ON bd_count.batch_header_id = bh.id
      ORDER BY bh.batch_date DESC, bh.batch_number DESC;
    `);

    // 7. Create helper functions for batch management
    console.log('Creating helper functions for batch operations...');
    
    // Function to create a new batch
    await client.query(`
      CREATE OR REPLACE FUNCTION create_new_batch(
        p_practice_id UUID,
        p_medical_aid_reference VARCHAR(10),
        p_batch_date DATE DEFAULT CURRENT_DATE
      )
      RETURNS UUID AS $$
      DECLARE
        v_practice_number VARCHAR(15);
        v_next_batch_number INTEGER;
        v_batch_id UUID;
      BEGIN
        -- Get practice number
        SELECT practice_number INTO v_practice_number
        FROM practices 
        WHERE id = p_practice_id;
        
        IF v_practice_number IS NULL THEN
          RAISE EXCEPTION 'Practice not found or practice_number not set';
        END IF;
        
        -- Get next batch number for this medical aid and date
        SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_next_batch_number
        FROM batch_headers 
        WHERE practice_id = p_practice_id 
          AND medical_aid_reference = p_medical_aid_reference 
          AND batch_date = p_batch_date;
        
        -- Create new batch header
        INSERT INTO batch_headers (
          practice_id,
          practice_number,
          batch_number,
          batch_date,
          medical_aid_reference,
          status
        ) VALUES (
          p_practice_id,
          v_practice_number,
          v_next_batch_number,
          p_batch_date,
          p_medical_aid_reference,
          'active'
        ) RETURNING id INTO v_batch_id;
        
        RETURN v_batch_id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function to get active batch for medical aid
    await client.query(`
      CREATE OR REPLACE FUNCTION get_or_create_active_batch(
        p_practice_id UUID,
        p_medical_aid_reference VARCHAR(10),
        p_batch_date DATE DEFAULT CURRENT_DATE
      )
      RETURNS UUID AS $$
      DECLARE
        v_batch_id UUID;
      BEGIN
        -- Try to find existing active batch
        SELECT id INTO v_batch_id
        FROM batch_headers
        WHERE practice_id = p_practice_id
          AND medical_aid_reference = p_medical_aid_reference
          AND batch_date = p_batch_date
          AND status = 'active'
        LIMIT 1;
        
        -- If no active batch found, create new one
        IF v_batch_id IS NULL THEN
          v_batch_id := create_new_batch(p_practice_id, p_medical_aid_reference, p_batch_date);
        END IF;
        
        RETURN v_batch_id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 8. Insert sample data to test the system
    console.log('Creating sample batch data for testing...');
    
    // Get NewCharm practice ID and create sample batches for each medical aid
    const { rows: practices } = await client.query(`
      SELECT id, practice_number FROM practices WHERE practice_number IS NOT NULL LIMIT 1
    `);
    
    if (practices.length > 0) {
      const practiceId = practices[0].id;
      const practiceNumber = practices[0].practice_number || '0540001133241';
      
      // Update practice number if null
      if (!practices[0].practice_number) {
        await client.query(`
          UPDATE practices SET practice_number = $1 WHERE id = $2
        `, [practiceNumber, practiceId]);
        console.log(`✅ Updated practice number to: ${practiceNumber}`);
      }
      
      // Get all medical aid providers
      const { rows: medicalAids } = await client.query(`
        SELECT medical_aid_reference, name FROM medical_aid_providers ORDER BY medical_aid_reference
      `);
      
      // Create active batches for each medical aid
      for (const medicalAid of medicalAids) {
        const batchId = await client.query(`
          SELECT create_new_batch($1, $2, $3) as batch_id
        `, [practiceId, medicalAid.medical_aid_reference, new Date()]);
        
        console.log(`✅ Created active batch for ${medicalAid.name} (${medicalAid.medical_aid_reference})`);
        
        // Add some sample batch details if we have patients with this medical aid
        const { rows: patientsWithAid } = await client.query(`
          SELECT p.id, p.first_name, p.last_name, p.id_number, p.date_of_birth, p.gender,
                 mad.membership_number, mad.main_member_name
          FROM patients p
          JOIN medical_aid_details mad ON mad.patient_id = p.id
          JOIN medical_aid_providers map ON map.name = mad.provider
          WHERE map.medical_aid_reference = $1
          LIMIT 3
        `, [medicalAid.medical_aid_reference]);
        
        let transactionNumber = 1;
        for (const patient of patientsWithAid) {
          // Add sample dental services for this patient
          const sampleServices = [
            { code: '8101', amount: 242.40, description: 'Full mouth examination and charting' },
            { code: '8110', amount: 73.10, description: 'Provision of sterilised instruments' },
            { code: '8159', amount: 390.50, description: 'Scaling and polishing' }
          ];
          
          for (const service of sampleServices) {
            await client.query(`
              INSERT INTO batch_details (
                batch_header_id, transaction_number_in_batch, system_patient_reference_number,
                medical_aid_reference, medical_aid_membership_number, member_surname,
                member_initials, patient_name, patient_date_of_birth, bhf_tariff_code,
                service_amount, diagnosis, service_date, invoice_number, practice_number,
                treating_doctor_hpcsa_number, gender, patient_id_number, patient_id
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
              )
            `, [
              batchId.rows[0].batch_id,
              transactionNumber++,
              patient.id.toString().slice(-7), // Last 7 chars of UUID
              medicalAid.medical_aid_reference,
              patient.membership_number,
              patient.last_name.toUpperCase(),
              patient.first_name.charAt(0).toUpperCase(),
              `${patient.first_name} ${patient.last_name}`.toUpperCase(),
              patient.date_of_birth,
              service.code,
              service.amount,
              service.description.toUpperCase(),
              new Date(),
              `INV${Date.now().toString().slice(-6)}${transactionNumber}`,
              practiceNumber,
              'DEN00417', // Sample HPCSA number
              patient.gender.charAt(0).toUpperCase(),
              patient.id_number,
              patient.id
            ]);
          }
        }
      }
    }

    console.log('\n🎉 Batch management system created successfully!');
    console.log('\n📊 System Overview:');
    console.log('✅ batch_headers - Main batch records');
    console.log('✅ batch_details - Individual line items per invoice');
    console.log('✅ batch_trailer - Batch totals and summary');
    console.log('✅ batch_management_view - Comprehensive view for UI');
    console.log('✅ Automated triggers for total calculations');
    console.log('✅ Helper functions for batch operations');
    console.log('✅ Sample data created for testing');

    // Test the view
    const { rows: batchSummary } = await client.query(`
      SELECT 
        medical_aid_reference,
        COUNT(*) as active_batches,
        SUM(total_amount) as total_value,
        SUM(total_invoices) as total_invoices
      FROM batch_management_view 
      WHERE status = 'active'
      GROUP BY medical_aid_reference
      ORDER BY medical_aid_reference
    `);

    console.log('\n📋 Active Batches Summary:');
    batchSummary.forEach(batch => {
      console.log(`${batch.medical_aid_reference}: ${batch.active_batches} batches, ${batch.total_invoices} invoices, N$${parseFloat(batch.total_value).toFixed(2)}`);
    });

  } catch (error) {
    console.error('❌ Error creating batch management system:', error);
    throw error;
  } finally {
    await client.end();
  }
}

createBatchManagementSystem();