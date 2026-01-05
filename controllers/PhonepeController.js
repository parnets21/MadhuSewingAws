const axios = require("axios");
const crypto = require('crypto');

const transactionModel = require("../models/PhonepeModel");

// PhonePe Configuration - Load from environment variables
const MERCHANT_CONFIG = {
  clientId: process.env.PHONEPE_MERCHANT_ID || "SU2512301550183276999448",
  clientSecret: process.env.PHONEPE_CLIENT_SECRET || "f0c866c6-0264-4729-ba6e-deb661a8ea0b",
  environment: process.env.PHONEPE_ENVIRONMENT || "PRODUCTION",
  apiUrl: process.env.PHONEPE_API_URL || "https://api.phonepe.com/apis/hermes"
};

// Validate configuration on startup
const validateConfig = () => {
  if (!MERCHANT_CONFIG.clientId || !MERCHANT_CONFIG.clientSecret) {
    console.error("ERROR: PhonePe merchant credentials not configured");
    throw new Error("PhonePe merchant credentials not configured");
  }
  if (MERCHANT_CONFIG.environment !== "PRODUCTION" && MERCHANT_CONFIG.environment !== "SANDBOX") {
    console.error("ERROR: Invalid PhonePe environment");
    throw new Error("Invalid PhonePe environment");
  }
  console.log("PhonePe configuration validated successfully");
};

// Validate on module load
try {
  validateConfig();
} catch (error) {
  console.error("Configuration validation failed:", error.message);
}

class Transaction {

  /**
   * Generate SHA256 signature for PhonePe API requests
   * @param {string} payload - Base64 encoded payload
   * @param {string} endpoint - API endpoint (e.g., "/pg/v1/orders")
   * @returns {string} - Signature in format: hash###saltIndex
   */
  generateSignature(payload, endpoint) {
    const stringToHash = payload + endpoint + MERCHANT_CONFIG.clientSecret;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const saltIndex = 1;
    return sha256Hash + '###' + saltIndex;
  }

  /**
   * Log payment request (sanitized - no secrets)
   */
  logPaymentRequest(endpoint, payload, signature) {
    console.log(`[PhonePe] Request to ${endpoint}:`, {
      timestamp: new Date().toISOString(),
      endpoint,
      payloadLength: payload.length,
      signatureLength: signature.length,
    });
  }

  /**
   * Log payment response (sanitized - no tokens)
   */
  logPaymentResponse(endpoint, response) {
    console.log(`[PhonePe] Response from ${endpoint}:`, {
      timestamp: new Date().toISOString(),
      endpoint,
      status: response.status,
      hasToken: !!response.token,
      hasOrderId: !!response.orderId,
      state: response.state,
    });
  }

  /**
   * Log error (sanitized)
   */
  logError(context, error) {
    console.error(`[PhonePe] Error in ${context}:`, {
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      code: error.code,
    });
  }

  /**
   * POST /phonepe/initiate
   * Creates payment for web-based flow
   * Returns payment URL for web page
   */
  async initiate(req, res) {
    let transaction;

    try {
      const { userId, username, mobile, orderId, amount } = req.body;

      // Validate required fields
      if (!userId || !amount) {
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields: userId and amount are required" 
        });
      }
      // Validate amount is positive
      if (amount <= 0) {
        return res.status(400).json({ 
          success: false,
          error: "Amount must be greater than 0" 
        });
      }

      // Create transaction record
      transaction = await transactionModel.create({
        userId,
        username: username || 'User',
        Mobile: mobile || '',
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED',
        paymentMethod: 'WEB'
      });

      if (!transaction) {
        return res.status(400).json({ 
          success: false,
          error: "Failed to create transaction" 
        });
      }

      const transactionId = transaction._id.toString();

      // Build payment URL for web page
      // The web page will handle PhonePe integration directly
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      const paymentUrl = `${webBaseUrl}/payment?transactionId=${transactionId}&amount=${amount}&orderId=${orderId || transaction.orderId}&userId=${userId}&username=${encodeURIComponent(username || 'User')}&mobile=${mobile || ''}`;

      console.log('Payment URL generated:', paymentUrl);

      return res.status(200).json({
        success: true,
        transactionId,
        paymentUrl,
        amount,
        orderId: orderId || transaction.orderId
      });

    } catch (error) {
      this.logError('initiate', error);

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
   * Verifies payment status with PhonePe API
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

      // Find transaction in database
      let transaction = await transactionModel.findById(transactionId);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found"
        });
      }

      // Check status with PhonePe API
      try {
        // Prepare request for status check
        const statusPayload = {
          merchantOrderId: transactionId
        };

        const base64Payload = Buffer.from(JSON.stringify(statusPayload)).toString('base64');
        const signature = this.generateSignature(base64Payload, '/pg/v1/status');

        this.logPaymentRequest('/pg/v1/status', base64Payload, signature);

        // Call PhonePe status API
        const statusResponse = await axios.post(
          `${MERCHANT_CONFIG.apiUrl}/pg/v1/status`,
          {
            request: base64Payload
          },
          {
            headers: {
              'X-VERIFY': signature,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        this.logPaymentResponse('/pg/v1/status', statusResponse.data);

        const responseData = statusResponse.data;
        const state = responseData.state || 'UNKNOWN';

        console.log('PhonePe status response:', { transactionId, state });

        // Update transaction status
        transaction.status = state;
        await transaction.save();

        return res.status(200).json({
          success: true,
          status: state,
          transactionId: transactionId,
          amount: transaction.amount,
          message: state === 'COMPLETED' ? 'Payment successful' : 
                   state === 'PENDING' ? 'Payment is being processed' :
                   state === 'FAILED' ? 'Payment failed' :
                   state === 'CANCELLED' ? 'Payment cancelled' :
                   'Payment status unknown'
        });

      } catch (phonepeError) {
        console.error('PhonePe API error:', phonepeError.message);
        
        // If PhonePe API fails, return cached status
        return res.status(200).json({
          success: true,
          status: transaction.status || 'PENDING',
          transactionId: transactionId,
          amount: transaction.amount,
          message: 'Unable to verify with PhonePe, returning cached status'
        });
      }

    } catch (error) {
      this.logError('verify', error);
      return res.status(500).json({
        success: false,
        error: "Payment verification failed",
        details: error.message
      });
    }
  }

  /**
   * POST /phonepe/initiate-sdk
   * Creates payment for native SDK flow using PhonePe REST API
   * Returns token for react-native-phonepe-pg SDK v3.x
   * Falls back to Mercury link if API fails
   */
  async initiateSDK(req, res) {
    let transaction;

    try {
      const { userId, username, Mobile, orderId, amount, config } = req.body;

      // Validate required fields
      if (!userId || !amount) {
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields: userId and amount are required" 
        });
      }

      // Validate amount is positive
      if (amount <= 0) {
        return res.status(400).json({ 
          success: false,
          error: "Amount must be greater than 0" 
        });
      }

      // Create transaction record
      transaction = await transactionModel.create({
        userId,
        username: username || 'User',
        Mobile: Mobile || '',
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        config: config || null,
        status: 'INITIATED',
        paymentMethod: 'SDK'
      });

      if (!transaction) {
        return res.status(400).json({ 
          success: false,
          error: "Failed to create transaction" 
        });
      }

      const transactionId = transaction._id.toString();
      const amountInPaise = Math.round(amount * 100);

      // Prepare request payload for PhonePe /v1/pay endpoint
      // Using the correct format for PhonePe API
      const paymentPayload = {
        merchantId: MERCHANT_CONFIG.clientId,
        merchantUserId: userId,
        merchantOrderId: transactionId,
        amount: amountInPaise,
        expireAfter: 1200,
        description: `Payment for order ${transactionId}`,
        notifyUrl: `${process.env.WEB_URL || 'https://madhusewingmachines.com'}/api/phonepe/notify`,
        redirectUrl: `${process.env.WEB_URL || 'https://madhusewingmachines.com'}/payment?transactionId=${transactionId}`,
        udf1: userId,
        udf2: username || 'User',
        udf3: Mobile || ''
      };

      // Encode payload to base64
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

      // Generate signature (use /pg/v1/orders endpoint path)
      // Signature format: SHA256(base64Payload + "/pg/v1/orders" + clientSecret) + "###1"
      const signature = this.generateSignature(base64Payload, '/pg/v1/orders');

      // Log request (sanitized)
      this.logPaymentRequest('/pg/v1/orders', base64Payload, signature);

      console.log('DEBUG - Payment Payload:', JSON.stringify(paymentPayload, null, 2));
      console.log('DEBUG - Base64 Payload:', base64Payload);
      console.log('DEBUG - Signature:', signature);

      // Try to call PhonePe API to get token
      let phonepeResponse;
      let apiSuccess = false;

      try {
        phonepeResponse = await axios.post(
          `${MERCHANT_CONFIG.apiUrl}/pg/v1/orders`,
          {
            request: base64Payload
          },
          {
            headers: {
              'X-VERIFY': signature,
              'Content-Type': 'application/json'
            },
            timeout: 10000,
            validateStatus: function (status) {
              return true;
            }
          }
        );

        console.log('DEBUG - PhonePe Response Status:', phonepeResponse.status);
        console.log('DEBUG - PhonePe Response Data:', JSON.stringify(phonepeResponse.data, null, 2));

        // Check if response status indicates success
        if (phonepeResponse.status === 200 && phonepeResponse.data?.orderId && phonepeResponse.data?.token) {
          apiSuccess = true;
          this.logPaymentResponse('/pg/v1/orders', phonepeResponse.data);
        } else {
          console.warn(`PhonePe API returned status ${phonepeResponse.status}:`, phonepeResponse.data);
        }
      } catch (apiError) {
        console.error('PhonePe API call failed:', apiError.message);
        // Continue with fallback - don't throw yet
      }

      // If API succeeded, return token
      if (apiSuccess && phonepeResponse.data?.token) {
        const responseData = phonepeResponse.data;

        // Update transaction with PhonePe order ID
        transaction.phonepeOrderId = responseData.orderId;
        await transaction.save();

        // Deep link callback URL for returning to app after payment
        const callbackUrl = `madhusewing://paymentstatus?transactionId=${transactionId}&status=PENDING&userId=${userId}`;

        // Return Mercury link directly
        const mercuryLink = `https://mercury-t2.phonepe.com/transact/pgv3?token=${responseData.token}&routingKey=W`;

        return res.status(200).json({
          success: true,
          token: responseData.token,
          orderId: responseData.orderId,
          transactionId: transactionId,
          mercuryLink: mercuryLink,
          callbackUrl: callbackUrl,
          merchantId: MERCHANT_CONFIG.clientId,
          amount: amount
        });
      }

      // API failed - return fallback web URL
      console.warn('PhonePe API failed, returning fallback web payment URL');
      
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      const paymentUrl = `${webBaseUrl}/payment?transactionId=${transactionId}&amount=${amount}&orderId=${orderId || transaction.orderId}&userId=${userId}&username=${encodeURIComponent(username || 'User')}&mobile=${Mobile || ''}`;

      return res.status(200).json({
        success: true,
        transactionId,
        paymentUrl,
        amount,
        orderId: orderId || transaction.orderId,
        fallback: true,
        message: 'Using web-based payment as fallback'
      });

    } catch (error) {
      this.logError('initiateSDK', error);

      if (error.response?.data) {
        console.error('PhonePe API Error Response:', JSON.stringify(error.response.data, null, 2));
      }

      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.message,
          errorCode: error.response?.data?.errorCode || 'UNKNOWN'
        }).catch(err => console.error('Failed to update transaction:', err));
      }

      if (error.response?.status === 400) {
        console.error('PhonePe 400 error details:', JSON.stringify(error.response?.data, null, 2));
        return res.status(400).json({
          success: false,
          error: "Invalid payment request",
          details: error.response?.data?.message || error.message,
          phonepeError: error.response?.data
        });
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return res.status(500).json({
          success: false,
          error: "Payment service authentication failed",
          details: "Please check merchant credentials"
        });
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({
          success: false,
          error: "Payment service temporarily unavailable",
          details: "Please try again in a moment"
        });
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
