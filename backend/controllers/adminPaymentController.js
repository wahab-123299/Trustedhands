import Payment from "../models/payment.js";

/**
 * @desc    Get all payment (Admin only)
 * @route   GET /api/admin/payment
 * @access  Private/Admin
 */
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

/**
 * @desc    Get single payment by ID (Admin only)
 * @route   GET /api/admin/payment/:id
 * @access  Private/Admin
 */
export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("user", "name email");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payment",
      error: error.message,
    });
  }
};
