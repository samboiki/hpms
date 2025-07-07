import pg from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateTypes() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Query to get all tables and their columns
    const tablesQuery = `
      SELECT 
        t.table_name,
        array_agg(
          json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default,
            'is_primary', EXISTS (
              SELECT 1 FROM information_schema.key_column_usage k
              JOIN information_schema.table_constraints tc 
                ON k.constraint_name = tc.constraint_name
              WHERE k.table_name = t.table_name 
                AND k.column_name = c.column_name
                AND tc.constraint_type = 'PRIMARY KEY'
            )
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;

    const { rows: tables } = await client.query(tablesQuery);
    
    // Generate TypeScript types
    let output = `// Generated TypeScript types for Supabase database
// Generated on: ${new Date().toISOString()}

export interface Database {
  public: {
    Tables: {
`;

    // Type mapping from PostgreSQL to TypeScript
    const typeMap = {
      'integer': 'number',
      'bigint': 'number',
      'smallint': 'number',
      'decimal': 'number',
      'numeric': 'number',
      'real': 'number',
      'double precision': 'number',
      'text': 'string',
      'character varying': 'string',
      'character': 'string',
      'uuid': 'string',
      'boolean': 'boolean',
      'date': 'string',
      'timestamp': 'string',
      'timestamp without time zone': 'string',
      'timestamp with time zone': 'string',
      'time': 'string',
      'time without time zone': 'string',
      'jsonb': 'any',
      'json': 'any',
      'ARRAY': 'any[]'
    };

    // Generate type for each table
    for (const table of tables) {
      const pascalCase = table.table_name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      output += `      ${table.table_name}: {
        Row: {
`;

      // Add columns
      for (const col of table.columns) {
        const tsType = typeMap[col.data_type] || 'any';
        const nullable = col.is_nullable === 'YES' ? ' | null' : '';
        output += `          ${col.column_name}: ${tsType}${nullable};\n`;
      }

      output += `        };
        Insert: {
`;

      // Insert type (nullable for defaults, optional for nullable)
      for (const col of table.columns) {
        const tsType = typeMap[col.data_type] || 'any';
        const hasDefault = col.column_default !== null || col.is_primary;
        const isNullable = col.is_nullable === 'YES';
        const optional = hasDefault || isNullable ? '?' : '';
        const nullable = isNullable ? ' | null' : '';
        output += `          ${col.column_name}${optional}: ${tsType}${nullable};\n`;
      }

      output += `        };
        Update: {
`;

      // Update type (all optional)
      for (const col of table.columns) {
        const tsType = typeMap[col.data_type] || 'any';
        const nullable = col.is_nullable === 'YES' ? ' | null' : '';
        output += `          ${col.column_name}?: ${tsType}${nullable};\n`;
      }

      output += `        };
      };
`;
    }

    output += `    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
`;

    // Save to file
    const outputPath = path.join(process.cwd(), 'src/types/database.types.ts');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, output);

    console.log(`✅ Types generated successfully at ${outputPath}`);
    console.log(`📊 Generated types for ${tables.length} tables`);

  } catch (error) {
    console.error('Error generating types:', error);
  } finally {
    await client.end();
  }
}

generateTypes();