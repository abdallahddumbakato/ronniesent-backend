import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const parser = new XMLParser();
const builder = new XMLBuilder();

export class DpoService {
  static async makeDPORequest(requestType, xmlData) {
    try {
      // ✅ FIX: Add the endpoint to the base URL
      const apiUrl = `${process.env.DPO_API_BASE_URL}${requestType}`;
      
      const response = await axios.post(apiUrl, xmlData, {
        headers: {
          'Content-Type': 'application/xml',
        },
        timeout: 30000,
      });
      const result = parser.parse(response.data);
      return result.API3G;
    } catch (error) {
      console.error('❌ DPO API Full Error:', error.response?.data || error.message);
      throw new Error('Payment service temporarily unavailable');
    }
  }

  // Create payment token - SIMPLE
  static async createToken(paymentData) {
    const {
      amount,
      currency = 'UGX',
      companyRef,
      customerEmail,
      customerPhone,
      customerFirstName,
      customerLastName = '',
      redirectURL,
      backURL
    } = paymentData;

    const xmlData = builder.build({
      API3G: {
        CompanyToken: process.env.DPO_COMPANY_TOKEN,
        Request: 'createToken',
        Transaction: {
          PaymentAmount: amount.toFixed(2),
          PaymentCurrency: currency,
          CompanyRef: companyRef,
          RedirectURL: redirectURL,
          BackURL: backURL,
          PTL: 15,
          PTLtype: 'hours',
          customerFirstName,
          customerLastName,
          customerEmail,
          customerPhone: this.formatPhoneNumber(customerPhone),
          customerCountry: 'UG',
          customerCity: 'Kampala',
          customerZip: '256'
        },
        Services: {
          Service: {
            ServiceType: process.env.DPO_SERVICE_TYPE,
            ServiceDescription: 'Ronnie\'s Entertainment Subscription',
            ServiceDate: new Date().toISOString().split('T')[0]
          }
        }
      }
    });
    const result = await this.makeDPORequest('createToken', xmlData);
    
    // SIMPLE CHECK: If not 0 (success), throw error
    if (result.Result != 0) {
      throw new Error(result.ResultExplanation || 'Payment token creation failed');
    }
    return result;
  }

  // Charge mobile money
  static async chargeTokenMobile(transactionToken, phoneNumber, mno) {
    const xmlData = builder.build({
      API3G: {
        CompanyToken: process.env.DPO_COMPANY_TOKEN,
        Request: 'ChargeTokenMobile',
        TransactionToken: transactionToken,
        PhoneNumber: this.formatPhoneNumber(phoneNumber),
        MNO: mno,
        MNOcountry: 'uganda'
      }
    });

    // ✅ FIX: Pass the request type
    return await this.makeDPORequest('ChargeTokenMobile', xmlData);
  }

  // Verify payment
  static async verifyToken(transactionToken) {
    const xmlData = builder.build({
      API3G: {
        CompanyToken: process.env.DPO_COMPANY_TOKEN,
        Request: 'verifyToken',
        TransactionToken: transactionToken
      }
    });

    // ✅ FIX: Pass the request type
    return await this.makeDPORequest('verifyToken', xmlData);
  }

  // Get mobile payment options
  static async getMobilePaymentOptions(transactionToken) {
    const xmlData = builder.build({
      API3G: {
        CompanyToken: process.env.DPO_COMPANY_TOKEN,
        Request: 'GetMobilePaymentOptions',
        TransactionToken: transactionToken
      }
    });

    // ✅ FIX: Pass the request type
    return await this.makeDPORequest('GetMobilePaymentOptions', xmlData);
  }

  // Format phone number remains the same
  static formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      return '256' + cleaned.substring(1);
    }
    
    if (cleaned.startsWith('256')) {
      return cleaned;
    }
    
    return cleaned;
  }

  // Get MNO code remains the same
  static getMnoCode(provider) {
    const providers = {
      mtn: 'MTNmobilemoney',
      airtel: 'Mobile_Airtel_UG'
    };
    
    return providers[provider.toLowerCase()] || providers.mtn;
  }
}
