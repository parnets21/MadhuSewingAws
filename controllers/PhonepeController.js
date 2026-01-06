const transactionModel = require("../models/PhonepeModel");

// PhonePe Configuration
const MERCHANT_CONFIG = {
  clientId: process.env.PHONEPE_MERCHANT_ID || "M23T8T3E76KMB",
  clientSecret: process.env.PHONEPE_CLIENT_SECRET || "f0c866c6-0264-4729-ba6e-deb661a8ea0b",
  environment: process.env.PHONEPE_ENVIRONMENT || "PRODUCTION"
};

class Transaction {

  /**
   * POST /phonepe/initiate
   * Web payment - returns payment URL
   */
  async initiate(req, res) {
    let transaction;

    try {
      const { userId, username, mobile, orderId, amount } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields: userId and amount are required" 
        });
      }
      
      if (amount <= 0) {
        return res.status(400).json({ 
          success: false,
          error: "Amount must be greater than 0" 
        });
      }

      transaction = await transactionModel.create({
        userId,
        username: username || 'User',
        Mobile: mobile || '',
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED',
        paymentMethod: 'WEB'
      });

      const transactionId = transaction._id.toString();
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      
      // Return web payment URL - same for web and mobile
      const paymentUrl = `${webBaseUrl}/payment?transactionId=${transactionId}&amount=${amount}&orderId=${orderId || transaction.orderId}&userId=${userId}&username=${encodeURIComponent(username || 'User')}&mobile=${mobile || ''}`;

      console.log('[PhonePe] Payment URL generated:', paymentUrl);

      return res.status(200).json({
        success: true,
        transactionId,
        paymentUrl,
        amount,
        orderId: orderId || transaction.orderId
      });

    } catch (error) {
      console.error('[PhonePe] initiate error:', error.message);

      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.message
        }).catch(err => console.error('Failed to update transaction:', err));
      }

      return res.status(500).json({
        success: false,
        error: "Payment initialization failed",
        details: error.message
      });
    }
  }

  /**
   * GET /phonepe/verify
   * Verify payment status
   */
  async verify(req, res) {
    try {
      const { transactionId } = req.query;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "Transaction ID is required"
        });
      }

      let transaction = await transactionModel.findById(transactionId);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found"
        });
      }

      return res.status(200).json({
        success: true,
        status: transaction.status || 'PENDING',
        transactionId: transactionId,
        amount: transaction.amount,
        message: transaction.status === 'COMPLETED' ? 'Payment successful' : 
                 transaction.status === 'PENDING' ? 'Payment is being processed' :
                 transaction.status === 'FAILED' ? 'Payment failed' :
                 'Payment status unknown'
      });

    } catch (error) {
      console.error('[PhonePe] verify error:', error.message);
      return res.status(500).json({
        success: false,
        error: "Payment verification failed",
        details: error.message
      });
    }
  }

  /**
   * POST /phonepe/initiate-sdk
   * Mobile payment - SAME as web, just returns payment URL
   * Mobile app opens this URL in browser
   */
  async initiateSDK(req, res) {
    let transaction;

    try {
      const { userId, username, Mobile, orderId, amount } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields: userId and amount are required" 
        });
      }

      if (amount <= 0) {
        return res.status(400).json({ 
          success: false,
          error: "Amount must be greater than 0" 
        });
      }

      transaction = await transactionModel.create({
        userId,
        username: username || 'User',
        Mobile: Mobile || '',
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED',
        paymentMethod: 'SDK'
      });

      const transactionId = transaction._id.toString();
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      
      // SAME payment URL as web - mobile app opens this in browser
      const paymentUrl = `${webBaseUrl}/payment?transactionId=${transactionId}&amount=${amount}&orderId=${orderId || transaction.orderId}&userId=${userId}&username=${encodeURIComponent(username || 'User')}&mobile=${Mobile || ''}`;

      console.log('[PhonePe] SDK Payment URL generated:', paymentUrl);

      return res.status(200).json({
        success: true,
        transactionId,
        // Return same URL in both fields - mobile app checks for mercuryLink first
        mercuryLink: paymentUrl,
        paymentUrl: paymentUrl,
        amount,
        orderId: orderId || transaction.orderId
      });

    } catch (error) {
      console.error('[PhonePe] initiateSDK error:', error.message);

      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.message
        }).catch(err => console.error('Failed to update transaction:', err));
      }

      return res.status(500).json({
        success: false,
        error: "Payment initialization failed",
        details: error.message
      });
    }
  }

}

module.exports = new Transaction();
