// migration.js - Run once to convert old format to GeoJSON
const mongoose = require('mongoose');

const migrateCoordinates = async () => {
  const users = await User.find({
    'location.coordinates.lat': { $exists: true },
    'location.coordinates.type': { $exists: false }
  });
  
  for (const user of users) {
    if (user.location.coordinates.lat && user.location.coordinates.lng) {
      user.location.coordinates = {
        type: 'Point',
        coordinates: [
          user.location.coordinates.lng,
          user.location.coordinates.lat
        ]
      };
      await user.save();
    }
  }
  
  console.log(`Migrated ${users.length} users`);
};