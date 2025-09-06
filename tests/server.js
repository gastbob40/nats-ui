#!/usr/bin/env node

import { connect, StringCodec, headers } from 'nats';

async function server() {
  try {
    // Connect to NATS server
    const nc = await connect({
      servers: ['nats://localhost:4222'],
      name: 'Test Server'
    });

    console.log('✅ NATS Server connected');
    console.log('📡 Publishing messages to users.new and users.update every 2 seconds...');

    const sc = StringCodec();
    let counter = 1;

    // Publish messages periodically
    const interval = setInterval(() => {
      // Publish to users.new with headers - complex nested structure
      const newUser = {
        id: counter,
        name: `User ${counter}`,
        email: `user${counter}@example.com`,
        timestamp: new Date().toISOString(),
        action: 'created',
        profile: {
          personal: {
            age: 20 + (counter % 50),
            location: {
              country: 'France',
              city: ['Paris', 'Lyon', 'Marseille'][counter % 3],
              coordinates: {
                lat: 48.8566 + (counter % 10) * 0.01,
                lng: 2.3522 + (counter % 10) * 0.01,
                accuracy: 'high'
              }
            },
            preferences: {
              theme: counter % 2 === 0 ? 'dark' : 'light',
              language: 'fr',
              notifications: {
                email: true,
                push: counter % 3 === 0,
                sms: false,
                settings: {
                  frequency: 'daily',
                  categories: ['updates', 'security', 'marketing']
                }
              }
            }
          },
          professional: {
            company: `Company ${Math.floor(counter / 3) + 1}`,
            role: ['Developer', 'Designer', 'Manager'][counter % 3],
            skills: [
              { name: 'JavaScript', level: 'expert', years: 5 + (counter % 10) },
              { name: 'React', level: 'advanced', years: 3 + (counter % 5) },
              { name: 'Node.js', level: 'intermediate', years: 2 + (counter % 3) }
            ],
            projects: [
              {
                name: `Project Alpha ${counter}`,
                status: 'active',
                team: {
                  lead: `Lead ${counter}`,
                  members: [`Dev${counter}`, `Designer${counter}`, `QA${counter}`],
                  budget: {
                    allocated: 50000 + (counter * 1000),
                    spent: 25000 + (counter * 500),
                    currency: 'EUR'
                  }
                }
              }
            ]
          }
        },
        metadata: {
          version: '1.0.0',
          source: 'test-server',
          tags: ['user', 'creation', `batch-${Math.floor(counter / 10)}`],
          audit: {
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            permissions: {
              read: ['admin', 'user'],
              write: ['admin'],
              delete: ['admin']
            }
          }
        }
      };

      // Create headers for the new user message
      const newUserHeaders = headers();
      newUserHeaders.set('Content-Type', 'application/json');
      newUserHeaders.set('X-User-Action', 'create');
      newUserHeaders.set('X-User-ID', counter.toString());
      newUserHeaders.set('X-Timestamp', new Date().toISOString());

      nc.publish('users.new', sc.encode(JSON.stringify(newUser)), { headers: newUserHeaders });
      console.log(`📤 Published to users.new with headers:`, newUser);

      // Publish to users.update (every other iteration)
      if (counter % 2 === 0) {
        const updateUser = {
          id: Math.floor(counter / 2),
          name: `Updated User ${Math.floor(counter / 2)}`,
          email: `updated${Math.floor(counter / 2)}@example.com`,
          timestamp: new Date().toISOString(),
          action: 'updated',
          changes: {
            modified: {
              fields: ['profile.personal.age', 'profile.professional.role'],
              timestamp: new Date().toISOString(),
              reason: 'user_request'
            },
            history: [
              {
                version: '1.0.0',
                changes: ['created'],
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                author: {
                  id: 'system',
                  name: 'System User',
                  permissions: ['create', 'update']
                }
              },
              {
                version: '1.1.0',
                changes: ['updated_profile', 'added_skills'],
                timestamp: new Date(Date.now() - 43200000).toISOString(),
                author: {
                  id: `user_${counter}`,
                  name: `User ${counter}`,
                  permissions: ['update']
                }
              }
            ],
            validation: {
              status: 'passed',
              rules: {
                email: { valid: true, format: 'RFC5322' },
                age: { valid: true, range: [18, 99] },
                permissions: { valid: true, level: 'standard' }
              },
              score: {
                overall: 95,
                breakdown: {
                  completeness: 100,
                  accuracy: 90,
                  consistency: 95
                }
              }
            }
          },
          analytics: {
            usage: {
              sessions: {
                total: 50 + (counter * 5),
                thisMonth: 12 + (counter % 10),
                averageDuration: '25m 30s',
                lastActive: new Date(Date.now() - (counter * 3600000)).toISOString()
              },
              features: {
                messaging: { used: true, frequency: 'daily', lastUsed: new Date().toISOString() },
                dashboard: { used: counter % 3 === 0, frequency: 'weekly' },
                settings: { used: true, frequency: 'monthly' }
              },
              devices: [
                {
                  type: 'desktop',
                  os: 'macOS',
                  browser: 'Chrome',
                  version: '120.0.0',
                  lastSeen: new Date().toISOString()
                },
                {
                  type: 'mobile',
                  os: 'iOS',
                  browser: 'Safari',
                  version: '17.1',
                  lastSeen: new Date(Date.now() - 7200000).toISOString()
                }
              ]
            },
            performance: {
              responseTime: {
                average: 150 + (counter % 50),
                p95: 300 + (counter % 100),
                p99: 500 + (counter % 200)
              },
              errorRate: (counter % 100) / 1000,
              uptime: 99.9 - (counter % 10) * 0.01
            }
          }
        };

        // Create headers for the update message
        const updateHeaders = headers();
        updateHeaders.set('Content-Type', 'application/json');
        updateHeaders.set('X-User-Action', 'update');
        updateHeaders.set('X-User-ID', Math.floor(counter / 2).toString());
        updateHeaders.set('X-Previous-Version', (counter - 2).toString());
        updateHeaders.set('X-Timestamp', new Date().toISOString());

        nc.publish('users.update', sc.encode(JSON.stringify(updateUser)), { headers: updateHeaders });
        console.log(`📤 Published to users.update with headers:`, updateUser);
      }

      counter++;
    }, 2000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      clearInterval(interval);
      await nc.close();
      console.log('✅ Server shut down gracefully');
      process.exit(0);
    });

    console.log('Press Ctrl+C to stop the server');

  } catch (error) {
    console.error('❌ Error connecting to NATS:', error);
    process.exit(1);
  }
}

// Run the server
server().catch(console.error);