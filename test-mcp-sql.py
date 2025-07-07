#!/usr/bin/env python3

import subprocess
import sys
import json

def test_mcp_sql_execution():
    """Test if we can execute SQL through MCP using Python"""
    
    print("🔍 Testing MCP SQL execution capabilities...")
    
    # Check if we can install and use supabase-py
    try:
        import supabase
        print("✅ Supabase Python library available")
    except ImportError:
        print("❌ Supabase Python library not available")
        print("💡 Would need: pip install supabase")
        return False
    
    # Test connection
    try:
        from supabase import create_client
        client = create_client(
            "https://jjxlfunlbyayxwvlpgwt.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA"
        )
        
        # Test simple query
        result = client.table('batch_headers').select('id').limit(1).execute()
        print("✅ MCP can connect to Supabase!")
        print(f"   Sample data available: {len(result.data)} records")
        
        return True
        
    except Exception as e:
        print(f"❌ MCP connection failed: {e}")
        return False

if __name__ == "__main__":
    test_mcp_sql_execution()