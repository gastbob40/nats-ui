#!/usr/bin/env node

import { connect } from '@nats-io/transport-node';

async function publishUserEvents() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'User Event Publisher'
    });

    console.log('✅ NATS connected');
    console.log('📤 Publishing user events...');
    console.log('');

    // Sample user events
    const userEvents = [
      {
        subject: 'users.new',
        data: {
          id: 'user-001',
          username: 'alice',
          email: 'alice@example.com',
          created_at: new Date().toISOString(),
          plan: 'premium'
        }
      },
      {
        subject: 'users.new', 
        data: {
          id: 'user-002',
          username: 'bob',
          email: 'bob@example.com',
          created_at: new Date().toISOString(),
          plan: 'free'
        }
      },
      {
        subject: 'users.update',
        data: {
          id: 'user-001',
          username: 'alice',
          email: 'alice@example.com',
          updated_at: new Date().toISOString(),
          plan: 'enterprise'
        }
      },
      {
        subject: 'users.new',
        data: {
          id: 'user-003',
          username: 'charlie',
          email: 'charlie@example.com',
          created_at: new Date().toISOString(),
          plan: 'free'
        }
      }
    ];

    // Publish events with delay
    for (let i = 0; i < userEvents.length; i++) {
      const event = userEvents[i];
      
      console.log(`📨 Publishing event ${i + 1}/${userEvents.length}:`);
      console.log(`   ├─ Subject: ${event.subject}`);
      console.log(`   └─ User: ${event.data.username} (${event.data.email})`);
      
      // Publish the message
      nc.publish(event.subject, JSON.stringify(event.data, null, 2));
      
      // Wait 2 seconds between messages
      if (i < userEvents.length - 1) {
        console.log('⏳ Waiting 2 seconds...');
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('');
    console.log('🎉 All user events published!');
    console.log('💡 Check your listener to see the messages processed by user-analytics consumer');
    console.log('📊 Note: Only users.new events will be processed by user-analytics (filter: users.new)');

    await nc.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

publishUserEvents();