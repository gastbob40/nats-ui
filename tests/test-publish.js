#!/usr/bin/env node

import { connect } from '@nats-io/transport-node';

async function testPublish() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Test Publisher'
    });

    console.log('✅ Connected to NATS');
    
    // Test message
    const testMessage = {
      id: Date.now(),
      name: 'Test User from Script',
      email: 'test@example.com',
      timestamp: new Date().toISOString()
    };
    
    // Publish to users.new
    console.log('📤 Publishing to users.new:', testMessage);
    nc.publish('users.new', JSON.stringify(testMessage));
    
    console.log('✅ Message published successfully');
    
    // Wait a bit to ensure message is sent
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await nc.close();
    console.log('👋 Connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPublish();