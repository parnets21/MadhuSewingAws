const axios = require("axios");
const crypto = require('crypto');
const PhonepeModel = require("../models/PhonepeModel");

const MERCHANT_ID = "M23QC1WPAN5Z3";
const SECRET_KEY = "37e1984b-2ab0-43ed-b939-2ae4cc88a2af";  
const PHONEPE_API_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay"; 
const CALLBACK_URL = "https://madhusewingmachines.com";

const transactionModel = PhonepeModel;

const fallbackConfig = {
  frontend: {
    baseUrl: process.env.NODE_ENV === 'production' || !process.env.NODE_ENV 
      ? 'https://madhusewingmachines.com' 
      : 'http://localhost:5001',
    paymentSuccess: '/Paymentsuccess',
    checkout: '/CheckOut'
  }
};

const appConfig = fallbackConfig;

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Frontend baseUrl:", appConfig.frontend.baseUrl); 

const {
  StandardCheckoutClient,
  Env,
  CreateSdkOrderRequest
} = require("pg-sdk-node");

const clientId = "SU2512301550183276999448";
const clientSecret = "f0c866c6-0264-4729-ba6e-deb661a8ea0b";
const clientVersion = 1;
const env = Env.PRODUCTION;

let client;
try {
  client = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env
  );
  console.log("PhonePe SDK client initialized successfully");
} catch (error) {
  console.error("Failed to initialize PhonePe SDK client:", error);
  client = null;
}

class Transaction {
  async addPaymentPhone(req, res) {
    try {
      const { userId, username, Mobile, orderId, amount, config, successUrl, failedUrl } = req.body;

      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "userId, username, Mobile, and amount are required"
        });
      }

      console.log("Creating transaction for user:", userId, "amount:", amount);

      const data = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId,
        amount,
        config,
        successUrl,
        failedUrl
      });

      if (!data) {
        console.error("Failed to create transaction record");
        return res.status(400).json({ error: "Failed to create transaction record" });
      }

      console.log("Transaction created with ID:", data._id);
      const merchantOrderId = data._id.toString();
      const redirectUrl = `${appConfig.frontend.baseUrl}${appConfig.frontend.paymentSuccess}?transactionId=${data._id}&userID=${userId}`;

      console.log("Building payment request for merchantOrderId:", merchantOrderId);
      console.log("Redirect URL:", redirectUrl);

      if (!client) {
        console.error("PhonePe SDK client not initialized");
        return res.status(500).json({ 
          error: "Payment service unavailable",
          details: "PhonePe SDK client initialization failed"
        });
      }

      const paymentRequest = CreateSdkOrderRequest.StandardCheckoutBuilder()
        .merchantOrderId(merchantOrderId)
        .amount(amount * 100)
        .redirectUrl(redirectUrl)
        .build();

      console.log("Sending payment request to PhonePe...");

      try {
        const response = await client.pay(paymentRequest);
        console.log("PhonePe SDK response:", response);
        const checkoutUrl = response.redirectUrl;

        if (checkoutUrl) {
          console.log("Payment URL generated successfully via SDK:", checkoutUrl);
          return res.status(200).json({
            orderId: response.orderId,
            merchantID: merchantOrderId,
            url: checkoutUrl,
          });
        }
      } catch (sdkError) {
        console.error("PhonePe SDK failed, trying direct API approach:", sdkError.message);
      }

      // Fallback to direct API
      console.log("Using direct PhonePe API as fallback...");
      const callbackUrl = `${appConfig.frontend.baseUrl.replace('3000', '5001')}/api/phonepe/checkPayment/${merchantOrderId}/${userId}`;

      const paymentPayload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantOrderId,
        merchantUserId: userId,
        amount: amount * 100,
        redirectUrl: redirectUrl,
        redirectMode: "POST",
        callbackUrl: callbackUrl,
        mobileNumber: Mobile,
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const payload = JSON.stringify(paymentPayload);
      const base64Payload = Buffer.from(payload).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + SECRET_KEY;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
      const signature = sha256Hash + '###' + 1;

      try {
        const directResponse = await axios.post(
          PHONEPE_API_URL,
          { request: base64Payload },
          { headers: { "X-VERIFY": signature, "Content-Type": "application/json" } }
        );

        const checkoutUrl = directResponse.data?.data?.instrumentResponse?.redirectInfo?.url;
        if (checkoutUrl) {
          return res.status(200).json({
            orderId: merchantOrderId,
            merchantID: merchantOrderId,
            url: checkoutUrl,
          });
        } else {
          return res.status(500).json({ 
            error: "PhonePe payment initialization failed",
            details: "Both SDK and direct API approaches failed"
          });
        }
      } catch (directApiError) {
        return res.status(500).json({ 
          error: "PhonePe payment initialization failed",
          details: directApiError.message
        });
      }
    } catch (error) {
      console.error("Payment Error:", error);
      return res.status(500).json({ 
        error: "Payment processing failed",
        details: error.message
      });
    }
  }

  async addPaymentMobile(req, res) {
    let transaction;
    try {
      const { userId, username, Mobile, orderId, amount, platform } = req.body;

      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      transaction = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED',
        platform: platform || 'mobile'
      });

      const merchantTransactionId = transaction._id.toString();
      
      // Use web URL that will redirect to app deep link
      // This is required because PhonePe doesn't support custom URL schemes directly
      const redirectUrl = `https://madhusewingmachines.com/api/phonepe/mobile-redirect?transactionId=${merchantTransactionId}&userId=${userId}`;
      const callbackUrl = `https://madhusewingmachines.com/api/phonepe/payment-callback`;

      console.log("Mobile payment redirect URL:", redirectUrl);

      // Try SDK approach first
      if (client) {
        try {
          const paymentRequest = CreateSdkOrderRequest.StandardCheckoutBuilder()
            .merchantOrderId(merchantTransactionId)
            .amount(amount * 100)
            .redirectUrl(redirectUrl)
            .build();

          const response = await client.pay(paymentRequest);
          console.log("PhonePe SDK response for mobile:", response);
          
          if (response.redirectUrl) {
            return res.status(200).json({
              success: true,
              url: response.redirectUrl,
              transactionId: merchantTransactionId,
              orderId: response.orderId,
            });
          }
        } catch (sdkError) {
          console.error("PhonePe SDK failed for mobile:", sdkError.message);
        }
      }

      // Fallback to direct API
      const paymentPayload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: userId,
        amount: amount * 100,
        redirectUrl: redirectUrl,
        redirectMode: "POST",
        callbackUrl: callbackUrl,
        mobileNumber: Mobile,
        paymentInstrument: { type: "PAY_PAGE" }
      };

      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + SECRET_KEY;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
      const signature = sha256Hash + '###' + 1;

      try {
        const directResponse = await axios.post(
          PHONEPE_API_URL,
          { request: base64Payload },
          { headers: { "X-VERIFY": signature, "Content-Type": "application/json" } }
        );

        const checkoutUrl = directResponse.data?.data?.instrumentResponse?.redirectInfo?.url;
        if (checkoutUrl) {
          return res.status(200).json({
            success: true,
            url: checkoutUrl,
            transactionId: merchantTransactionId,
          });
        }
      } catch (directApiError) {
        console.error("Direct API error:", directApiError.message);
      }

      // Final fallback - return transaction data for client-side handling
      res.status(200).json({
        success: true,
        data: {
          transactionBody: base64Payload,
          checksum: sha256Hash,
          transactionId: transaction._id,
        },
      });
    } catch (error) {
      console.error("Payment Error:", error.message);
      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.message
        });
      }
      return res.status(500).json({
        error: "Payment processing error",
        details: error.message
      });
    }
  }

  // New endpoint to handle mobile app redirect after payment
  async mobileRedirect(req, res) {
    try {
      const { transactionId, userId } = req.query;
      
      console.log(`Mobile redirect for transaction: ${transactionId}, user: ${userId}`);

      // Check payment status
      let status = 'PENDING';
      if (client && transactionId) {
        try {
          const response = await client.getOrderStatus(transactionId);
          status = response.state || 'PENDING';
          
          // Update transaction status in DB
          await transactionModel.findByIdAndUpdate(transactionId, {
            status: status,
            transactionStatus: status
          });
        } catch (err) {
          console.error("Error checking payment status:", err.message);
        }
      }

      // Direct redirect to app using deep link
      const deeplink = `madhuapp://payment-result?txnId=${transactionId}&status=${status}`;
      console.log(`Redirecting to deep link: ${deeplink}`);
      
      return res.redirect(deeplink);
    } catch (error) {
      console.error("Mobile redirect error:", error);
      // Fallback redirect with error status
      const deeplink = `madhuapp://payment-result?txnId=${req.query.transactionId || ''}&status=ERROR`;
      return res.redirect(deeplink);
    }
  }

  async updateStatuspayment(req, res) {
    try {
      const id = req.params.id;
      const data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Data not found" });
      data.status = "Completed";
      await data.save();
      return res.status(200).json({ success: "Successfully Completed" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }

  async checkPayment(req, res) {
    try {
      const id = req.params.id;
      const userId = req.params.userId;

      console.log(`Checking payment for ID: ${id}, User: ${userId}`);

      let data = await transactionModel.findById(id);
      if (!data) {
        return res.status(400).json({ error: "Payment Id not found!" });
      }

      if (!client) {
        return res.status(500).json({ 
          error: "Payment service unavailable",
          details: "PhonePe SDK client not initialized"
        });
      }

      try {
        const response = await client.getOrderStatus(id);
        const state = response.state;

        data.status = state;
        data.transactionStatus = state;
        data = await data.save();

        // Update order payment status if payment is completed
        if (state === 'COMPLETED' || state === 'SUCCESS') {
          try {
            const Order = require("../models/Order");
            
            // Find order by orderId from transaction data
            if (data.orderId) {
              await Order.findByIdAndUpdate(data.orderId, {
                paymentStatus: 'Paid',
                transactionId: id
              });
              console.log(`Updated order ${data.orderId} payment status to Paid`);
            }
          } catch (orderUpdateError) {
            console.error("Error updating order payment status:", orderUpdateError);
          }
        }

        return res.status(200).json({ 
          success: {
            ...data.toObject(),
            status: state,
            successUrl: data.successUrl,
            failedUrl: data.failedUrl
          }
        });
      } catch (phonepeError) {
        console.error("PhonePe API error:", phonepeError);
        return res.status(200).json({ 
          success: {
            ...data.toObject(),
            status: data.status || "PENDING",
            successUrl: data.successUrl,
            failedUrl: data.failedUrl
          }
        });
      }
    } catch (error) {
      console.error("CheckPayment error:", error);
      return res.status(400).json({ error: error.message });
    }
  }

  async paymentcallback(req, res) {
    try {
      const { response } = req.body;
      const decodedStr = Buffer.from(response, 'base64').toString('utf-8');
      const responseJson = JSON.parse(decodedStr);
      const { merchantTransactionId, state } = responseJson?.data;

      console.log(`Callback received: Transaction ${merchantTransactionId}, Status: ${state}`);

      const data = await transactionModel.findById(merchantTransactionId);
      if (data) {
        data.status = state;
        await data.save();
      }

      res.status(200).send('Callback processed');
    } catch (error) {
      console.error("Callback error:", error);
      res.status(500).send('Callback processing failed');
    }
  }

  async getallpayment(req, res) {
    try {
      const data = await transactionModel.find({}).sort({ _id: -1 });
      return res.status(200).json({ success: data });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }

  async makepayment(req, res) {
    const { amount, merchantTransactionId, merchantUserId, callbackUrl, mobileNumber } = req.body;

    const paymentDetails = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId,
      amount,
      redirectUrl: CALLBACK_URL,
      redirectMode: "POST",
      callbackUrl,
      mobileNumber,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const payload = JSON.stringify(paymentDetails);
    const base64Payload = Buffer.from(payload).toString("base64");
    const stringToHash = base64Payload + "/pg/v1/pay" + SECRET_KEY;
    const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
    const signature = sha256Hash + "###" + 1;

    try {
      const response = await axios.post(
        PHONEPE_API_URL,
        { request: base64Payload },
        { headers: { "X-VERIFY": signature } }
      );

      return res.status(200).json({
        url: response.data?.data?.instrumentResponse?.redirectInfo,
      });
    } catch (error) {
      console.error("Payment Error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new Transaction();
