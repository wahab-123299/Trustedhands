const Application = require('../models/Application');

// @desc    Get my applications (for artisan)
// @route   GET /api/applications/my-applications
// @access  Private
exports.getMyApplications = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const query = { artisanId: req.user._id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const applications = await Application.find(query)
      .populate('jobId', 'title budget status location')
      .sort('-createdAt');

    const formattedApplications = applications.map(app => ({
      _id: app._id,
      job: {
        _id: app.jobId?._id,
        title: app.jobId?.title || 'Job no longer available',
        budget: app.jobId?.budget,
        status: app.jobId?.status,
        location: app.jobId?.location || { city: 'N/A', state: 'N/A' }
      },
      status: app.status,
      message: app.coverLetter,
      proposedRate: app.proposedRate,
      createdAt: app.createdAt
    }));

    res.status(200).json({
      success: true,
      data: { applications: formattedApplications }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single application
// @route   GET /api/applications/:id
// @access  Private
exports.getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('jobId')
      .populate('artisanId', 'fullName email');

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Application not found' } 
      });
    }

    if (application.artisanId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'Not authorized' } 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: { application } 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Withdraw application
// @route   PUT /api/applications/:id/withdraw
// @access  Private
exports.withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      artisanId: req.user._id,
      status: 'pending'
    });

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Cannot withdraw' } 
      });
    }

    application.status = 'rejected';
    await application.save();

    res.status(200).json({ 
      success: true, 
      data: { application } 
    });
  } catch (error) {
    next(error);
  }
};