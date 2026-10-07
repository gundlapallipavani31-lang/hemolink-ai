export type AIProviderStatus = {
  configured: boolean;
  message: string;
};

export function getAIProviderStatus(): AIProviderStatus {
  return {
    configured: false,
    message: "AI explanation service not configured",
  };
}
