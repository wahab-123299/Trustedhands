const cron = require('node-cron');
const Job = require('../models/Job');

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Checking for auto-release milestones...');
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const jobs = await Job.find({
    status: 'completed',
    'escrowMilestones.status': 'pending',
    completedAt: { $lte: sevenDaysAgo }
  });
  
  for (const job of jobs) {
    for (const milestone of job.escrowMilestones) {
      if (milestone.status === 'pending' && job.completedAt <= sevenDaysAgo) {
        milestone.status = 'auto_released';
        milestone.approvedAt = new Date();
        console.log(`[Cron] Auto-released milestone for job ${job._id}`);
      }
    }
    
    const allReleased = job.escrowMilestones.every(m => 
      ['released', 'approved', 'auto_released'].includes(m.status)
    );
    
    if (allReleased) {
      job.paymentStatus = 'released';
    }
    
    await job.save();
  }
});