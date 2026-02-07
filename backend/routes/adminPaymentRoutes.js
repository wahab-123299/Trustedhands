import Payment from "../models/payment.js";

/**
 * @desc    Get all payments (Admin only)
 * @route   GET /api/admin/payments
 */
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};

/**
 * @desc    Update payment status (Admin only)
 * @route   PUT /api/admin/payments/:id
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = status || payment.status;
    await payment.save();

    res.status(200).json({
      message: "Payment status updated",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update payment status",
      error: error.message,
    });
  }
};
