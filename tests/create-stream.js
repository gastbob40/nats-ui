#!/usr/bin/env node

import { connect, StringCodec } from 'nats';

async function createUsersStream() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Stream Creator'
    });

    console.log('✅ NATS connected');
    console.log('🔧 Creating USERS stream to capture users.* messages...');

    // Create a JetStream stream for users
    const streamConfig = {
      name: 'USERS',
      subjects: ['users.*'], // Capture users.new, users.update, etc.
      retention: 'limits',
      storage: 'file',
      max_msgs: 10000,
      max_bytes: 10485760, // 10MB
      max_age: 86400000000000, // 24 hours in nanoseconds
      num_replicas: 1,
      discard: 'old',
      duplicate_window: 120000000000, // 2 minutes
    };

    const response = await nc.request(
      '$JS.API.STREAM.CREATE.USERS',
      JSON.stringify(streamConfig),
      { timeout: 5000 }
    );

    const result = JSON.parse(new TextDecoder().decode(response.data));
    
    if (result.error) {
      console.error('❌ Failed to create stream:', result.error);
      process.exit(1);
    }

    console.log('✅ USERS stream created successfully!');
    console.log('📋 Stream details:');
    console.log('   - Name:', result.config.name);
    console.log('   - Subjects:', result.config.subjects);
    console.log('   - Storage:', result.config.storage);
    console.log('   - Max Messages:', result.config.max_msgs);
    console.log('');
    console.log('🎉 Now your users.* messages will be stored in JetStream!');
    console.log('🔍 Check the Streams page in the UI to see the USERS stream');

    await nc.close();
    process.exit(0);

  } catch (error) {
    if (error.message.includes('stream name already in use')) {
      console.log('ℹ️  USERS stream already exists - that\'s fine!');
      process.exit(0);
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

createUsersStream();