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
const PHONEPE_PAY_URL = "https://api.phonepe.com/apis/pg-sandbox/pg/v1/pay"; // Standard Checkout pay endpoint
const CALLBACK_URL = "https://madhusewingmachines.com";

const transactionModel = require("../models/PhonepeModel");
const Checkout = require("../models/Order");

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

console.log("PhonePe: Using Standard Checkout REST API");

// Function to get OAuth access token
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    console.log("[getAccessToken] Fetching new access token...");
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

    console.log("[getAccessToken] Token response:", response.data);
    accessToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry
    tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
    return accessToken;
  } catch (error) {
    console.error("[getAccessToken] Error:", error.response?.data || error.message);
    throw error;
  }
}

class Transaction {

  async addPaymentPhone(req, res) {

    try {
      console.log('[addPaymentPhone] body:', req.body);
      const { userId, username, Mobile, orderId, amount, config, successUrl, failedUrl } = req.body;

      // Validate required fields
      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "userId, username, Mobile, and amount are required"
        });
      }

      // Validate minimum amount (PhonePe requires minimum ₹1)
      if (amount < 1) {
        return res.status(400).json({ 
          error: "Invalid amount",
          details: "Minimum payment amount is ₹1"
        });
      }

      console.log("[addPaymentPhone] Creating transaction for user:", userId, "amount:", amount, 'orderId:', orderId);

      // Save transaction details in DB
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

      console.log("[addPaymentPhone] Transaction created with ID:", data._id);

      const merchantOrderId = data._id.toString();
      // Use correct path /PaymentSuccess (capital P and S) and add source=app for mobile app redirect
      const redirectUrl = `https://madhusewingmachines.com/PaymentSuccess?transactionId=${data._id}&userID=${userId}&source=app`;

      console.log("[addPaymentPhone] Building Standard Checkout request for merchantOrderId:", merchantOrderId);

      try {
        // Get OAuth access token
        const token = await getAccessToken();
        console.log("[addPaymentPhone] Got access token:", token ? "Yes (length: " + token.length + ")" : "No");

        // Standard Checkout API payload - correct format per PhonePe docs
        const checkoutPayload = {
          merchantOrderId: merchantOrderId,
          amount: amount * 100, // Convert to paise (minimum 100 paise = ₹1)
          expireAfter: 1200, // 20 minutes
          metaInfo: {
            udf1: userId,
            udf2: username,
            udf3: Mobile
          },
          paymentFlow: {
            type: "PG_CHECKOUT",
            merchantUrls: {
              redirectUrl: redirectUrl
            }
          }
        };

        console.log("[addPaymentPhone] Checkout payload:", JSON.stringify(checkoutPayload, null, 2));
        console.log("[addPaymentPhone] Redirect URL:", redirectUrl);
        console.log("[addPaymentPhone] Amount in paise:", amount * 100);

        const response = await axios.post(
          "https://api.phonepe.com/apis/pg/checkout/v2/pay",
          checkoutPayload,
          {
            headers: {
              "Authorization": `O-Bearer ${token}`,
              "Content-Type": "application/json"
            },
          }
        );

        console.log("[addPaymentPhone] PhonePe Standard Checkout response:", JSON.stringify(response.data, null, 2));
        
        const checkoutUrl = response.data?.redirectUrl || response.data?.data?.redirectUrl || response.data?.redirect_url;
        
        if (checkoutUrl) {
          console.log("[addPaymentPhone] Payment URL generated successfully:", checkoutUrl);
          return res.status(200).json({
            orderId: merchantOrderId,
            merchantID: merchantOrderId,
            url: checkoutUrl,
          });
        } else {
          console.error("[addPaymentPhone] No redirect URL in response:", response.data);
          return res.status(500).json({ 
            error: "PhonePe payment initialization failed",
            details: "No redirect URL received from PhonePe"
          });
        }
      } catch (apiError) {
        console.error("[addPaymentPhone] PhonePe API error:", apiError.message);
        if (apiError.response) {
          console.error("[addPaymentPhone] PhonePe error response:", apiError.response.data);
          console.error("[addPaymentPhone] PhonePe error status:", apiError.response.status);
        }
        
        return res.status(500).json({ 
          error: "PhonePe payment initialization failed",
          details: apiError.response?.data?.message || apiError.message,
          phonepeError: apiError.response?.data
        });
      }
    } catch (error) {
      console.error("[addPaymentPhone] Payment Error:", error);
      console.error("[addPaymentPhone] Error stack:", error.stack);
      
      return res.status(500).json({ 
        error: "Payment processing failed",
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  async addPaymentMobile(req, res) {
    let transaction; // Declare transaction here to fix the ReferenceError

    try {
      // Validate input
      const { userId, username, Mobile, orderId, amount } = req.body;
      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create transaction record
      transaction = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED'
      })

      // Prepare payment payload
      const paymentPayload = {
        merchantId: "M22IJ7E10A8LQ",
        merchantTransactionId: transaction._id.toString(),
        merchantUserId: userId,
        amount: amount * 100, // Convert to paise
        redirectUrl: `https://nutribowl.org/payment-success?transactionId=${transaction._id}&userID=${userId}`,


        callbackUrl: "https://nutribowl.org/api/user/checkPayment/" + transaction._id + "/" + userId,

        mobileNumber: Mobile,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      // Generate signature
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + clientSecret;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex')+'###' + 1;
      const signature = sha256Hash + '###' + clientSecret;

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

      // Update transaction status if it was created
      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.response?.data?.message || error.message
        });
      }

      return res.status(500).json({
        error: "Payment processing error",
        details: error.response?.data || error.message
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
    try {
      console.log('[checkPayment] params:', req.params);

      let id = req.params.id;
      let userId = req.params.userId
      let data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Payment Id not found!" })
      // Helper to persist state and update related order
      const persistState = async (state) => {
        if (state === "COMPLETED") {
          if (data.config) {
            try {
              await axios(JSON.parse(data.config))
              data.config = null
            } catch (e) {
              console.error('Config callback failed:', e.message)
            }
          }
          if (data.orderId && /^[0-9a-fA-F]{24}$/.test(data.orderId)) {
            try {
              await Checkout.findByIdAndUpdate(
                data.orderId,
                { status: 'Confirmed' },
                { new: true }
              );
            } catch (e) {
              console.error('Failed to update Checkout status to Confirmed:', e.message);
            }
          }
        }
        data.status = state;
        return await data.save();
      }

      // First try SDK if available
      if (client && typeof client.getOrderStatus === 'function') {
        try {
          const response = await client.getOrderStatus(id);
          console.log('[checkPayment] SDK getOrderStatus response:', response);
          const state = response?.state || response?.data?.state || 'PENDING';
          const saved = await persistState(state);
          return res.status(200).json({ success: saved })
        } catch (sdkErr) {
          console.error('[checkPayment] SDK getOrderStatus failed, falling back to REST:', sdkErr?.message || sdkErr);
        }
      }

      // Fallback to PhonePe REST status API
      try {
        const path = `/pg/v1/status/${MERCHANT_ID}/${id}`;
        const stringToHash = path + SECRET_KEY;
        const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const xVerify = `${sha256Hash}###1`;

        console.log('[checkPayment] REST status request path:', path);
        const statusRes = await axios.get(`https://api.phonepe.com/apis/hermes${path}`, {
          headers: {
            'X-VERIFY': xVerify,
            'X-MERCHANT-ID': MERCHANT_ID,
            'Content-Type': 'application/json'
          }
        });

        console.log('[checkPayment] REST status response:', statusRes.data);
        const state = statusRes?.data?.data?.state || statusRes?.data?.data?.status || 'PENDING';
        const saved = await persistState(state);
        return res.status(200).json({ success: saved })
      } catch (restErr) {
        console.error('[checkPayment] REST status check failed:', restErr?.response?.data || restErr?.message || restErr);
        return res.status(400).json({ error: 'Unable to verify payment status at this time.' })
      }

    } catch (error) {
      console.log('[checkPayment] error:', error)
      return res.status(400).json({ error: error.message })
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

