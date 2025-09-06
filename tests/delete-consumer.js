#!/usr/bin/env node

import { connect } from 'nats';

async function deleteConsumer() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Consumer Deleter'
    });

    console.log('✅ NATS connected');
    console.log('🗑️  Deleting user-processor consumer...');

    // Get JetStream context
    const js = nc.jetstream();
    const jsm = await js.jetstreamManager();

    try {
      await jsm.consumers.delete('USERS', 'user-processor');
      console.log('✅ Consumer "user-processor" deleted successfully!');
    } catch (error) {
      if (error.message.includes('consumer not found')) {
        console.log('ℹ️  Consumer "user-processor" does not exist - nothing to delete');
      } else {
        throw error;
      }
    }

    await nc.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteConsumer();