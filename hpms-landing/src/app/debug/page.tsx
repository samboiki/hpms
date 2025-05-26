'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('Starting debug fetch...');
        
        // Test 1: Basic query
        const { data: practices, error } = await supabase
          .from('practices')
          .select('*');
        
        console.log('Query result:', { practices, error });
        
        setData({
          practices,
          error,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          keyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)
        });
      } catch (err) {
        console.error('Exception:', err);
        setData({ exception: err });
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Quick Actions:</h2>
        <a 
          href="https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/editor/29125"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline block"
        >
          View practices table in Supabase →
        </a>
        <a 
          href="https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/auth/policies"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline block"
        >
          Check RLS policies →
        </a>
      </div>
    </div>
  );
}