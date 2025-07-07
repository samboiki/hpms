#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: '.env.local' });

interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  projectRef: string;
  outputPath: string;
  watch: boolean;
  interval: number;
}

class SupabaseTypeSync {
  private config: Config;
  private lastSchemaHash: string = '';
  private spinner = ora();
  private supabase: any;

  constructor(config: Config) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async generateTypes(): Promise<void> {
    this.spinner.start('Generating TypeScript types from Supabase...');
    
    try {
      const { stdout, stderr } = await execAsync(
        `npx supabase gen types typescript --project-id ${this.config.projectRef} --schema public`
      );
      
      if (stderr) {
        this.spinner.fail(`Error generating types: ${stderr}`);
        return;
      }

      // Save the generated types
      await fs.writeFile(this.config.outputPath, stdout);
      
      // Add custom helper types
      const customTypes = `
// Custom helper types for better DX
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Utility type for relationships
export type WithRelations<T, R extends Record<string, any>> = T & R;
`;

      const existingContent = await fs.readFile(this.config.outputPath, 'utf-8');
      await fs.writeFile(this.config.outputPath, existingContent + customTypes);

      this.spinner.succeed(chalk.green('✓ Types generated successfully!'));
    } catch (error) {
      this.spinner.fail(chalk.red(`Failed to generate types: ${error}`));
    }
  }

  async checkSchemaChanges(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('get_schema_hash');
      
      if (error) {
        console.error(chalk.red('Error checking schema:', error));
        return false;
      }

      const currentHash = data;
      
      if (this.lastSchemaHash && this.lastSchemaHash !== currentHash) {
        console.log(chalk.yellow('⚡ Schema changes detected!'));
        this.lastSchemaHash = currentHash;
        return true;
      }

      this.lastSchemaHash = currentHash;
      return false;
    } catch (error) {
      console.error(chalk.red('Error checking schema:', error));
      return false;
    }
  }

  async watchSchema(): Promise<void> {
    console.log(chalk.blue('👀 Watching for schema changes...'));
    
    // Initial type generation
    await this.generateTypes();

    // Check for changes periodically
    setInterval(async () => {
      const hasChanges = await this.checkSchemaChanges();
      if (hasChanges) {
        await this.generateTypes();
      }
    }, this.config.interval);

    // Also watch for manual trigger file
    const triggerPath = path.join(process.cwd(), '.type-sync-trigger');
    
    chokidar.watch(triggerPath, { persistent: true }).on('change', async () => {
      console.log(chalk.yellow('⚡ Manual sync triggered!'));
      await this.generateTypes();
    });

    console.log(chalk.gray(`Touch ${triggerPath} to manually trigger type generation`));
  }

  async getSchemaInfo(): Promise<void> {
    this.spinner.start('Fetching database schema...');
    
    try {
      const { data, error } = await this.supabase.rpc('get_database_schema');
      
      if (error) {
        this.spinner.fail(`Error fetching schema: ${error.message}`);
        return;
      }

      this.spinner.succeed('Schema fetched successfully!');

      // Display summary
      console.log(chalk.blue('\n📊 Database Schema Summary:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const schema = data;
      console.log(`Tables: ${chalk.green(schema.tables?.length || 0)}`);
      console.log(`Functions: ${chalk.green(schema.functions?.length || 0)}`);
      console.log(`Enums: ${chalk.green(schema.enums?.length || 0)}`);
      
      if (schema.tables) {
        console.log(chalk.blue('\n📋 Tables:'));
        schema.tables.forEach((table: any) => {
          console.log(`  ${chalk.yellow(table.table_name)} (${table.columns?.length || 0} columns)`);
        });
      }
    } catch (error) {
      this.spinner.fail(chalk.red(`Failed to fetch schema: ${error}`));
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const config: Config = {
    supabaseUrl: process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    projectRef: process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || '',
    outputPath: path.join(process.cwd(), 'src/types/database.types.ts'),
    watch: args.includes('--watch') || args.includes('-w'),
    interval: 5000 // Check every 5 seconds
  };

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.error(chalk.red('❌ Missing Supabase credentials in .env.local'));
    process.exit(1);
  }

  const sync = new SupabaseTypeSync(config);

  switch (command) {
    case 'generate':
      await sync.generateTypes();
      break;
    case 'watch':
      await sync.watchSchema();
      break;
    case 'info':
      await sync.getSchemaInfo();
      break;
    default:
      console.log(chalk.blue('Supabase Type Sync Tool'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log('Commands:');
      console.log('  generate    Generate TypeScript types once');
      console.log('  watch       Watch for schema changes and auto-generate');
      console.log('  info        Display database schema information');
      console.log('\nOptions:');
      console.log('  --watch, -w    Watch mode for continuous sync');
  }
}

main().catch(console.error);