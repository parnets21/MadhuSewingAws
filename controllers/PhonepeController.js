const transactionModel = require("../models/PhonepeModel");
const crypto = require("crypto");
const axios = require("axios");

// PhonePe Configuration
const PHONEPE_CONFIG = {
  merchantId: process.env.PHONEPE_MERCHANT_ID || "M23T8T3E76KMB",
  saltKey: process.env.PHONEPE_CLIENT_SECRET || "f0c866c6-0264-4729-ba6e-deb661a8ea0b",
  saltIndex: 1,
  environment: process.env.PHONEPE_ENVIRONMENT || "PRODUCTION",
  apiUrl: process.env.PHONEPE_API_URL || "https://api.phonepe.com/apis/hermes"
};

// Get PhonePe API base URL based on environment
const getApiUrl = () => {
  if (PHONEPE_CONFIG.environment === "SANDBOX") {
    return "https://api-preprod.phonepe.com/apis/pg-sandbox";
  }
  return PHONEPE_CONFIG.apiUrl || "https://api.phonepe.com/apis/hermes";
};

// Generate SHA256 checksum for PhonePe
const generateChecksum = (payload, endpoint) => {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const stringToHash = base64Payload + endpoint + PHONEPE_CONFIG.saltKey;
  const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
  return `${sha256Hash}###${PHONEPE_CONFIG.saltIndex}`;
};

class Transaction {

  /**
   * POST /phonepe/initiate
   * Initiate PhonePe payment and return payment URL
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

      const transactionId = transaction._id.toString();
      const merchantTransactionId = `MT_${transactionId}`;
      const webBaseUrl = process.env.WEB_URL || 'https://madhusewingmachines.com';
      
      // PhonePe payment payload
      const payload = {
        merchantId: PHONEPE_CONFIG.merchantId,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: userId,
        amount: Math.round(amount * 100), // PhonePe expects amount in paise
        redirectUrl: `${webBaseUrl}/payment?transactionId=${transactionId}&status=redirect`,
        redirectMode: "REDIRECT",
        callbackUrl: `${webBaseUrl}/api/phonepe/callback`,
        mobileNumber: mobile || undefined,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
      const endpoint = "/pg/v1/pay";
      const checksum = generateChecksum(payload, endpoint);

      console.log('[PhonePe] Initiating payment:', { merchantTransactionId, amount, userId });

      // Call PhonePe API
      const apiUrl = getApiUrl();
      const response = await axios.post(
        `${apiUrl}${endpoint}`,
        { request: base64Payload },
        {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": checksum,
          },
        }
      );

      console.log('[PhonePe] API Response:', response.data);

      if (response.data.success && response.data.data?.instrumentResponse?.redirectInfo?.url) {
        const paymentUrl = response.data.data.instrumentResponse.redirectInfo.url;
        
        // Update transaction with PhonePe transaction ID
        await transactionModel.findByIdAndUpdate(transactionId, {
          merchantTransactionId: merchantTransactionId,
          phonepeTransactionId: response.data.data?.transactionId
        });

        console.log('[PhonePe] Payment URL:', paymentUrl);

        return res.status(200).json({
          success: true,
          transactionId,
          merchantTransactionId,
          paymentUrl,
          amount,
          orderId: orderId || transaction.orderId
        });
      } else {
        throw new Error(response.data.message || "Failed to get payment URL from PhonePe");
      }

    } catch (error) {
      console.error('[PhonePe] initiate error:', error.response?.data || error.message);

      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.response?.data?.message || error.message
        }).catch(err => console.error('Failed to update transaction:', err));
      }

      return res.status(500).json({
        success: false,
        error: "Payment initialization failed",
        details: error.response?.data?.message || error.message
      });
    }
  }

  /**
   * POST /phonepe/callback
   * PhonePe callback after payment
   */
  async callback(req, res) {
    try {
      console.log('[PhonePe] Callback received:', req.body);

      const { response: encodedResponse } = req.body;
      
      if (!encodedResponse) {
        return res.status(400).json({ success: false, error: "No response data" });
      }

      // Decode the response
      const decodedResponse = JSON.parse(Buffer.from(encodedResponse, "base64").toString());
      console.log('[PhonePe] Decoded callback:', decodedResponse);

      const { merchantTransactionId, transactionId: phonepeTransactionId, code } = decodedResponse;

      // Extract our transaction ID from merchantTransactionId (MT_<transactionId>)
      const ourTransactionId = merchantTransactionId?.replace('MT_', '');

      if (!ourTransactionId) {
        return res.status(400).json({ success: false, error: "Invalid transaction ID" });
      }

      // Update transaction status based on PhonePe response
      let status = 'PENDING';
      if (code === 'PAYMENT_SUCCESS') {
        status = 'COMPLETED';
      } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
        status = 'FAILED';
      } else if (code === 'PAYMENT_CANCELLED') {
        status = 'CANCELLED';
      }

      await transactionModel.findByIdAndUpdate(ourTransactionId, {
        status,
        phonepeTransactionId,
        phonepeResponse: decodedResponse
      });

      console.log('[PhonePe] Transaction updated:', { ourTransactionId, status });

      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('[PhonePe] callback error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /phonepe/verify
   * Verify payment status with PhonePe
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

      // If we have a merchantTransactionId, check status with PhonePe
      if (transaction.merchantTransactionId && transaction.status === 'INITIATED') {
        try {
          const endpoint = `/pg/v1/status/${PHONEPE_CONFIG.merchantId}/${transaction.merchantTransactionId}`;
          const stringToHash = endpoint + PHONEPE_CONFIG.saltKey;
          const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
          const checksum = `${sha256Hash}###${PHONEPE_CONFIG.saltIndex}`;

          const apiUrl = getApiUrl();
          const response = await axios.get(`${apiUrl}${endpoint}`, {
            headers: {
              "Content-Type": "application/json",
              "X-VERIFY": checksum,
              "X-MERCHANT-ID": PHONEPE_CONFIG.merchantId
            }
          });

          console.log('[PhonePe] Status check response:', response.data);

          if (response.data.success) {
            const code = response.data.code;
            let status = 'PENDING';
            
            if (code === 'PAYMENT_SUCCESS') {
              status = 'COMPLETED';
            } else if (code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
              status = 'FAILED';
            } else if (code === 'PAYMENT_CANCELLED') {
              status = 'CANCELLED';
            } else if (code === 'PAYMENT_PENDING') {
              status = 'PENDING';
            }

            // Update transaction status
            transaction = await transactionModel.findByIdAndUpdate(
              transactionId,
              { 
                status,
                phonepeResponse: response.data
              },
              { new: true }
            );
          }
        } catch (statusError) {
          console.error('[PhonePe] Status check error:', statusError.response?.data || statusError.message);
          // Continue with existing transaction status
        }
      }

      return res.status(200).json({
        success: true,
        status: transaction.status || 'PENDING',
        transactionId: transactionId,
        amount: transaction.amount,
        message: transaction.status === 'COMPLETED' ? 'Payment successful' : 
                 transaction.status === 'PENDING' || transaction.status === 'INITIATED' ? 'Payment is being processed' :
                 transaction.status === 'FAILED' ? 'Payment failed' :
                 transaction.status === 'CANCELLED' ? 'Payment cancelled' :
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
   * Same as initiate - for backward compatibility
   */
  async initiateSDK(req, res) {
    // Just call the regular initiate method
    return this.initiate(req, res);
  }

}

module.exports = new Transaction();
