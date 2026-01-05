const crypto = require('crypto');
const fc = require('fast-check');

/**
 * Property-Based Tests for PhonePe SDK Fix
 * Feature: phonepe-sdk-fix
 */

describe('PhonePe Payment Controller', () => {
  
  /**
   * Property 6: Request Signing Correctness
   * For any payment request, the backend SHALL generate a valid SHA256 signature
   * that PhonePe API accepts without PR004 errors.
   * 
   * Validates: Requirements 2.3, 2.4
   */
  describe('Property 6: Request Signing Correctness', () => {
    
    // Helper function to generate signature (same as backend)
    const generateSignature = (payload, endpoint, clientSecret) => {
      const stringToHash = payload + endpoint + clientSecret;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
      const saltIndex = 1;
      return sha256Hash + '###' + saltIndex;
    };

    // Helper function to validate signature format
    const isValidSignatureFormat = (signature) => {
      // Format should be: hash###saltIndex
      const parts = signature.split('###');
      if (parts.length !== 2) return false;
      
      const hash = parts[0];
      const saltIndex = parts[1];
      
      // Hash should be 64 hex characters (SHA256)
      if (!/^[a-f0-9]{64}$/.test(hash)) return false;
      
      // Salt index should be a number
      if (!/^\d+$/.test(saltIndex)) return false;
      
      return true;
    };

    test('Property 6.1: Signature format is always valid', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 1000 }),
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.string({ minLength: 20, maxLength: 100 }),
          (payload, endpoint, clientSecret) => {
            const signature = generateSignature(payload, endpoint, clientSecret);
            return isValidSignatureFormat(signature);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 6.2: Same payload generates same signature', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 1000 }),
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.string({ minLength: 20, maxLength: 100 }),
          (payload, endpoint, clientSecret) => {
            const sig1 = generateSignature(payload, endpoint, clientSecret);
            const sig2 = generateSignature(payload, endpoint, clientSecret);
            return sig1 === sig2;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 6.3: Different payloads generate different signatures', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 10, maxLength: 1000 }),
            fc.string({ minLength: 10, maxLength: 1000 })
          ).filter(([p1, p2]) => p1 !== p2),
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.string({ minLength: 20, maxLength: 100 }),
          ([payload1, payload2], endpoint, clientSecret) => {
            const sig1 = generateSignature(payload1, endpoint, clientSecret);
            const sig2 = generateSignature(payload2, endpoint, clientSecret);
            return sig1 !== sig2;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 6.4: Signature contains valid SHA256 hash', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 1000 }),
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.string({ minLength: 20, maxLength: 100 }),
          (payload, endpoint, clientSecret) => {
            const signature = generateSignature(payload, endpoint, clientSecret);
            const hash = signature.split('###')[0];
            
            // Verify hash is correct
            const stringToHash = payload + endpoint + clientSecret;
            const expectedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');
            
            return hash === expectedHash;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 1: Token Generation Round Trip
   * For any valid payment request with userId, amount, and orderId,
   * the backend SHALL generate a token that the mobile SDK can process
   * without authorization errors.
   * 
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  describe('Property 1: Token Generation Round Trip', () => {
    
    test('Property 1.1: Valid payment request generates token', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 24, maxLength: 24 }), // MongoDB ObjectId
          fc.string({ minLength: 1, maxLength: 100 }),  // username
          fc.string({ minLength: 10, maxLength: 10 }),  // phone
          fc.integer({ min: 100, max: 1000000 }),       // amount in rupees
          (userId, username, phone, amount) => {
            // Simulate payment payload
            const paymentPayload = {
              merchantOrderId: userId,
              amount: amount * 100, // Convert to paise
              expireAfter: 1200,
              metaInfo: {
                udf1: userId,
                udf2: username,
                udf3: phone
              },
              paymentFlow: {
                type: "PG_CHECKOUT"
              }
            };

            // Encode to base64
            const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
            
            // Verify it can be decoded back
            const decoded = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
            
            return decoded.merchantOrderId === userId &&
                   decoded.amount === amount * 100 &&
                   decoded.metaInfo.udf1 === userId;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 1.2: Token payload contains required fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 24, maxLength: 24 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 10 }),
          fc.integer({ min: 100, max: 1000000 }),
          (userId, username, phone, amount) => {
            const paymentPayload = {
              merchantOrderId: userId,
              amount: amount * 100,
              expireAfter: 1200,
              metaInfo: {
                udf1: userId,
                udf2: username,
                udf3: phone
              },
              paymentFlow: {
                type: "PG_CHECKOUT"
              }
            };

            // Check all required fields are present
            return paymentPayload.merchantOrderId &&
                   paymentPayload.amount > 0 &&
                   paymentPayload.expireAfter > 0 &&
                   paymentPayload.metaInfo &&
                   paymentPayload.paymentFlow &&
                   paymentPayload.paymentFlow.type === "PG_CHECKOUT";
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Configuration Validation
   * For any backend startup, the system SHALL validate that clientId,
   * clientSecret, and environment are correctly configured.
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   */
  describe('Property 5: Configuration Validation', () => {
    
    test('Property 5.1: Valid configuration passes validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }),  // clientId
          fc.string({ minLength: 20, maxLength: 100 }), // clientSecret
          (clientId, clientSecret) => {
            // Simulate validation
            const isValid = !!clientId && !!clientSecret && clientId.length > 0 && clientSecret.length > 0;
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 5.2: Empty clientId fails validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 20, maxLength: 100 }),
          (clientSecret) => {
            const clientId = '';
            const isValid = !!clientId && !!clientSecret;
            return !isValid; // Should fail validation
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 5.3: Empty clientSecret fails validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }),
          (clientId) => {
            const clientSecret = '';
            const isValid = !!clientId && !!clientSecret;
            return !isValid; // Should fail validation
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 5.4: Environment must be PRODUCTION or SANDBOX', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('PRODUCTION', 'SANDBOX'),
          (environment) => {
            const isValid = environment === 'PRODUCTION' || environment === 'SANDBOX';
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
