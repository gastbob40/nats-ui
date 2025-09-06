#!/usr/bin/env node

import { connect } from 'nats';

async function listenUserProcessor() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'User Processor Listener'
    });

    console.log('✅ NATS connected');
    console.log('🔧 Starting to listen to user-processor consumer...');
    console.log('📋 This consumer processes all user events with explicit acknowledgment');
    console.log('🎯 Deliver Subject: process.users');
    console.log('🔀 Filter: users.* (all user events)');
    console.log('📨 Deliver Policy: all (from beginning)');
    console.log('💡 Publish messages to "users.*" to see them here');
    console.log('---');

    // Get JetStream context
    const js = nc.jetstream();

    try {
      // Get the consumer using the pull approach (like user-analytics)
      const consumer = await js.consumers.get('USERS', 'user-processor');
      console.log('✅ Found user-processor consumer');
      
      // Start consuming messages using pull approach
      const messages = await consumer.consume();
      
      console.log('🔄 Listening for messages on deliver subject... (Press Ctrl+C to stop)');
      console.log('⚠️  This consumer uses explicit ACK - messages will be acknowledged after processing');
      console.log('');

      let messageCount = 0;
      let ackCount = 0;
      let nakCount = 0;

      for await (const m of messages) {
        messageCount++;
        
        console.log(`🔧 Processing Message #${messageCount} received:`);
        console.log(`   ├─ Subject: ${m.subject}`);
        console.log(`   ├─ Deliver Subject: ${m.info?.delivered_to || 'N/A'}`);
        console.log(`   ├─ Stream Sequence: ${m.info?.streamSequence || 'N/A'}`);
        console.log(`   ├─ Consumer Sequence: ${m.info?.consumerSequence || 'N/A'}`);
        console.log(`   ├─ Delivery Count: ${m.info?.deliveryCount || 'N/A'}`);
        console.log(`   ├─ Timestamp: ${new Date().toISOString()}`);
        
        // Parse and display the data
        let userData;
        try {
          userData = JSON.parse(new TextDecoder().decode(m.data));
          console.log(`   ├─ User ID: ${userData.id || 'N/A'}`);
          console.log(`   ├─ User Action: ${userData.action || userData.username || 'N/A'}`);
          console.log(`   ├─ User Email: ${userData.email || 'N/A'}`);
          if (userData.plan) {
            console.log(`   ├─ Plan: ${userData.plan}`);
          }
        } catch (e) {
          console.log(`   ├─ Raw Data: ${new TextDecoder().decode(m.data).substring(0, 100)}...`);
        }
        
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
        
        // Simulate processing
        const shouldAccept = Math.random() > 0.05; // 95% success rate
        
        try {
          if (shouldAccept) {
            // Acknowledge the message
            m.ack();
            ackCount++;
            console.log(`   └─ ✅ Message processed successfully`);
          } else {
            // Negative acknowledge (will be redelivered)
            m.nak(2000); // Delay 2 seconds before redelivery
            nakCount++;
            console.log(`   └─ ❌ Message processing failed (will be redelivered)`);
          }
        } catch (ackError) {
          console.log(`   └─ ⚠️  ACK Error: ${ackError.message}`);
        }
        
        // Show statistics every 5 messages
        if (messageCount % 5 === 0) {
          console.log('');
          console.log(`📊 Processing Statistics:`);
          console.log(`   ├─ Total Processed: ${messageCount}`);
          console.log(`   ├─ Successfully Processed: ${ackCount} (${((ackCount/messageCount)*100).toFixed(1)}%)`);
          console.log(`   └─ Failed: ${nakCount} (${((nakCount/messageCount)*100).toFixed(1)}%)`);
        }
        
        console.log('');
      }

    } catch (error) {
      if (error.message.includes('consumer not found')) {
        console.error('❌ Consumer "user-processor" not found');
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
  console.log('\n🛑 Shutting down processor listener...');
  console.log('📊 Final processing summary would be displayed here');
  process.exit(0);
});

listenUserProcessor();