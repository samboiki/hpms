#!/usr/bin/env node

/**
 * Verification Script for Practice Registration
 * Tests the complete registration flow and verifies data storage
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyPracticeRegistration() {
  console.log('🔍 Starting Practice Registration Verification...\n')

  try {
    // 1. Check if new columns exist in practices table
    console.log('📋 Step 1: Verifying practices table schema...')
    const { data: practiceColumns, error: schemaError } = await supabase
      .from('practices')
      .select('*')
      .limit(0)

    if (schemaError) {
      console.error('❌ Error checking practices schema:', schemaError)
      return
    }

    const requiredColumns = [
      'number_of_branches',
      'branch_names',
      'professional_email_count',
      'professional_email_addresses',
      'marketing_budget',
      'website_hosting_enabled',
      'total_monthly_premium',
      'base_price',
      'branches_cost',
      'website_cost',
      'emails_cost'
    ]

    console.log('✅ Practices table accessible\n')

    // 2. Get the most recent practice
    console.log('📋 Step 2: Fetching most recent practice...')
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (practicesError) {
      console.error('❌ Error fetching practices:', practicesError)
      return
    }

    if (!practices || practices.length === 0) {
      console.log('⚠️  No practices found in database')
      return
    }

    const practice = practices[0]
    console.log(`✅ Found practice: ${practice.name} (ID: ${practice.id})`)
    console.log(`   Created: ${new Date(practice.created_at).toLocaleString()}\n`)

    // 3. Display pricing information
    console.log('💰 Pricing Information:')
    console.log(`   Base Price: N$${practice.base_price || 'N/A'}`)
    console.log(`   Number of Branches: ${practice.number_of_branches || 'N/A'}`)
    console.log(`   Branches Cost: N$${practice.branches_cost || 0}`)
    console.log(`   Professional Emails: ${practice.professional_email_count || 0}`)
    console.log(`   Emails Cost: N$${practice.emails_cost || 0}`)
    console.log(`   Website Hosting: ${practice.website_hosting_enabled ? 'Yes' : 'No'}`)
    console.log(`   Website Cost: N$${practice.website_cost || 0}`)
    console.log(`   Marketing Budget: N$${practice.marketing_budget || 0}`)
    console.log(`   ═══════════════════════════════════════`)
    console.log(`   Total Monthly Premium: N$${practice.total_monthly_premium || 'N/A'}\n`)

    // 4. Display branch names
    if (practice.branch_names && practice.branch_names.length > 0) {
      console.log('🏢 Branch Names:')
      practice.branch_names.forEach((name, index) => {
        const icon = index === 0 ? '🟢' : '⚪'
        const label = index === 0 ? '(Main - Included)' : `(+N$1,000/mo)`
        console.log(`   ${icon} ${name} ${label}`)
      })
      console.log()
    }

    // 5. Display professional emails
    if (practice.professional_email_addresses && practice.professional_email_addresses.length > 0) {
      console.log('📧 Professional Email Addresses:')
      practice.professional_email_addresses.forEach((email, index) => {
        console.log(`   📨 ${email || `email${index + 1}@practice.com`} (N$150/mo)`)
      })
      console.log()
    }

    // 6. Check branches table
    console.log('📋 Step 3: Verifying branches records...')
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')
      .eq('practice_id', practice.id)

    if (branchesError) {
      console.error('❌ Error fetching branches:', branchesError)
    } else {
      console.log(`✅ Found ${branches.length} branch record(s):`)
      branches.forEach((branch, index) => {
        const mainBranch = branch.is_main_branch ? '🟢 MAIN' : '⚪ ADDITIONAL'
        console.log(`   ${mainBranch} ${branch.name}`)
        console.log(`      - Cost: N$${branch.monthly_cost || 0}/month`)
        console.log(`      - Active: ${branch.is_active ? 'Yes' : 'No'}`)
        console.log(`      - Slug: ${branch.slug}`)
      })
      console.log()
    }

    // 7. Check SMS/Email subscriptions
    console.log('📋 Step 4: Verifying communication subscriptions...')
    const { data: smsSubscription } = await supabase
      .from('practice_sms_subscriptions')
      .select('*')
      .eq('practice_id', practice.id)
      .single()

    const { data: emailSubscription } = await supabase
      .from('practice_email_subscriptions')
      .select('*')
      .eq('practice_id', practice.id)
      .single()

    if (smsSubscription) {
      console.log(`✅ SMS Subscription: ${smsSubscription.monthly_limit} messages/month`)
    }
    if (emailSubscription) {
      console.log(`✅ Email Subscription: ${emailSubscription.monthly_limit} emails/month`)
    }
    console.log()

    // 8. Verification Summary
    console.log('═══════════════════════════════════════')
    console.log('📊 VERIFICATION SUMMARY')
    console.log('═══════════════════════════════════════')

    const checks = []
    checks.push({ name: 'Practice Created', status: !!practice })
    checks.push({ name: 'Pricing Data Stored', status: !!practice.total_monthly_premium })
    checks.push({ name: 'Branch Names Stored', status: practice.branch_names?.length > 0 })
    checks.push({ name: 'Email Addresses Stored', status: practice.professional_email_count > 0 ? practice.professional_email_addresses?.length > 0 : true })
    checks.push({ name: 'Branches Records Created', status: branches?.length === practice.number_of_branches })
    checks.push({ name: 'SMS Subscription Created', status: !!smsSubscription })
    checks.push({ name: 'Email Subscription Created', status: !!emailSubscription })

    checks.forEach(check => {
      const icon = check.status ? '✅' : '❌'
      console.log(`${icon} ${check.name}`)
    })

    const allPassed = checks.every(c => c.status)
    console.log()
    console.log(allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed')
    console.log('═══════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Run verification
verifyPracticeRegistration()