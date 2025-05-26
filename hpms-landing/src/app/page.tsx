import { headers } from 'next/headers';
import { getPracticeByDomain } from '@/lib/tenants';
import PageWrapper from '@/components/PageWrapper';

export default async function Home() {
  const headersList = await headers();
  const domain = headersList.get('x-practice-domain') || '';
  
  const practice = await getPracticeByDomain(domain);
  
  if (!practice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-2xl mx-auto p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-red-800 mb-4">Database Setup Required</h1>
            <p className="text-red-600 mb-4">
              The practices table hasn't been created yet. Please run the migration to set up multi-tenant support.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6 text-left">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Setup Instructions:</h2>
            
            <ol className="space-y-4 text-gray-700">
              <li>
                <span className="font-semibold">1. Go to Supabase SQL Editor:</span>
                <br />
                <a 
                  href="https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/sql/new" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/sql/new
                </a>
              </li>
              
              <li>
                <span className="font-semibold">2. Copy and run the migration from:</span>
                <br />
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  /supabase/migrations/20250526_multi_tenant_practices.sql
                </code>
              </li>
              
              <li>
                <span className="font-semibold">3. Refresh this page</span>
              </li>
            </ol>
            
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Current domain:</strong> {domain}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Expected practice:</strong> {domain.includes('3000') ? 'City Clinic' : domain.includes('healthpractice') ? 'Dr. Polina Aesthetics' : 'Practice'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <PageWrapper practice={practice} />;
}