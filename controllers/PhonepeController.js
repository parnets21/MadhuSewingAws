const { StandardCheckoutClient, Env, CreateSdkOrderRequest, StandardCheckoutPayRequest } = require('pg-sdk-node');

const transactionModel = require("../models/PhonepeModel");

// PhonePe Configuration - Load from environment variables
const MERCHANT_CONFIG = {
  clientId: process.env.PHONEPE_MERCHANT_ID || "M23T8T3E76KMB",
  clientSecret: process.env.PHONEPE_CLIENT_SECRET || "f0c866c6-0264-4729-ba6e-deb661a8ea0b",
  clientVersion: 1,
  environment: process.env.PHONEPE_ENVIRONMENT || "PRODUCTION"
};

// Initialize PhonePe SDK Client
let phonepeClient = null;

const initializePhonePeClient = () => {
  try {
    const env = MERCHANT_CONFIG.environment === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX;
    phonepeClient = StandardCheckoutClient.getInstance(
      MERCHANT_CONFIG.clientId,
      MERCHANT_CONFIG.clientSecret,
      MERCHANT_CONFIG.clientVersion,
      env
    );
    console.log('PhonePe SDK Client initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize PhonePe SDK Client:', error.message);
    return false;
  }
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

// Validate and initialize on module load
try {
  validateConfig();
  initializePhonePeClient();
} catch (error) {
  console.error("Configuration validation failed:", error.message);
}

class Transaction {

  /**
   * Log payment request (sanitized - no secrets)
   */
  logPaymentRequest(context, data) {
    console.log(`[PhonePe] ${context}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Log payment response (sanitized - no tokens)
   */
  logPaymentResponse(context, response) {
    console.log(`[PhonePe] Response - ${context}:`, {
      timestamp: new Date().toISOString(),
      state: response?.state,
      hasRedirectUrl: !!response?.redirectUrl,
      hasToken: !!response?.token,
      orderId: response?.orderId
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
   * Creates payment for web-based flow using PhonePe SDK
   * Returns redirect URL for payment page
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
      const amountInPaise = Math.round(amount * 100);
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      const redirectUrl = `${webBaseUrl}/payment-status?transactionId=${transactionId}`;

      this.logPaymentRequest('initiate', { transactionId, amount: amountInPaise });

      // Try using PhonePe SDK
      if (phonepeClient) {
        try {
          const request = StandardCheckoutPayRequest.builder()
            .merchantOrderId(transactionId)
            .amount(amountInPaise)
            .redirectUrl(redirectUrl)
            .build();

          const response = await phonepeClient.pay(request);
          
          this.logPaymentResponse('initiate', response);

          if (response && response.redirectUrl) {
            // Update transaction with PhonePe order ID
            transaction.phonepeOrderId = response.orderId;
            await transaction.save();

            return res.status(200).json({
              success: true,
              transactionId,
              redirectUrl: response.redirectUrl,
              phonepeOrderId: response.orderId,
              amount,
              orderId: orderId || transaction.orderId
            });
          }
        } catch (sdkError) {
          console.error('PhonePe SDK error:', sdkError.message);
          // Fall through to fallback
        }
      }

      // Fallback - return web payment URL
      const paymentUrl = `${webBaseUrl}/payment?transactionId=${transactionId}&amount=${amount}&orderId=${orderId || transaction.orderId}&userId=${userId}&username=${encodeURIComponent(username || 'User')}&mobile=${mobile || ''}`;

      return res.status(200).json({
        success: true,
        transactionId,
        paymentUrl,
        amount,
        orderId: orderId || transaction.orderId,
        fallback: true
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
   * Verifies payment status with PhonePe SDK
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

      this.logPaymentRequest('verify', { transactionId });

      // Check status with PhonePe SDK
      if (phonepeClient) {
        try {
          const response = await phonepeClient.getOrderStatus(transactionId);
          
          this.logPaymentResponse('verify', response);

          const state = response?.state || 'UNKNOWN';

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
        } catch (sdkError) {
          console.error('PhonePe SDK status check error:', sdkError.message);
        }
      }

      // Return cached status if SDK fails
      return res.status(200).json({
        success: true,
        status: transaction.status || 'PENDING',
        transactionId: transactionId,
        amount: transaction.amount,
        message: 'Unable to verify with PhonePe, returning cached status'
      });

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
   * Creates payment for native SDK flow using PhonePe SDK
   * Returns token for react-native-phonepe-pg SDK
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
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      const redirectUrl = `${webBaseUrl}/payment-status?transactionId=${transactionId}`;

      this.logPaymentRequest('initiateSDK', { transactionId, amount: amountInPaise, userId });

      // Try using PhonePe SDK to create SDK order
      if (phonepeClient) {
        try {
          const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
            .merchantOrderId(transactionId)
            .amount(amountInPaise)
            .redirectUrl(redirectUrl)
            .build();

          console.log('DEBUG - Creating SDK Order with:', { transactionId, amountInPaise, redirectUrl });

          const response = await phonepeClient.createSdkOrder(request);
          
          console.log('DEBUG - SDK Order Response:', JSON.stringify(response, null, 2));
          this.logPaymentResponse('initiateSDK', response);

          if (response && response.token) {
            // Update transaction with PhonePe order ID
            transaction.phonepeOrderId = response.orderId;
            await transaction.save();

            // Deep link callback URL for returning to app after payment
            const callbackUrl = `madhusewing://paymentstatus?transactionId=${transactionId}&status=PENDING&userId=${userId}`;

            return res.status(200).json({
              success: true,
              token: response.token,
              orderId: response.orderId,
              transactionId: transactionId,
              callbackUrl: callbackUrl,
              merchantId: MERCHANT_CONFIG.clientId,
              amount: amount
            });
          }
        } catch (sdkError) {
          console.error('PhonePe SDK createSdkOrder error:', sdkError.message);
          if (sdkError.response) {
            console.error('SDK Error Response:', JSON.stringify(sdkError.response, null, 2));
          }
          // Fall through to fallback
        }
      }

      // API failed - return fallback web URL
      console.warn('PhonePe SDK failed, returning fallback web payment URL');
      
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

      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.message,
          errorCode: error.code || 'UNKNOWN'
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
