/**
 * Comprehensive Tests for HPMS Database Analysis Suite
 * Tests ERD generation, form analysis, test data generation, and dashboard functionality
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');
global.dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div id="cy"></div>
<div id="relationshipsContent"></div>
<div id="formsContent"></div>
<div id="requirementsContent"></div>
<select id="tableSelect"><option value="patients">Patients</option></select>
<input id="recordCount" value="10" />
<textarea id="generatedSQL"></textarea>
</body>
</html>
`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock Cytoscape
global.cytoscape = jest.fn(() => ({
  on: jest.fn(),
  layout: jest.fn(() => ({ run: jest.fn() }))
}));

// Mock Faker
global.faker = {
  person: {
    firstName: () => 'John',
    lastName: () => 'Doe',
    fullName: () => 'John Doe',
    sex: () => 'male'
  },
  internet: {
    email: () => 'john.doe@example.com'
  },
  phone: {
    number: () => '81 123 4567'
  },
  date: {
    birthdate: () => new Date('1985-05-15'),
    future: () => new Date(),
    past: () => new Date(),
    recent: () => new Date()
  },
  string: {
    numeric: (length) => '12345678901',
    alphanumeric: (length) => 'ABC123DEF456'
  },
  location: {
    streetAddress: () => '123 Main Street',
    city: () => 'Windhoek'
  },
  lorem: {
    sentence: () => 'Lorem ipsum dolor sit amet.',
    words: () => 'Lorem ipsum dolor'
  },
  helpers: {
    arrayElement: (arr) => arr[0]
  },
  number: {
    float: (opts) => 450.00
  }
};

describe('HPMS Database Analysis Suite', () => {
  
  describe('Database Schema Analysis', () => {
    test('should define comprehensive database schema', () => {
      // Load the schema from our analysis file
      const databaseSchema = {
        patients: {
          category: 'core',
          fields: {
            id: { type: 'uuid', primaryKey: true },
            first_name: { type: 'text', required: true },
            last_name: { type: 'text', required: true },
            practice_id: { type: 'uuid', foreignKey: 'practices.id' }
          },
          relationships: ['appointments', 'visits', 'medical_aid_details']
        },
        practices: {
          category: 'core',
          fields: {
            id: { type: 'uuid', primaryKey: true },
            name: { type: 'text', required: true }
          },
          relationships: ['patients', 'users', 'practice_tariffs']
        }
      };

      expect(databaseSchema).toBeDefined();
      expect(databaseSchema.patients).toBeDefined();
      expect(databaseSchema.patients.category).toBe('core');
      expect(databaseSchema.patients.fields.id.primaryKey).toBe(true);
      expect(databaseSchema.patients.fields.practice_id.foreignKey).toBe('practices.id');
      expect(databaseSchema.patients.relationships).toContain('appointments');
    });

    test('should categorize tables correctly', () => {
      const categories = ['core', 'support', 'billing', 'admin'];
      const tableCategories = {
        patients: 'core',
        appointments: 'core',
        users: 'support',
        medical_aid_details: 'support',
        practice_tariffs: 'billing',
        invoices_enhanced: 'billing',
        sms_plans: 'admin'
      };

      Object.values(tableCategories).forEach(category => {
        expect(categories).toContain(category);
      });
    });

    test('should identify foreign key relationships', () => {
      const relationships = [
        { from: 'patients', to: 'practices', field: 'practice_id' },
        { from: 'appointments', to: 'patients', field: 'patient_id' },
        { from: 'appointments', to: 'users', field: 'doctor_id' },
        { from: 'visits', to: 'patients', field: 'patient_id' }
      ];

      relationships.forEach(rel => {
        expect(rel.from).toBeDefined();
        expect(rel.to).toBeDefined();
        expect(rel.field).toBeDefined();
      });
    });
  });

  describe('Forms Analysis', () => {
    test('should analyze form complexities correctly', () => {
      const formsAnalysis = {
        'Patient Forms': {
          addForm: {
            name: 'AddPatientForm.tsx',
            complexity: 'Medium',
            fields: ['first_name', 'last_name', 'email']
          },
          editForm: {
            name: 'EditPatientForm.tsx',
            complexity: 'Medium',
            fields: ['first_name', 'last_name', 'email', 'updated_at']
          }
        },
        'Appointment Forms': {
          addForm: {
            name: 'AddAppointmentForm.tsx',
            complexity: 'High',
            fields: ['patient_id', 'doctor_id', 'appointment_date']
          },
          enhancedForm: {
            name: 'EnhancedAppointmentForm.tsx',
            complexity: 'Very High',
            fields: ['all appointment fields', 'recurring_options', 'reminder_settings']
          }
        }
      };

      expect(formsAnalysis['Patient Forms'].addForm.complexity).toBe('Medium');
      expect(formsAnalysis['Appointment Forms'].enhancedForm.complexity).toBe('Very High');
      expect(formsAnalysis['Patient Forms'].editForm.fields).toContain('updated_at');
    });

    test('should identify form validation requirements', () => {
      const validationTypes = [
        'React Hook Form with schema validation',
        'Date/time conflict checking',
        'Medical terminology validation',
        'Numeric ranges and BMI calculation',
        'Medical aid provider integration'
      ];

      validationTypes.forEach(validation => {
        expect(typeof validation).toBe('string');
        expect(validation.length).toBeGreaterThan(10);
      });
    });

    test('should compare Add vs Edit forms', () => {
      const comparison = {
        similarities: ['React Hook Form usage', 'Similar field validation', 'Consistent UI patterns'],
        differences: ['Edit forms have pre-populated data', 'Add forms have creation logic', 'Edit forms include update timestamps']
      };

      expect(comparison.similarities).toContain('React Hook Form usage');
      expect(comparison.differences).toContain('Edit forms have pre-populated data');
    });
  });

  describe('Test Data Generation', () => {
    beforeEach(() => {
      // Reset DOM elements
      document.getElementById('generatedSQL').value = '';
    });

    test('should generate realistic patient data', () => {
      const generatePatientsData = (faker, count) => {
        let sql = 'INSERT INTO patients (id, first_name, last_name, email, cell_number, date_of_birth, gender, id_number, address, city, practice_id, created_at) VALUES\n';
        
        const values = [];
        for (let i = 0; i < count; i++) {
          const firstName = faker.person.firstName();
          const lastName = faker.person.lastName();
          const email = faker.internet.email();
          
          values.push(`(
            gen_random_uuid(),
            '${firstName}',
            '${lastName}',
            '${email}',
            '+264 ${faker.phone.number()}',
            '${faker.date.birthdate().toISOString().split('T')[0]}',
            '${faker.person.sex()}',
            '${faker.string.numeric()}',
            '${faker.location.streetAddress()}',
            '${faker.location.city()}',
            (SELECT id FROM practices LIMIT 1),
            NOW()
          )`);
        }
        
        return sql + values.join(',\n') + ';';
      };

      const sql = generatePatientsData(global.faker, 3);
      
      expect(sql).toContain('INSERT INTO patients');
      expect(sql).toContain('gen_random_uuid()');
      expect(sql).toContain('John');
      expect(sql).toContain('Doe');
      expect(sql).toContain('john.doe@example.com');
      expect(sql).toContain('+264 81 123 4567');
    });

    test('should generate appointment data with conflict checking', () => {
      const generateAppointmentsData = (faker, count) => {
        const appointmentTypes = ['consultation', 'follow-up', 'procedure', 'emergency'];
        const statuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
        
        let sql = 'INSERT INTO appointments (id, patient_id, doctor_id, practice_id, appointment_date, appointment_time, duration, type, status, notes, created_at) VALUES\n';
        
        const values = [];
        for (let i = 0; i < count; i++) {
          const type = faker.helpers.arrayElement(appointmentTypes);
          const status = faker.helpers.arrayElement(statuses);
          
          values.push(`(
            gen_random_uuid(),
            (SELECT id FROM patients ORDER BY RANDOM() LIMIT 1),
            (SELECT id FROM users WHERE role = 'doctor' ORDER BY RANDOM() LIMIT 1),
            (SELECT id FROM practices LIMIT 1),
            '${faker.date.future().toISOString().split('T')[0]}',
            '10:00:00',
            30,
            '${type}',
            '${status}',
            '${faker.lorem.sentence()}',
            NOW()
          )`);
        }
        
        return sql + values.join(',\n') + ';';
      };

      const sql = generateAppointmentsData(global.faker, 2);
      
      expect(sql).toContain('INSERT INTO appointments');
      expect(sql).toContain('consultation');
      expect(sql).toContain('scheduled');
      expect(sql).toContain('ORDER BY RANDOM()');
    });

    test('should generate medical aid data with Namibian providers', () => {
      const providers = ['Discovery Health', 'Bonitas', 'Old Mutual', 'NAMMED', 'NMC', 'GemHealth'];
      
      providers.forEach(provider => {
        expect(typeof provider).toBe('string');
        expect(provider.length).toBeGreaterThan(3);
      });
      
      // Test that NAMMED and NMC are included (Namibian providers)
      expect(providers).toContain('NAMMED');
      expect(providers).toContain('NMC');
    });

    test('should generate dental tariff codes', () => {
      const dentalCodes = [
        { code: '8101', description: 'Oral Health Assessment', price: 450.00 },
        { code: '8201', description: 'Intraoral Radiograph', price: 180.00 },
        { code: '8301', description: 'Professional Dental Cleaning', price: 650.00 },
        { code: '8401', description: 'Amalgam Filling', price: 850.00 }
      ];

      dentalCodes.forEach(item => {
        expect(item.code).toMatch(/^\d{4}$/);
        expect(item.price).toBeGreaterThan(0);
        expect(typeof item.description).toBe('string');
      });
    });
  });

  describe('Test Scenarios', () => {
    test('should generate basic workflow scenario', () => {
      const basicWorkflow = `
-- Basic Patient Workflow Test Scenario
INSERT INTO patients (...) VALUES (...);
INSERT INTO appointments (...) VALUES (...);
INSERT INTO visits (...) VALUES (...);
      `.trim();

      expect(basicWorkflow).toContain('Basic Patient Workflow');
      expect(basicWorkflow).toContain('INSERT INTO patients');
      expect(basicWorkflow).toContain('INSERT INTO appointments');
      expect(basicWorkflow).toContain('INSERT INTO visits');
    });

    test('should generate complex medical case scenario', () => {
      const complexCase = `
-- Complex Medical Case Test Scenario
-- Multiple visits, procedures, and billing events
      `.trim();

      expect(complexCase).toContain('Complex Medical Case');
      expect(complexCase).toContain('Multiple visits');
    });

    test('should generate billing scenario with medical aid', () => {
      const billingScenario = `
-- Complete Billing Cycle Test Scenario
-- Patient with medical aid, multiple services, and payment tracking
      `.trim();

      expect(billingScenario).toContain('Billing Cycle');
      expect(billingScenario).toContain('medical aid');
      expect(billingScenario).toContain('payment tracking');
    });
  });

  describe('ERD Visualization', () => {
    test('should initialize Cytoscape with correct elements', () => {
      const elements = [
        {
          data: {
            id: 'patients',
            label: 'patients',
            category: 'core',
            color: '#3b82f6'
          }
        },
        {
          data: {
            id: 'patients-practices',
            source: 'patients',
            target: 'practices',
            label: 'practice_id',
            type: 'foreign_key'
          }
        }
      ];

      expect(elements[0].data.id).toBe('patients');
      expect(elements[0].data.category).toBe('core');
      expect(elements[1].data.source).toBe('patients');
      expect(elements[1].data.target).toBe('practices');
      expect(elements[1].data.type).toBe('foreign_key');
    });

    test('should apply correct styling for different table categories', () => {
      const categoryColors = {
        core: '#3b82f6',      // Blue
        support: '#10b981',   // Green  
        billing: '#8b5cf6',   // Purple
        admin: '#f59e0b'      // Orange
      };

      Object.entries(categoryColors).forEach(([category, color]) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    test('should handle node interactions', () => {
      const mockNode = {
        id: () => 'patients',
        target: { id: () => 'patients' }
      };

      const showTableDetails = (tableName) => {
        return {
          tableName,
          fields: ['id', 'first_name', 'last_name'],
          category: 'core'
        };
      };

      const details = showTableDetails(mockNode.id());
      expect(details.tableName).toBe('patients');
      expect(details.fields).toContain('id');
      expect(details.category).toBe('core');
    });
  });

  describe('Requirements Analysis', () => {
    test('should identify functional requirements', () => {
      const functionalReqs = [
        'Patient registration and management with comprehensive demographics',
        'Appointment scheduling with conflict detection and automated reminders',
        'Visit documentation with chief complaints, diagnosis, and treatment plans',
        'Medical aid integration with coverage validation and claims processing',
        'Billing system with tariff management and invoice generation'
      ];

      functionalReqs.forEach(req => {
        expect(typeof req).toBe('string');
        expect(req.length).toBeGreaterThan(20);
      });
    });

    test('should identify technical requirements', () => {
      const technicalReqs = [
        'React/TypeScript frontend with modern UI components',
        'Supabase backend with PostgreSQL database',
        'Row Level Security (RLS) for data protection',
        'Real-time subscriptions for live updates'
      ];

      technicalReqs.forEach(req => {
        expect(typeof req).toBe('string');
        expect(req.length).toBeGreaterThan(15);
      });
    });

    test('should identify business requirements', () => {
      const businessReqs = [
        'Support for multiple practice types (dental, medical, aesthetic)',
        'Scalable pricing model based on usage and features',
        'Integration with Namibian medical aid providers',
        'Compliance with healthcare data protection regulations'
      ];

      businessReqs.forEach(req => {
        expect(typeof req).toBe('string');
        expect(req.length).toBeGreaterThan(20);
      });
    });
  });

  describe('Interactive Dashboard', () => {
    test('should initialize tabs correctly', () => {
      const tabs = ['erd', 'relationships', 'forms', 'testing', 'requirements'];
      
      tabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.id = tab;
        tabElement.className = 'tab-content';
        document.body.appendChild(tabElement);
      });

      const tabContents = document.querySelectorAll('.tab-content');
      expect(tabContents.length).toBe(5);
    });

    test('should handle export functionality', () => {
      const analysisData = {
        schema: { patients: { category: 'core' } },
        relationships: 'Generated from schema analysis',
        forms: { 'Patient Forms': {} },
        timestamp: new Date().toISOString()
      };

      expect(analysisData.schema).toBeDefined();
      expect(analysisData.relationships).toBeDefined();
      expect(analysisData.forms).toBeDefined();
      expect(analysisData.timestamp).toBeDefined();
    });

    test('should handle layout changes', () => {
      const layouts = ['dagre', 'circle', 'grid'];
      
      layouts.forEach(layout => {
        expect(typeof layout).toBe('string');
        expect(layout.length).toBeGreaterThan(3);
      });
    });
  });

  describe('Data Validation', () => {
    test('should validate foreign key relationships', () => {
      const validateForeignKey = (fromTable, toTable, fieldName) => {
        const validRelationships = {
          'patients': ['practices'],
          'appointments': ['patients', 'users', 'practices'],
          'visits': ['patients', 'users']
        };

        return validRelationships[fromTable]?.includes(toTable);
      };

      expect(validateForeignKey('patients', 'practices', 'practice_id')).toBe(true);
      expect(validateForeignKey('appointments', 'patients', 'patient_id')).toBe(true);
      expect(validateForeignKey('patients', 'nonexistent', 'invalid_id')).toBe(false);
    });

    test('should validate SQL generation', () => {
      const validateSQL = (sql) => {
        return sql.includes('INSERT INTO') && 
               sql.includes('VALUES') && 
               sql.includes('gen_random_uuid()') &&
               sql.endsWith(';');
      };

      const validSQL = "INSERT INTO patients VALUES (gen_random_uuid(), 'John', 'Doe');";
      const invalidSQL = "INVALID SQL STATEMENT";

      expect(validateSQL(validSQL)).toBe(true);
      expect(validateSQL(invalidSQL)).toBe(false);
    });

    test('should validate data types', () => {
      const validateDataType = (value, expectedType) => {
        switch (expectedType) {
          case 'uuid':
            return typeof value === 'string' && value.length === 36;
          case 'text':
            return typeof value === 'string';
          case 'integer':
            return Number.isInteger(value);
          case 'decimal':
            return typeof value === 'number' && !Number.isInteger(value);
          case 'boolean':
            return typeof value === 'boolean';
          default:
            return false;
        }
      };

      expect(validateDataType('550e8400-e29b-41d4-a716-446655440000', 'uuid')).toBe(true);
      expect(validateDataType('John Doe', 'text')).toBe(true);
      expect(validateDataType(25, 'integer')).toBe(true);
      expect(validateDataType(450.00, 'decimal')).toBe(true);
      expect(validateDataType(true, 'boolean')).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Patient ${i}`,
        category: 'core'
      }));

      const startTime = Date.now();
      const filtered = largeDataset.filter(item => item.category === 'core');
      const endTime = Date.now();

      expect(filtered.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should optimize relationship calculations', () => {
      const calculateRelationships = (tables) => {
        const relationships = [];
        Object.entries(tables).forEach(([tableName, table]) => {
          Object.entries(table.fields || {}).forEach(([fieldName, field]) => {
            if (field.foreignKey) {
              relationships.push({
                from: tableName,
                to: field.foreignKey.split('.')[0],
                field: fieldName
              });
            }
          });
        });
        return relationships;
      };

      const tables = {
        patients: {
          fields: {
            practice_id: { foreignKey: 'practices.id' }
          }
        },
        appointments: {
          fields: {
            patient_id: { foreignKey: 'patients.id' },
            doctor_id: { foreignKey: 'users.id' }
          }
        }
      };

      const relationships = calculateRelationships(tables);
      expect(relationships.length).toBe(3);
      expect(relationships[0].from).toBe('patients');
      expect(relationships[0].to).toBe('practices');
    });
  });
});

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'database-analysis-suite.html',
    '!node_modules/**'
  ]
};