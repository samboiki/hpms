import React, { useState } from 'react';
import { supabase } from './lib/supabase';

const EmergencySchemaExporter: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');

  const exportSchema = async () => {
    setIsExporting(true);
    setStatus('Starting emergency export...');
    
    let schema = `-- EMERGENCY SCHEMA EXPORT FROM FRONTEND
-- Generated: ${new Date().toISOString()}
-- Status: CRITICAL LIFE AND DEATH EXPORT
-- Connection: Supabase Client (Working Connection)

`;

    try {
      // 1. Get system info first
      setStatus('Getting critical system information...');
      try {
        const { data: systemInfo } = await supabase.rpc('get_critical_system_info');
        if (systemInfo) {
          schema += `-- CRITICAL SYSTEM INFO\n`;
          schema += `-- Export Time: ${systemInfo.export_time}\n`;
          schema += `-- Database Version: ${systemInfo.database_version}\n`;
          schema += `-- Tables: ${systemInfo.table_count}\n`;
          schema += `-- Total Rows: ${systemInfo.total_rows}\n`;
          schema += `-- Practices: ${systemInfo.practices_count}\n`;
          schema += `-- Patients: ${systemInfo.patients_count}\n`;
          schema += `-- Appointments: ${systemInfo.appointments_count}\n`;
          schema += `-- Users: ${systemInfo.users_count}\n\n`;
        }
      } catch (sysError) {
        schema += `-- SYSTEM INFO ERROR: ${sysError.message}\n`;
      }

      // 2. Get all tables with enhanced information
      setStatus('Fetching tables...');
      try {
        const { data: tables } = await supabase.rpc('get_schema_tables');
        
        if (tables && tables.length > 0) {
          schema += `-- TABLES (${tables.length} found)\n`;
          tables.forEach(t => {
            schema += `-- Table: ${t.table_name} (${t.column_count} columns, ${t.row_count} rows)\n`;
          });
          schema += '\n';
        } else {
          throw new Error('No tables returned from function');
        }
      } catch (tablesError) {
        // Fallback: Try to get tables directly
        setStatus('Using fallback table detection...');
        const { data: tablesFallback } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_type', 'BASE TABLE');
        
        if (tablesFallback) {
          schema += `-- TABLES (${tablesFallback.length} found via fallback)\n`;
          tablesFallback.forEach(t => {
            schema += `-- Table: ${t.table_name}\n`;
          });
        } else {
          schema += `-- ERROR: Could not fetch tables: ${tablesError.message}\n`;
        }
      }

      // 2. Get columns for critical tables
      setStatus('Fetching critical table structures...');
      const criticalTables = [
        'practices', 'patients', 'appointments', 'visits', 'users',
        'medical_records', 'medical_aid_details', 'dental_tariffs',
        'practice_tariffs', 'invoices', 'invoice_items', 'batches'
      ];

      for (const tableName of criticalTables) {
        try {
          setStatus(`Analyzing ${tableName}...`);
          
          const { data: columns } = await supabase
            .from('information_schema.columns')
            .select(`
              column_name,
              data_type,
              character_maximum_length,
              is_nullable,
              column_default
            `)
            .eq('table_name', tableName)
            .eq('table_schema', 'public')
            .order('ordinal_position');

          if (columns && columns.length > 0) {
            schema += `\n-- TABLE: ${tableName}\n`;
            schema += `CREATE TABLE public.${tableName} (\n`;
            
            const columnDefs = columns.map(col => {
              let def = `  ${col.column_name} ${col.data_type}`;
              if (col.character_maximum_length) {
                def += `(${col.character_maximum_length})`;
              }
              if (col.is_nullable === 'NO') {
                def += ' NOT NULL';
              }
              if (col.column_default) {
                def += ` DEFAULT ${col.column_default}`;
              }
              return def;
            });
            
            schema += columnDefs.join(',\n') + '\n);\n';

            // Get row count
            const { count } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
            
            schema += `-- Rows: ${count || 0}\n`;
          }
        } catch (tableError) {
          schema += `-- ERROR with ${tableName}: ${tableError.message}\n`;
        }
      }

      // 3. Get current data from critical config tables
      setStatus('Exporting critical configuration data...');
      
      // Export practices
      try {
        const { data: practicesData } = await supabase
          .from('practices')
          .select('*');
        
        if (practicesData && practicesData.length > 0) {
          schema += `\n-- PRACTICES DATA (${practicesData.length} records)\n`;
          practicesData.forEach(p => {
            schema += `-- Practice: ${p.name} (ID: ${p.id}, Slug: ${p.slug})\n`;
            schema += `INSERT INTO practices (id, name, slug, domain, logo_url, primary_color, contact_email, contact_phone, address, city, country) VALUES (\n`;
            schema += `  '${p.id}', '${p.name?.replace(/'/g, "''")}', '${p.slug}', '${p.domain || ''}', '${p.logo_url || ''}', '${p.primary_color || ''}', '${p.contact_email || ''}', '${p.contact_phone || ''}', '${p.address?.replace(/'/g, "''") || ''}', '${p.city || ''}', '${p.country || 'Namibia'}'\n`;
            schema += `);\n`;
          });
        }
      } catch (practicesError) {
        schema += `-- ERROR exporting practices: ${practicesError.message}\n`;
      }

      // Export medical aid providers
      try {
        const { data: medicalAidData } = await supabase
          .from('medical_aid_providers')
          .select('*')
          .limit(20);
        
        if (medicalAidData && medicalAidData.length > 0) {
          schema += `\n-- MEDICAL AID PROVIDERS (${medicalAidData.length} records)\n`;
          medicalAidData.forEach(m => {
            schema += `-- Provider: ${m.name} (${m.provider_code})\n`;
          });
        }
      } catch (medicalAidError) {
        schema += `-- ERROR exporting medical aid providers: ${medicalAidError.message}\n`;
      }

      // 4. Critical system information
      setStatus('Getting system information...');
      schema += `\n-- SYSTEM INFORMATION\n`;
      schema += `-- Export Time: ${new Date().toISOString()}\n`;
      schema += `-- Database URL: ${supabase.supabaseUrl}\n`;
      schema += `-- Export Method: Frontend Supabase Client\n`;
      schema += `-- Status: EMERGENCY EXPORT COMPLETE\n`;

      setExportData(schema);
      setStatus('✅ Emergency export complete! Copy the data below.');

    } catch (error) {
      setStatus(`❌ Export failed: ${error.message}`);
      setExportData(`-- EXPORT FAILED: ${error.message}\n-- Time: ${new Date().toISOString()}`);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadSchema = () => {
    const blob = new Blob([exportData], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency_schema_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <h1 className="text-2xl font-bold text-red-800 mb-2">
          🚨 EMERGENCY SCHEMA EXPORT
        </h1>
        <p className="text-red-700">
          Critical database schema export tool. This will extract your current database structure and configuration.
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={exportSchema}
          disabled={isExporting}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-6 py-3 rounded-lg font-medium"
        >
          {isExporting ? 'Exporting...' : '🚨 START EMERGENCY EXPORT'}
        </button>
        
        {exportData && (
          <button
            onClick={downloadSchema}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            📥 Download Schema File
          </button>
        )}
      </div>

      <div className="mb-4 p-3 bg-gray-100 rounded border">
        <strong>Status:</strong> {status}
      </div>

      {exportData && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Exported Schema Data:</h3>
            <button
              onClick={() => navigator.clipboard.writeText(exportData)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
            >
              📋 Copy to Clipboard
            </button>
          </div>
          
          <textarea
            value={exportData}
            readOnly
            className="w-full h-96 p-4 border rounded-lg font-mono text-sm bg-gray-50"
            placeholder="Schema data will appear here..."
          />
          
          <div className="text-sm text-gray-600">
            Size: {(exportData.length / 1024).toFixed(2)} KB | 
            Lines: {exportData.split('\n').length}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencySchemaExporter;