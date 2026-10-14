import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test 1: Simple count
    const { count, error: countError } = await supabase
      .from('practice_listing')
      .select('*', { count: 'exact', head: true });
    
    // Test 2: Get all practices
    const { data, error } = await supabase
      .from('practice_listing')
      .select('*');
    
    // Test 3: Get specific practice
    const { data: cityClinic, error: clinicError } = await supabase
      .from('practice_listing')
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
      supabaseUrl: 'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      hasKey: true
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Exception occurred',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}