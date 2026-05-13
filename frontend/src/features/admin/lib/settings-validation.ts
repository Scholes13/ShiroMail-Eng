import {
  validateEmailAddress,
  validateHTTPUrl,
  validateImageSourceUrl,
  validateIntegerRange,
  validateRequiredText,
  validateSelection,
} from "@/lib/validation";
import type {
  AuthPasswordSettings,
  AuthRegistrationSettings,
  AuthSessionSettings,
  APILimitsSettings,
  MailDeliverySettings,
  MailInboundSettings,
  MailSMTPSettings,
  OAuthProviderSettings,
  SiteIdentitySettings,
} from "../settings/types";

export function validateAdminSettingsSnapshot(input: {
  siteIdentity: SiteIdentitySettings;
  registration: AuthRegistrationSettings;
  password: AuthPasswordSettings;
  session: AuthSessionSettings;
  smtp: MailSMTPSettings;
  delivery: MailDeliverySettings;
  inbound: MailInboundSettings;
  apiLimits: APILimitsSettings;
  oauthProviders: OAuthProviderSettings[];
}) {
  const siteError =
    validateRequiredText("Text", input.siteIdentity.siteName, { minLength: 2, maxLength: 80 }) ||
    validateEmailAddress(input.siteIdentity.supportEmail) ||
    (input.siteIdentity.siteIconUrl.trim().length > 0
      ? validateImageSourceUrl(input.siteIdentity.siteIconUrl, "Text URL")
      : null) ||
    validateHTTPUrl(input.siteIdentity.appBaseUrl, "Text") ||
    validateRequiredText("Text", input.siteIdentity.defaultLanguage, { minLength: 2, maxLength: 16 }) ||
    validateRequiredText("Text", input.siteIdentity.defaultTimeZone, { minLength: 2, maxLength: 64 }) ||
    validateSelection("Text", input.siteIdentity.ambientThemeIntensity, ["subtle", "balanced", "vivid"]);
  if (siteError) {
    return siteError;
  }

  const registrationError = validateSelection("Text", input.registration.registrationMode, ["public", "invite_only", "closed"]);
  if (registrationError) {
    return registrationError;
  }

  const passwordError = validateIntegerRange("Text", input.password.minLength, { min: 6, max: 128 });
  if (passwordError) {
    return passwordError;
  }

  const sessionError =
    validateIntegerRange("Access Token Text", input.session.accessTokenMinutes, { min: 1, max: 1440 }) ||
    validateIntegerRange("Refresh Token Text", input.session.refreshTokenDays, { min: 1, max: 365 }) ||
    validateIntegerRange("Text", input.session.lockoutThreshold, { min: 1, max: 20 }) ||
    validateIntegerRange("Text", input.session.lockoutDurationMinutes, { min: 1, max: 1440 });
  if (sessionError) {
    return sessionError;
  }

  const smtpError =
    validateRequiredText("SMTP Hostname / MX Target", input.smtp.hostname, { minLength: 3, maxLength: 253 }) ||
    validateRequiredText("Text", input.smtp.listenAddr, { minLength: 3, maxLength: 128 }) ||
    validateIntegerRange("Text", input.smtp.maxMessageBytes, { min: 1024, max: 104857600 });
  if (smtpError) {
    return smtpError;
  }

  const inboundError =
    validateIntegerRange("Text", input.inbound.retainRawDays, { min: 1, max: 3650 }) ||
    validateIntegerRange("Text MB", input.inbound.maxAttachmentSizeMB, { min: 1, max: 1024 });
  if (inboundError) {
    return inboundError;
  }

  const apiLimitsError =
    validateSelection("API Text", input.apiLimits.identityMode, ["ip", "bearer_or_ip"]) ||
    validateIntegerRange("Text RPM", input.apiLimits.anonymousRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.authenticatedRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.authRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.loginRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.registerRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Refresh RPM", input.apiLimits.refreshRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.forgotPasswordRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.resetPasswordRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.emailVerificationResendRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.emailVerificationConfirmRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("OAuth Start RPM", input.apiLimits.oauthStartRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("OAuth Callback RPM", input.apiLimits.oauthCallbackRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("2FA Verify RPM", input.apiLimits.login2faVerifyRPM, { min: 1, max: 60000 }) ||
    validateIntegerRange("Text RPM", input.apiLimits.mailboxWriteRPM, { min: 1, max: 60000 }) ||
    (input.apiLimits.strictIpEnabled
      ? validateIntegerRange("Text IP RPM", input.apiLimits.strictIpRPM, { min: 1, max: 60000 })
      : null);
  if (apiLimitsError) {
    return apiLimitsError;
  }

  if (input.delivery.enabled) {
    const deliveryError =
      validateRequiredText("Text SMTP Host", input.delivery.host, { minLength: 2, maxLength: 253 }) ||
      validateIntegerRange("Text", input.delivery.port, { min: 1, max: 65535 }) ||
      validateSelection("Text", input.delivery.transportMode, ["plain", "starttls", "smtps"]) ||
      validateRequiredText("Text", input.delivery.username, { minLength: 1, maxLength: 255 }) ||
      validateRequiredText("SMTP Text / App Password", input.delivery.password, { minLength: 1, maxLength: 255 }) ||
      validateEmailAddress(input.delivery.fromAddress) ||
      validateRequiredText("SenderText", input.delivery.fromName, { minLength: 1, maxLength: 120 });
    if (deliveryError) {
      return deliveryError;
    }
  }

  for (const provider of input.oauthProviders) {
    const providerName = provider.displayName || provider.slug || "OAuth Text";
    const providerError =
      validateRequiredText(`${providerName} Text`, provider.displayName, { minLength: 2, maxLength: 80 }) ||
      validateRequiredText(`${providerName} Provider Slug`, provider.slug, { minLength: 2, maxLength: 64 });
    if (providerError) {
      return providerError;
    }
    if (provider.enabled) {
      const endpointError =
        validateRequiredText(`${providerName} Client ID`, provider.clientId, { minLength: 1, maxLength: 255 }) ||
        validateRequiredText(`${providerName} Client Secret`, provider.clientSecret, { minLength: 1, maxLength: 255 }) ||
        validateHTTPUrl(provider.authorizationUrl, `${providerName} Authorization URL`) ||
        validateHTTPUrl(provider.tokenUrl, `${providerName} Token URL`) ||
        validateHTTPUrl(provider.userInfoUrl, `${providerName} UserInfo URL`);
      if (endpointError) {
        return endpointError;
      }
      if (!provider.scopes.length) {
        return `${providerName}  must be at leastText Scope。`;
      }
    }
  }

  return null;
}
