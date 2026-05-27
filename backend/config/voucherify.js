const { ApiClient, VouchersApi, CategoriesApi, ValidationsApi } = require('@voucherify/sdk');

const apiClient = new ApiClient();
apiClient.basePath = process.env.VOUCHERIFY_API_URL || 'https://api.voucherify.io';
apiClient.authentications['X-App-Id'].apiKey = process.env.VOUCHERIFY_APP_ID;
apiClient.authentications['X-App-Token'].apiKey = process.env.VOUCHERIFY_SECRET_KEY;

module.exports = {
  vouchers: new VouchersApi(apiClient),
  categoriesApi: new CategoriesApi(apiClient),
  validations: new ValidationsApi(apiClient),
}
