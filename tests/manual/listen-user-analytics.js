#!/usr/bin/env node

import { connect } from '@nats-io/transport-node';
import { jetstream } from '@nats-io/jetstream';

async function listenUserAnalytics() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'User Analytics Listener'
    });

    console.log('✅ NATS connected');
    console.log('🎧 Starting to listen to user-analytics consumer...');
    console.log('📊 This consumer processes user registration events (users.new)');
    console.log('💡 Publish messages to "users.new" to see them here');
    console.log('---');

    // Get JetStream context
    const js = jetstream(nc);

    try {
      // Get the consumer
      const consumer = await js.consumers.get('USERS', 'user-analytics');
      console.log('✅ Found user-analytics consumer');
      
      // Start consuming messages
      const messages = await consumer.consume();
      
      console.log('🔄 Listening for messages... (Press Ctrl+C to stop)');
      console.log('');

      let messageCount = 0;
      for await (const m of messages) {
        messageCount++;
        
        console.log(`📨 Message #${messageCount} received:`);
        console.log(`   ├─ Subject: ${m.subject}`);
        console.log(`   ├─ Data: ${m.string()}`);
        console.log(`   ├─ Timestamp: ${new Date().toISOString()}`);
        
        // Check for headers
        if (m.headers) {
          console.log(`   ├─ Headers:`);
          try {
            for (const [key, values] of m.headers) {
              console.log(`   │  └─ ${key}: ${Array.isArray(values) ? values.join(', ') : values}`);
            }
          } catch (e) {
            console.log(`   │  └─ Headers present but not iterable`);
          }
        }
        
        // Since this consumer has ack_policy: 'none', we don't need to ack
        console.log(`   └─ Auto-acknowledged (fire-and-forget)`);
        console.log('');
      }

    } catch (error) {
      if (error.message.includes('consumer not found')) {
        console.error('❌ Consumer "user-analytics" not found');
        console.log('💡 First create the consumer with: node tests/create-consumers.js');
        process.exit(1);
      } else {
        throw error;
      }
    }

  } catch (error) {
    if (error.message.includes('stream not found')) {
      console.error('❌ USERS stream not found');
      console.log('💡 First create the stream with: node tests/create-stream.js');
      process.exit(1);
    } else if (error.message.includes('JetStream not enabled')) {
      console.error('❌ JetStream is not enabled on your NATS server');
      console.log('💡 Start your NATS server with JetStream enabled');
      process.exit(1);
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down listener...');
  process.exit(0);
});

listenUserAnalytics();