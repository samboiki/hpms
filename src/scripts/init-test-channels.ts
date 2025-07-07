#!/usr/bin/env tsx
// Script to create test channels for development

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initTestChannels() {
  try {
    // Get the first practice
    const { data: practices, error: practiceError } = await supabase
      .from('practices')
      .select('id, name')
      .limit(1);

    if (practiceError || !practices?.length) {
      console.error('No practices found');
      return;
    }

    const practiceId = practices[0].id;
    console.log(`Using practice: ${practices[0].name} (${practiceId})`);

    // Get users from this practice
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('practice_id', practiceId)
      .limit(5);

    if (usersError || !users?.length) {
      console.error('No users found in practice');
      return;
    }

    console.log(`Found ${users.length} users`);

    // Create a general announcement channel
    const { data: announcementChannel, error: announcementError } = await supabase
      .from('internal_message_channels')
      .insert({
        practice_id: practiceId,
        channel_type: 'announcement',
        name: 'Practice Announcements',
        description: 'Important announcements for all staff',
        created_by: users[0].id,
        allow_replies: true
      })
      .select()
      .single();

    if (announcementError) {
      console.error('Error creating announcement channel:', announcementError);
    } else {
      console.log('✅ Created announcement channel:', announcementChannel.name);

      // Add all users as members
      const memberInserts = users.map(user => ({
        channel_id: announcementChannel.id,
        user_id: user.id,
        practice_id: practiceId,
        role: user.id === users[0].id ? 'admin' : 'member',
        notification_enabled: true
      }));

      await supabase
        .from('internal_channel_members')
        .insert(memberInserts);

      // Create initial thread
      const { data: thread } = await supabase
        .from('internal_message_threads')
        .insert({
          channel_id: announcementChannel.id,
          practice_id: practiceId,
          created_by: users[0].id
        })
        .select()
        .single();

      if (thread) {
        // Add welcome message
        await supabase
          .from('internal_messages')
          .insert({
            thread_id: thread.id,
            sender_id: users[0].id,
            content: 'Welcome to the new internal messaging system! 🎉 Use this channel for important practice-wide announcements.',
            content_type: 'text'
          });
      }
    }

    // Create a department channel
    const { data: deptChannel, error: deptError } = await supabase
      .from('internal_message_channels')
      .insert({
        practice_id: practiceId,
        channel_type: 'department',
        name: 'Front Desk Team',
        description: 'Communication for reception and admin staff',
        created_by: users[0].id
      })
      .select()
      .single();

    if (!deptError && deptChannel) {
      console.log('✅ Created department channel:', deptChannel.name);

      // Add first 3 users as members
      const deptMembers = users.slice(0, 3).map(user => ({
        channel_id: deptChannel.id,
        user_id: user.id,
        practice_id: practiceId,
        role: 'member',
        notification_enabled: true
      }));

      await supabase
        .from('internal_channel_members')
        .insert(deptMembers);
    }

    // Create test notification
    const { error: notifError } = await supabase
      .from('system_notifications')
      .insert({
        practice_id: practiceId,
        user_id: users[0].id,
        notification_type: 'system',
        priority: 'normal',
        title: 'Welcome to Internal Messaging',
        message: 'The new internal messaging system is now active. Click here to start a conversation with your team.',
        action_url: '/communications',
        status: 'pending'
      });

    if (!notifError) {
      console.log('✅ Created welcome notification');
    }

    console.log('\n✨ Test data initialization complete!');
    console.log('You can now log in and see the channels in the Messages tab.');

  } catch (error) {
    console.error('Error initializing test channels:', error);
  }
}

initTestChannels();