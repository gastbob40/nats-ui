#!/usr/bin/env node

import { connect } from 'nats';

async function createConsumers() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Consumer Creator'
    });

    console.log('✅ NATS connected');
    console.log('🔧 Creating JetStream consumers...');

    // Get JetStream context
    const js = nc.jetstream();

    // List of consumers to create
    const consumers = [
      {
        stream: 'USERS',
        name: 'user-processor',
        config: {
          durable_name: 'user-processor',
          deliver_policy: 'all',
          ack_policy: 'explicit',
          ack_wait: 30000000000, // 30 seconds in nanoseconds
          max_deliver: 3,
          replay_policy: 'instant',
          filter_subject: 'users.*'
        }
      },
      {
        stream: 'USERS', 
        name: 'user-auditor',
        config: {
          durable_name: 'user-auditor',
          deliver_policy: 'new',
          ack_policy: 'explicit',
          ack_wait: 60000000000, // 60 seconds in nanoseconds
          max_deliver: 5,
          replay_policy: 'instant',
          filter_subject: 'users.*'
        }
      },
      {
        stream: 'USERS',
        name: 'user-analytics', 
        config: {
          durable_name: 'user-analytics',
          deliver_policy: 'last',
          ack_policy: 'none',
          replay_policy: 'instant',
          filter_subject: 'users.new'
        }
      }
    ];

    console.log('');
    
    // Create each consumer
    for (const consumer of consumers) {
      try {
        console.log(`📤 Creating consumer "${consumer.name}" for stream "${consumer.stream}"...`);

        // Use JetStream manager API
        const jsm = await js.jetstreamManager();
        const ci = await jsm.consumers.add(consumer.stream, consumer.config);
        
        console.log(`✅ Consumer "${consumer.name}" created successfully!`);
        console.log(`   - Stream: ${ci.stream_name}`);
        console.log(`   - Deliver Policy: ${ci.config.deliver_policy}`);
        console.log(`   - ACK Policy: ${ci.config.ack_policy}`);
        if (ci.config.deliver_subject) {
          console.log(`   - Deliver Subject: ${ci.config.deliver_subject}`);
        }
        console.log(`   - Filter: ${ci.config.filter_subject || 'none'}`);
        console.log('');

      } catch (error) {
        if (error.message.includes('consumer name already in use') || error.message.includes('already exists')) {
          console.log(`ℹ️  Consumer "${consumer.name}" already exists - that's fine!`);
        } else {
          console.error(`❌ Error creating consumer "${consumer.name}":`, error.message);
        }
        console.log('');
      }
    }

    console.log('🎉 Consumer creation completed!');
    console.log('🔍 Check the Consumers page in the UI to see the created consumers');
    console.log('');
    console.log('💡 Consumer details:');
    console.log('   - user-processor: Processes all user events with delivery subject');
    console.log('   - user-auditor: Audits new user events starting from now');
    console.log('   - user-analytics: Analytics consumer for user registration (fire-and-forget)');

    await nc.close();
    process.exit(0);

  } catch (error) {
    if (error.message.includes('stream not found')) {
      console.error('❌ USERS stream not found');
      console.log('💡 First create the stream with: node create-stream.js');
      process.exit(1);
    } else if (error.message.includes('JetStream not enabled')) {
      console.error('❌ JetStream is not enabled on your NATS server');
      console.log('💡 Start your NATS server with: nats-server -js');
      process.exit(1);
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

createConsumers();