#!/usr/bin/env node

import { connect } from 'nats';

async function createSimpleConsumers() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Simple Consumer Creator'
    });

    console.log('✅ NATS connected');
    console.log('🔧 Creating simple JetStream consumers...');

    // Simple consumers configuration
    const consumers = [
      {
        name: 'basic-consumer',
        config: {
          durable_name: 'basic-consumer',
          ack_policy: 'explicit'
        }
      },
      {
        name: 'pull-consumer',
        config: {
          durable_name: 'pull-consumer',
          ack_policy: 'explicit',
          deliver_policy: 'new'
        }
      }
    ];

    console.log('');
    
    // Create each consumer
    for (const consumer of consumers) {
      try {
        console.log(`📤 Creating consumer "${consumer.name}"...`);

        const response = await nc.request(
          '$JS.API.CONSUMER.CREATE.USERS',
          JSON.stringify(consumer.config),
          { timeout: 5000 }
        );

        const result = JSON.parse(new TextDecoder().decode(response.data));
        
        if (result.error) {
          if (result.error.description?.includes('already exists') || 
              result.error.description?.includes('already in use')) {
            console.log(`ℹ️  Consumer "${consumer.name}" already exists - skipping`);
          } else {
            console.error(`❌ Failed to create consumer "${consumer.name}":`, result.error);
          }
          continue;
        }

        console.log(`✅ Consumer "${consumer.name}" created successfully!`);
        console.log(`   - Stream: ${result.stream_name}`);
        console.log(`   - Name: ${result.name}`);
        console.log(`   - ACK Policy: ${result.config.ack_policy}`);
        console.log('');

      } catch (error) {
        if (error.message.includes('consumer name already in use') || 
            error.message.includes('already exists')) {
          console.log(`ℹ️  Consumer "${consumer.name}" already exists - that's fine!`);
        } else {
          console.error(`❌ Error creating consumer "${consumer.name}":`, error.message);
        }
        console.log('');
      }
    }

    console.log('🎉 Consumer creation completed!');
    console.log('🔍 Check the Consumers page in the UI to see the created consumers');

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

createSimpleConsumers();