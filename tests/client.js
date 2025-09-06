#!/usr/bin/env node

import { connect, StringCodec } from 'nats';

async function client() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Test Client'
    });

    console.log('✅ NATS Client connected');
    console.log('👂 Listening to users.new and users.update...\n');

    const sc = StringCodec();
    
    // Message counters
    let newCount = 0;
    let updateCount = 0;

    // Subscribe to users.new
    const newSub = nc.subscribe('users.new');
    (async () => {
      for await (const msg of newSub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          newCount++;
          console.log(`🆕 [users.new #${newCount}] Received:`, data);
        } catch (error) {
          console.error('❌ Error parsing users.new message:', error);
        }
      }
    })();

    // Subscribe to users.update
    const updateSub = nc.subscribe('users.update');
    (async () => {
      for await (const msg of updateSub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          updateCount++;
          console.log(`🔄 [users.update #${updateCount}] Received:`, data);
        } catch (error) {
          console.error('❌ Error parsing users.update message:', error);
        }
      }
    })();

    // Show statistics every 10 seconds
    const statsInterval = setInterval(() => {
      console.log(`📊 Stats: ${newCount} new users, ${updateCount} user updates`);
    }, 10000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down client...');
      clearInterval(statsInterval);
      newSub.unsubscribe();
      updateSub.unsubscribe();
      await nc.close();
      console.log('✅ Client shut down gracefully');
      process.exit(0);
    });

    console.log('Press Ctrl+C to stop the client');

  } catch (error) {
    console.error('❌ Error connecting to NATS:', error);
    process.exit(1);
  }
}

// Run the client
client().catch(console.error);