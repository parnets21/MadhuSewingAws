const axios = require("axios");
const crypto = require('crypto');

// PhonePe Production Credentials
const MERCHANT_ID = "M23T8T3E76KMB";
const CLIENT_ID = "SU2512301550183276999448";
const CLIENT_SECRET = "f0c866c6-0264-4729-ba6e-deb661a8ea0b";
const CLIENT_VERSION = 1;

// PhonePe Standard Checkout API URLs
const PHONEPE_AUTH_URL = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
const PHONEPE_CHECKOUT_URL = "https://api.phonepe.com/apis/pg/checkout/v2/pay";
const PHONEPE_STATUS_URL = "https://api.phonepe.com/apis/pg/checkout/v2/order";
const CALLBACK_URL = "https://madhusewingmachines.com";

const transactionModel = require("../models/PhonepeModel");
const Checkout = require("../models/Order");

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

// Logging helper
const log = (tag, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [${tag}] Data:`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
};

console.log("PhonePe: Using Standard Checkout REST API");

// Function to get OAuth access token
async function getAccessToken(forceRefresh = false) {
  // Return cached token if still valid and not forcing refresh
  if (!forceRefresh && accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    log("AUTH", "Using cached access token", { expiresIn: Math.round((tokenExpiry - Date.now()) / 1000) + "s" });
    return accessToken;
  }

  try {
    log("AUTH", "Fetching new access token...");
    log("AUTH", "Auth URL:", PHONEPE_AUTH_URL);
    log("AUTH", "Client ID:", CLIENT_ID.substring(0, 10) + "...");
    
    const response = await axios.post(
      PHONEPE_AUTH_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    log("AUTH", "Token response received", {
      hasAccessToken: !!response.data.access_token,
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in
    });
    
    accessToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry
    tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
    return accessToken;
  } catch (error) {
    log("AUTH", "ERROR getting access token", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
}

class Transaction {

  async addPaymentPhone(req, res) {
    const requestId = `REQ_${Date.now()}`;
    log("PAYMENT", `=== START Payment Request ${requestId} ===`);

    try {
      log("PAYMENT", "Request body received", req.body);
      const { userId, username, Mobile, orderId, amount, config, successUrl, failedUrl } = req.body;

      // Validate required fields
      if (!userId || !username || !Mobile || !amount) {
        log("PAYMENT", "ERROR: Missing required fields", { userId: !!userId, username: !!username, Mobile: !!Mobile, amount: !!amount });
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "userId, username, Mobile, and amount are required"
        });
      }

      // Validate minimum amount (PhonePe requires minimum ₹1)
      if (amount < 1) {
        log("PAYMENT", "ERROR: Amount too low", { amount });
        return res.status(400).json({ 
          error: "Invalid amount",
          details: "Minimum payment amount is ₹1"
        });
      }

      log("PAYMENT", "Creating transaction", { userId, amount, orderId });

      // Save transaction details in DB
      const data = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId,
        amount,
        config,
        successUrl,
        failedUrl,
        status: 'INITIATED',
        requestId
      });

      if (!data) {
        log("PAYMENT", "ERROR: Failed to create transaction record");
        return res.status(400).json({ error: "Failed to create transaction record" });
      }

      log("PAYMENT", "Transaction created in DB", { transactionId: data._id });

      const merchantOrderId = data._id.toString();
      const redirectUrl = `https://madhusewingmachines.com/PaymentSuccess?transactionId=${data._id}&userID=${userId}&source=app`;

      log("PAYMENT", "Preparing PhonePe API call", { merchantOrderId, redirectUrl });

      try {
        // Get OAuth access token
        const token = await getAccessToken();
        log("PAYMENT", "Got access token", { tokenLength: token?.length });

        // Standard Checkout API payload
        const checkoutPayload = {
          merchantId: MERCHANT_ID,
          merchantOrderId: merchantOrderId,
          amount: amount * 100, // Convert to paise
          expireAfter: 1200, // 20 minutes
          metaInfo: {
            udf1: userId,
            udf2: username,
            udf3: Mobile
          },
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: `Payment for Order ${merchantOrderId}`,
            merchantUrls: {
              redirectUrl: redirectUrl,
              callbackUrl: `https://madhusewingmachines.com/api/phonepe/callback`
            }
          }
        };

        log("PAYMENT", "PhonePe API Request", {
          url: PHONEPE_CHECKOUT_URL,
          payload: checkoutPayload,
          amountInPaise: amount * 100
        });

        const startTime = Date.now();
        const response = await axios.post(
          PHONEPE_CHECKOUT_URL,
          checkoutPayload,
          {
            headers: {
              "Authorization": `O-Bearer ${token}`,
              "Content-Type": "application/json"
            },
          }
        );
        const responseTime = Date.now() - startTime;

        log("PAYMENT", "PhonePe API Response", {
          responseTime: `${responseTime}ms`,
          status: response.status,
          data: response.data
        });
        
        const checkoutUrl = response.data?.redirectUrl || response.data?.data?.redirectUrl || response.data?.redirect_url;
        
        if (checkoutUrl) {
          // Update transaction with PhonePe order ID
          await transactionModel.findByIdAndUpdate(data._id, {
            phonepeOrderId: response.data?.orderId,
            status: 'PENDING',
            checkoutUrl: checkoutUrl
          });

          log("PAYMENT", "SUCCESS: Payment URL generated", {
            checkoutUrl: checkoutUrl.substring(0, 100) + "...",
            phonepeOrderId: response.data?.orderId
          });
          log("PAYMENT", `=== END Payment Request ${requestId} - SUCCESS ===`);
          
          return res.status(200).json({
            orderId: merchantOrderId,
            merchantID: merchantOrderId,
            url: checkoutUrl,
            phonepeOrderId: response.data?.orderId
          });
        } else {
          log("PAYMENT", "ERROR: No redirect URL in response", response.data);
          await transactionModel.findByIdAndUpdate(data._id, { status: 'FAILED', error: 'No redirect URL' });
          
          return res.status(500).json({ 
            error: "PhonePe payment initialization failed",
            details: "No redirect URL received from PhonePe"
          });
        }
      } catch (apiError) {
        log("PAYMENT", "ERROR: PhonePe API call failed", {
          message: apiError.message,
          response: apiError.response?.data,
          status: apiError.response?.status
        });
        
        await transactionModel.findByIdAndUpdate(data._id, { 
          status: 'FAILED', 
          error: apiError.response?.data?.message || apiError.message 
        });
        
        // If auth failed, try refreshing token and retry once
        if (apiError.response?.status === 401) {
          log("PAYMENT", "Auth failed, retrying with fresh token...");
          try {
            const freshToken = await getAccessToken(true);
            const retryResponse = await axios.post(
              PHONEPE_CHECKOUT_URL,
              checkoutPayload,
              {
                headers: {
                  "Authorization": `O-Bearer ${freshToken}`,
                  "Content-Type": "application/json"
                },
              }
            );
            
            const checkoutUrl = retryResponse.data?.redirectUrl;
            if (checkoutUrl) {
              await transactionModel.findByIdAndUpdate(data._id, { status: 'PENDING', checkoutUrl });
              log("PAYMENT", "SUCCESS on retry", { checkoutUrl: checkoutUrl.substring(0, 100) + "..." });
              return res.status(200).json({
                orderId: merchantOrderId,
                merchantID: merchantOrderId,
                url: checkoutUrl
              });
            }
          } catch (retryError) {
            log("PAYMENT", "Retry also failed", retryError.response?.data || retryError.message);
          }
        }
        
        log("PAYMENT", `=== END Payment Request ${requestId} - FAILED ===`);
        return res.status(500).json({ 
          error: "PhonePe payment initialization failed",
          details: apiError.response?.data?.message || apiError.message,
          phonepeError: apiError.response?.data
        });
      }
    } catch (error) {
      log("PAYMENT", "ERROR: Unexpected error", {
        message: error.message,
        stack: error.stack
      });
      log("PAYMENT", `=== END Payment Request ${requestId} - ERROR ===`);
      
      return res.status(500).json({ 
        error: "Payment processing failed",
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  async addPaymentMobile(req, res) {
    const requestId = `MOB_${Date.now()}`;
    log("MOBILE", `=== START Mobile Payment Request ${requestId} ===`);
    
    let transaction;

    try {
      log("MOBILE", "Request body received", req.body);
      const { userId, username, Mobile, orderId, amount } = req.body;
      
      // Validate input
      if (!userId || !username || !Mobile || !amount) {
        log("MOBILE", "ERROR: Missing required fields");
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields",
          code: "INVALID_REQUEST"
        });
      }

      if (amount < 1) {
        log("MOBILE", "ERROR: Amount too low", { amount });
        return res.status(400).json({ 
          success: false,
          error: "Minimum payment amount is ₹1",
          code: "INVALID_AMOUNT"
        });
      }

      // Create transaction record
      transaction = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED',
        paymentFlow: 'MOBILE'
      });

      log("MOBILE", "Transaction created", { transactionId: transaction._id });

      // Use Hermes API for mobile payments
      const HERMES_PAY_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay";
      
      // Prepare Hermes payment payload
      const paymentPayload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: transaction._id.toString(),
        merchantUserId: userId,
        amount: amount * 100, // Convert to paise
        redirectUrl: `madhusewing://paymentstatus?transactionId=${transaction._id}&userID=${userId}`,
        redirectMode: "POST",
        callbackUrl: `https://madhusewingmachines.com/api/phonepe/callback`,
        mobileNumber: Mobile,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      log("MOBILE", "Hermes payload prepared", {
        merchantId: MERCHANT_ID,
        transactionId: transaction._id.toString(),
        amount: amount * 100,
        redirectUrl: paymentPayload.redirectUrl
      });

      // Generate signature for Hermes API
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + CLIENT_SECRET;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex') + '###1';

      log("MOBILE", "Calling Hermes API...");

      const response = await axios.post(
        HERMES_PAY_URL,
        { request: base64Payload },
        {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": sha256Hash
          }
        }
      );

      log("MOBILE", "Hermes API Response", {
        success: response.data?.success,
        code: response.data?.code,
        hasRedirectInfo: !!response.data?.data?.instrumentResponse?.redirectInfo
      });

      if (response.data?.success && response.data?.data?.instrumentResponse?.redirectInfo?.url) {
        const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
        
        // Update transaction with PhonePe details
        await transactionModel.findByIdAndUpdate(transaction._id, {
          phonepeOrderId: response.data?.data?.merchantTransactionId || transaction._id.toString(),
          status: 'PENDING',
          checkoutUrl: redirectUrl
        });

        log("MOBILE", "SUCCESS: Payment URL generated", {
          redirectUrl: redirectUrl.substring(0, 100) + "..."
        });
        log("MOBILE", `=== END Mobile Payment Request ${requestId} - SUCCESS ===`);

        return res.status(200).json({
          success: true,
          data: {
            transactionId: transaction._id,
            phonepeOrderId: response.data?.data?.merchantTransactionId,
            redirectUrl: redirectUrl,
            // For PhonePe SDK if needed
            transactionBody: base64Payload,
            checksum: sha256Hash
          }
        });
      } else {
        log("MOBILE", "ERROR: No redirect URL in response", response.data);
        await transactionModel.findByIdAndUpdate(transaction._id, { 
          status: 'FAILED', 
          error: response.data?.message || 'No redirect URL' 
        });

        return res.status(500).json({
          success: false,
          error: response.data?.message || "Payment initialization failed",
          code: response.data?.code || "PHONEPE_ERROR"
        });
      }

    } catch (error) {
      log("MOBILE", "ERROR", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Update transaction status if it was created
      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.response?.data?.message || error.message
        });
      }

      log("MOBILE", `=== END Mobile Payment Request ${requestId} - FAILED ===`);

      return res.status(500).json({
        success: false,
        error: error.response?.data?.message || error.message || "Payment processing error",
        code: error.response?.data?.code || "SERVER_ERROR"
      });
    }
  }

  async updateStatuspayment(req, res) {
    try {
      console.log('[updateStatuspayment] id:', req.params.id);
      let id = req.params.id;
      let data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Data not found" });
      data.status = "Completed";
      data.save();
      return res.status(200).json({ success: "Successfully Completed" });
    } catch (error) {
      console.log('[updateStatuspayment] error:', error);
    }
  }

  async checkPayment(req, res) {
    const requestId = `CHK_${Date.now()}`;
    log("CHECK", `=== START Check Payment ${requestId} ===`);
    
    try {
      log("CHECK", "Request params", req.params);

      let id = req.params.id;
      let userId = req.params.userId;
      
      let data = await transactionModel.findById(id);
      if (!data) {
        log("CHECK", "ERROR: Transaction not found", { id });
        return res.status(400).json({ 
          success: false,
          error: "Payment Id not found!",
          code: "NOT_FOUND"
        });
      }
      
      log("CHECK", "Transaction found in DB", { 
        id: data._id, 
        status: data.status, 
        amount: data.amount,
        phonepeOrderId: data.phonepeOrderId 
      });

      // Helper to persist state and update related order
      const persistState = async (state) => {
        log("CHECK", "Persisting state", { state });
        if (state === "COMPLETED") {
          if (data.config) {
            try {
              await axios(JSON.parse(data.config));
              data.config = null;
            } catch (e) {
              log("CHECK", "Config callback failed", e.message);
            }
          }
          if (data.orderId && /^[0-9a-fA-F]{24}$/.test(data.orderId)) {
            try {
              await Checkout.findByIdAndUpdate(
                data.orderId,
                { status: 'Confirmed' },
                { new: true }
              );
              log("CHECK", "Order status updated to Confirmed");
            } catch (e) {
              log("CHECK", "Failed to update order status", e.message);
            }
          }
        }
        data.status = state;
        return await data.save();
      };

      // Use phonepeOrderId for status check (CRITICAL FIX)
      // PhonePe expects their orderId, not our MongoDB _id
      const orderIdForStatus = data.phonepeOrderId || id;
      
      // Use Standard Checkout Status API
      try {
        const token = await getAccessToken();
        const statusUrl = `${PHONEPE_STATUS_URL}/${orderIdForStatus}/status`;
        
        log("CHECK", "Calling PhonePe Status API", { 
          url: statusUrl,
          usingPhonepeOrderId: !!data.phonepeOrderId
        });
        
        const statusRes = await axios.get(statusUrl, {
          headers: {
            'Authorization': `O-Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        log("CHECK", "PhonePe Status Response", statusRes.data);
        
        const state = statusRes.data?.state || statusRes.data?.data?.state || 'PENDING';
        const saved = await persistState(state);
        
        log("CHECK", `=== END Check Payment ${requestId} - SUCCESS ===`);
        return res.status(200).json({ success: saved });
        
      } catch (statusErr) {
        log("CHECK", "Status API failed", {
          message: statusErr.message,
          response: statusErr.response?.data,
          status: statusErr.response?.status
        });
        
        // Return current DB status if API fails
        log("CHECK", `=== END Check Payment ${requestId} - Returning DB status ===`);
        return res.status(200).json({ success: data });
      }

    } catch (error) {
      log("CHECK", "ERROR", { message: error.message, stack: error.stack });
      log("CHECK", `=== END Check Payment ${requestId} - ERROR ===`);
      return res.status(400).json({ error: error.message });
    }
  }

  async paymentcallback(req, res) {
    console.log('[paymentcallback] body:', req.body);
    const { response } = req.body;

    const decodedStr = Buffer.from(response, 'base64').toString('utf-8');

    // Parse JSON
    const responseJson = JSON.parse(decodedStr);
    console.log('[paymentcallback] decoded data:', responseJson?.data);
    const { merchantTransactionId, state } = responseJson?.data;

    // Log the callback data for debugging
    console.log(`[paymentcallback] Callback received: Transaction ${merchantTransactionId}, Status: ${state}`);
    let data = await transactionModel.findById(merchantTransactionId);
    if (data) {
      data.status = state;
      if (state === 'COMPLETED') {
        if (data.config) {
          try {
            await axios(JSON.parse(data.config))
          } catch (e) {
            console.error('[paymentcallback] config callback failed:', e.message)
          }
        }
        // If an order was created before payment, mark it Confirmed
        if (data.orderId && /^[0-9a-fA-F]{24}$/.test(data.orderId)) {
          try {
            await Checkout.findByIdAndUpdate(
              data.orderId,
              { status: 'Confirmed' },
              { new: true }
            );
          } catch (e) {
            console.error('[paymentcallback] Failed to update Checkout status to Confirmed (callback):', e.message);
          }
        }
      }
      await data.save()
    }
    // Update transaction status in your database
    if (state === 'COMPLETED') {


      // Mark the transaction as successful
      // Update relevant database records
      console.log(`Transaction ${merchantTransactionId} was successful.`);
    } else {
      // Handle failure or pending status
      console.log(`Transaction ${merchantTransactionId} failed or is pending.`);
    }

    // Send a response back to the payment gateway
    res.status(200).send('Callback processed');
  }

  async getallpayment(req, res) {
    try {
      let data = await transactionModel.find({}).sort({ _id: -1 });
      return res.status(200).json({ success: data });
    } catch (error) {
      console.log(error)
    }
  }

  async makepayment(req, res) {
    let {
      amount,
      merchantTransactionId,
      merchantUserId,
      redirectUrl,
      callbackUrl,
      mobileNumber,
    } = req.body;

    function generateSignature(payload, saltKey, saltIndex) {
      const encodedPayload = Buffer.from(payload).toString("base64");
      const concatenatedString = encodedPayload + "/pg/v1/pay" + saltKey;
      const hashedValue = crypto
        .createHash("sha256")
        .update(concatenatedString)
        .digest("hex");

      const signature = hashedValue + "###" + saltIndex;
      return signature;
    }

    const paymentDetails = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      amount: amount,
      redirectUrl: CALLBACK_URL,
      redirectMode: "POST",
      callbackUrl: callbackUrl,
      mobileNumber: mobileNumber,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const payload = JSON.stringify(paymentDetails);
    let objJsonB64 = Buffer.from(payload).toString("base64");
    const saltKey = SECRET_KEY; //test key
    const saltIndex = 1;
    const signature = generateSignature(payload, saltKey, saltIndex);

    try {
      const response = await axios.post(
        "https://api.phonepe.com/apis/hermes/pg/v1/pay",

        // "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
        {
          request: objJsonB64,
        },
        {
          headers: {
            "X-VERIFY": signature,
          },
        }
      );

      //   console.log(
      //     "Payment Response:",
      //     response.data,
      //     response.data?.data.instrumentResponse?.redirectInfo?.url
      //   );
      return res.status(200).json({
        url: response.data?.data.instrumentResponse?.redirectInfo,
      });
    } catch (error) {
      console.error("Payment Error:", error);
    }
  }

}

module.exports = new Transaction();

