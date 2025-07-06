import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-safe';

export async function GET() {
  try {
    // Test 1: Simple count
    const { count, error: countError } = await supabase
      .from('practices')
      .select('*', { count: 'exact', head: true });
    
    // Test 2: Get all practices
    const { data, error } = await supabase
      .from('practices')
      .select('*');
    
    // Test 3: Get specific practice
    const { data: cityClinic, error: clinicError } = await supabase
      .from('practices')
      .select('*')
      .eq('slug', 'cityclinic')
      .single();
    
    return NextResponse.json({
      count,
      countError,
      practices: data,
      error,
      cityClinic,
      clinicError,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Exception occurred',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}