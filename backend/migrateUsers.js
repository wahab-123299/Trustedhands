const mongoose = require('mongoose');
require('dotenv').config();

const SOURCE_DB = 'test';

async function migrate() {
  try {
    let sourceUri = process.env.MONGODB_URI;

    if (sourceUri.includes('/trustedhands')) {
      sourceUri = sourceUri.replace('/trustedhands', '/' + SOURCE_DB);
    } else if (!sourceUri.includes('/test')) {
      sourceUri = sourceUri.replace('.mongodb.net/?', '.mongodb.net/test?');
    }

    console.log('Connecting to SOURCE database:', SOURCE_DB);
    console.log('Source URI:', sourceUri.replace(/:([^@]+)@/, ':****@'));

    const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
    const SourceUser = sourceConn.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    const users = await SourceUser.find({});
    console.log('Found', users.length, 'users in', SOURCE_DB);

    if (users.length === 0) {
      console.log('No users found to migrate. Check SOURCE_DB name.');
      await sourceConn.close();
      process.exit(0);
    }

    console.log('Connecting to TARGET database: trustedhands');
    const targetConn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
    const TargetUser = targetConn.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const userData of users) {
      const plainData = userData.toObject();
      const email = plainData.email;

      try {
        const exists = await TargetUser.findOne({ email: email ? email.toLowerCase() : '' });
        if (exists) {
          console.log('Skipping', email, '- already exists');
          skipped++;
          continue;
        }

        delete plainData._id;
        delete plainData.__v;
        delete plainData.createdAt;
        delete plainData.updatedAt;

        await TargetUser.create(plainData);
        console.log('Migrated:', email, '(' + (plainData.role || 'unknown') + ')');
        migrated++;

      } catch (err) {
        console.error('Error migrating', email, ':', err.message);
        errors++;
      }
    }

    console.log('Migration Complete:');
    console.log('  Migrated:', migrated);
    console.log('  Skipped:', skipped);
    console.log('  Errors:', errors);
    console.log('  Total source:', users.length);

    await sourceConn.close();
    await targetConn.close();
    process.exit(0);

  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not found. Check your .env file.');
  process.exit(1);
}

console.log('Starting user migration...');
migrate();