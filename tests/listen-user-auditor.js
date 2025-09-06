#!/usr/bin/env node

import { connect } from 'nats';

async function listenUserAuditor() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'User Auditor Listener'
    });

    console.log('✅ NATS connected');
    console.log('🔍 Starting to listen to user-auditor consumer...');
    console.log('📋 This consumer audits user events with explicit acknowledgment');
    console.log('🎯 Deliver Subject: audit.users');
    console.log('🔀 Filter: users.* (all user events)');
    console.log('📨 Deliver Policy: new (only new messages from now)');
    console.log('💡 Publish messages to "users.*" to see them here');
    console.log('---');

    // Get JetStream context
    const js = nc.jetstream();

    try {
      // Get the consumer to verify it exists and get its configuration
      const jsm = await js.jetstreamManager();
      let consumerInfo;
      try {
        consumerInfo = await jsm.consumers.info('USERS', 'user-auditor');
        console.log('✅ Found user-auditor consumer');
        console.log(`   ├─ Deliver Subject: ${consumerInfo.config.deliver_subject}`);
        console.log(`   └─ This is a PUSH consumer (delivers to subject: ${consumerInfo.config.deliver_subject})`);
      } catch (e) {
        console.error('❌ Consumer "user-auditor" not found');
        console.log('💡 First create the consumer with: node tests/create-consumers.js');
        process.exit(1);
      }
      
      // For push consumers with deliver_subject, we subscribe to that subject
      // The JetStream server will push messages to this subject
      const sub = nc.subscribe(consumerInfo.config.deliver_subject, {
        queue: 'auditor-workers' // Optional queue group for load balancing
      });
      
      console.log('🔄 Listening for messages on deliver subject... (Press Ctrl+C to stop)');
      console.log('⚠️  This consumer uses explicit ACK - messages will be acknowledged after processing');
      console.log('');

      let messageCount = 0;
      let ackCount = 0;
      let nakCount = 0;

      for await (const m of sub) {
        messageCount++;
        
        console.log(`🔍 Audit Message #${messageCount} received:`);
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
          console.log(`   ├─ User Action: ${userData.action || 'N/A'}`);
          console.log(`   ├─ User Email: ${userData.email || 'N/A'}`);
          if (userData.profile?.professional?.company) {
            console.log(`   ├─ Company: ${userData.profile.professional.company}`);
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
        
        // Simulate audit processing
        const shouldAccept = Math.random() > 0.1; // 90% acceptance rate
        
        try {
          if (shouldAccept) {
            // Acknowledge the message
            m.ack();
            ackCount++;
            console.log(`   └─ ✅ Message acknowledged (audit passed)`);
          } else {
            // Negative acknowledge (will be redelivered)
            m.nak(1000); // Delay 1 second before redelivery
            nakCount++;
            console.log(`   └─ ❌ Message rejected (audit failed - will be redelivered)`);
          }
        } catch (ackError) {
          console.log(`   └─ ⚠️  ACK Error: ${ackError.message}`);
        }
        
        // Show statistics every 10 messages
        if (messageCount % 10 === 0) {
          console.log('');
          console.log(`📊 Audit Statistics:`);
          console.log(`   ├─ Total Processed: ${messageCount}`);
          console.log(`   ├─ Acknowledged: ${ackCount} (${((ackCount/messageCount)*100).toFixed(1)}%)`);
          console.log(`   └─ Rejected: ${nakCount} (${((nakCount/messageCount)*100).toFixed(1)}%)`);
        }
        
        console.log('');
      }

    } catch (error) {
      if (error.message.includes('consumer not found')) {
        console.error('❌ Consumer "user-auditor" not found');
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
  console.log('\n🛑 Shutting down auditor listener...');
  console.log('📊 Final audit summary would be displayed here');
  process.exit(0);
});

listenUserAuditor();